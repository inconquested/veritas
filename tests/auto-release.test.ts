import assert from "node:assert/strict";
import test from "node:test";

import {
  autoReleaseKey,
  collectAutoReleaseCandidates,
  runAutoRelease,
  shouldAutoRelease,
  GET as autoReleaseGET,
} from "../app/api/cron/auto-release/route";
import {
  classifyReminder,
  runReminders,
  GET as remindersGET,
} from "../app/api/cron/reminders/route";
import { reminderTemplateFor } from "../services/vendor/notify/notify-service";
import { getSettings } from "../lib/freelancer-settings";

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 2, 12, 0, 0);
const old = new Date(NOW.getTime() - 20 * DAY);
const recent = new Date(NOW.getTime() - 2 * DAY);

// ---------------------------------------------------------------------------
// shouldAutoRelease (murni, tanpa DB)
// ---------------------------------------------------------------------------

test("auto-release DIBLOKIR saat status DISPUTED", () => {
  const r = shouldAutoRelease(
    { invoiceId: "i1", status: "DISPUTED", updatedAt: old },
    [],
    NOW,
    14,
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "disputed");
});

test("auto-release OK saat FUNDS_HELD + diam 20 hari + tanpa dispute", () => {
  const r = shouldAutoRelease(
    { invoiceId: "i1", status: "FUNDS_HELD", updatedAt: old },
    [],
    NOW,
    14,
  );
  assert.equal(r.ok, true);
});

test("auto-release diblokir saat escrow baru diupdate (klien aktif)", () => {
  const r = shouldAutoRelease(
    { invoiceId: "i1", status: "FUNDS_HELD", updatedAt: recent },
    [],
    NOW,
    14,
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "active");
});

test("auto-release diblokir saat ada EscrowEvent dispute dalam N hari", () => {
  const r = shouldAutoRelease(
    { invoiceId: "i1", status: "FUNDS_HELD", updatedAt: old },
    [{ action: "dispute", toStatus: "DISPUTED", createdAt: recent }],
    NOW,
    14,
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "recent-dispute");
});

test("dispute lama (> N hari) tidak memblokir", () => {
  const r = shouldAutoRelease(
    { invoiceId: "i1", status: "FUNDS_HELD", updatedAt: old },
    [{ action: "dispute", toStatus: "DISPUTED", createdAt: old }],
    NOW,
    14,
  );
  assert.equal(r.ok, true);
});

test("status selain FUNDS_HELD/DISPUTED tidak dirilis", () => {
  for (const status of ["INITIALIZED", "RELEASED", "REFUNDED"]) {
    const r = shouldAutoRelease({ invoiceId: "i1", status, updatedAt: old }, [], NOW, 14);
    assert.equal(r.ok, false, status);
  }
});

test("autoReleaseKey stabil per invoice (retry = replay)", () => {
  assert.equal(autoReleaseKey("inv-1"), "auto-release:inv-1");
});

// ---------------------------------------------------------------------------
// runAutoRelease dengan mock db + mock releaser
// ---------------------------------------------------------------------------

function mockAutoDb() {
  const rows = [
    { invoiceId: "inv-ok", status: "FUNDS_HELD", updatedAt: old, events: [] },
    { invoiceId: "inv-disputed", status: "DISPUTED", updatedAt: old, events: [] },
    { invoiceId: "inv-recent", status: "FUNDS_HELD", updatedAt: recent, events: [] },
    {
      invoiceId: "inv-recent-dispute",
      status: "FUNDS_HELD",
      updatedAt: old,
      events: [{ action: "dispute", toStatus: "DISPUTED", createdAt: recent }],
    },
  ];
  return { escrow: { findMany: async () => rows } };
}

test("collectAutoReleaseCandidates hanya mengembalikan yang diam + tanpa dispute", async () => {
  const c = await collectAutoReleaseCandidates(mockAutoDb(), NOW, 14);
  assert.deepEqual(c.map((r) => r.invoiceId), ["inv-ok"]);
});

test("runAutoRelease merilis kandidat via releaser dengan key stabil", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any[] = [];
  const releaser = async (invoiceId: string, key: string) => {
    calls.push({ invoiceId, key });
    return { replayed: false };
  };
  const out = await runAutoRelease(mockAutoDb(), releaser, NOW, 14);
  assert.equal(out.released, 1);
  assert.deepEqual(calls, [{ invoiceId: "inv-ok", key: "auto-release:inv-ok" }]);
  assert.equal(out.items[0].status, "released");
});

test("runAutoRelease dry-run tidak memanggil releaser", async () => {
  let calls = 0;
  const out = await runAutoRelease(
    mockAutoDb(),
    async () => {
      calls += 1;
      return {};
    },
    NOW,
    14,
    { dryRun: true },
  );
  assert.equal(calls, 0);
  assert.equal(out.released, 0);
  assert.equal(out.items[0].status, "dry-run");
});

test("runAutoRelease mencatat error releaser per-item (tidak throw)", async () => {
  const out = await runAutoRelease(
    mockAutoDb(),
    async () => {
      throw new Error("escrow explodes");
    },
    NOW,
    14,
  );
  assert.equal(out.released, 0);
  assert.equal(out.items[0].status, "error");
  assert.match(out.items[0].error ?? "", /escrow explodes/);
});

// ---------------------------------------------------------------------------
// Reminder classifier + runReminders dengan mock db + mock sender
// ---------------------------------------------------------------------------

test("classifyReminder: H-3 / H+0 / H+1 / null", () => {
  assert.equal(classifyReminder(new Date(2026, 9, 5), NOW), "H-3");
  assert.equal(classifyReminder(new Date(2026, 9, 2, 8), NOW), "H+0");
  assert.equal(classifyReminder(new Date(2026, 9, 1), NOW), "H+1");
  assert.equal(classifyReminder(new Date(2026, 8, 20), NOW), "H+1");
  assert.equal(classifyReminder(new Date(2026, 9, 20), NOW), null);
  assert.equal(reminderTemplateFor("H-3"), "invoice.sent");
  assert.equal(reminderTemplateFor("H+0"), "invoice.sent");
  assert.equal(reminderTemplateFor("H+1"), "invoice.overdue");
});

function mockReminderDb(rows: unknown[]) {
  return {
    invoice: { findMany: async () => rows },
    projectShareToken: { findFirst: async () => ({ token: "tok-1" }) },
  };
}

function reminderRow(id: string, due: Date) {
  return {
    id,
    title: `Invoice ${id}`,
    amount: 500_000n,
    currency: "IDR",
    status: "SENT",
    due_date: due,
    project_id: "p1",
    project: { title: "Web", client: { email: "client@example.com" } },
  };
}

test("runReminders mengirim H-3/H+0/H+1, skip yang jauh dari jatuh tempo", async () => {
  delete process.env.REMINDER_CHANNEL;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any[] = [];
  const sender = (async (to: string, template: string, payload: unknown) => {
    calls.push({ to, template, payload });
    return { ok: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
  const db = mockReminderDb([
    reminderRow("h3", new Date(2026, 9, 5)),
    reminderRow("h0", new Date(2026, 9, 2, 9)),
    reminderRow("h1", new Date(2026, 9, 1)),
    reminderRow("far", new Date(2026, 9, 20)),
  ]);
  const out = await runReminders(db, sender, NOW);
  assert.equal(out.sent, 3);
  assert.equal(out.skipped, 1);
  const byId = Object.fromEntries(calls.map((c) => [(c.payload as { entityId: string }).entityId, c]));
  assert.equal(byId.h3.template, "invoice.sent");
  assert.equal((byId.h3.payload as { dedupeSuffix: string }).dedupeSuffix, "H-3");
  assert.equal(byId.h0.template, "invoice.sent");
  assert.equal(byId.h1.template, "invoice.overdue");
  assert.equal(byId.h1.to, "client@example.com");
  assert.ok(!(calls.some((c) => (c.payload as { entityId: string }).entityId === "far")));
});

test("runReminders dry-run tidak memanggil sender", async () => {
  delete process.env.REMINDER_CHANNEL;
  let calls = 0;
  const sender = (async () => {
    calls += 1;
    return { ok: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
  const out = await runReminders(mockReminderDb([reminderRow("h0", new Date(2026, 9, 2, 9))]), sender, NOW, { dryRun: true });
  assert.equal(calls, 0);
  assert.equal(out.items[0].status, "dry-run");
  assert.equal(out.items[0].key, "invoice.sent:h0:H+0");
});

// ---------------------------------------------------------------------------
// Guard secret cron: tanpa Bearer yang benar = 401 (sebelum sentuh DB)
// ---------------------------------------------------------------------------

test("cron tanpa secret = 401 (reminders + auto-release)", async () => {
  process.env.CRON_SECRET = "s3cret-f3";
  const r1 = await remindersGET(new Request("http://localhost/api/cron/reminders"));
  const r2 = await autoReleaseGET(new Request("http://localhost/api/cron/auto-release"));
  assert.equal(r1.status, 401);
  assert.equal(r2.status, 401);
  const body = (await r1.json()) as { errorKey: string };
  assert.equal(body.errorKey, "errors.cron.unauthorized");
});

test("cron menolak Bearer salah", async () => {
  process.env.CRON_SECRET = "s3cret-f3";
  const r = await remindersGET(
    new Request("http://localhost/api/cron/reminders", {
      headers: { authorization: "Bearer salah" },
    }),
  );
  assert.equal(r.status, 401);
});

// ---------------------------------------------------------------------------
// getSettings: default env + override
// ---------------------------------------------------------------------------

test("getSettings default global dari env", () => {
  const savedDays = process.env.AUTO_RELEASE_DAYS;
  const savedCh = process.env.REMINDER_CHANNEL;
  delete process.env.AUTO_RELEASE_DAYS;
  delete process.env.REMINDER_CHANNEL;
  try {
    assert.deepEqual(getSettings("any-freelancer"), { autoReleaseDays: 14, reminderChannel: "both" });
    process.env.AUTO_RELEASE_DAYS = "30";
    process.env.REMINDER_CHANNEL = "email";
    assert.deepEqual(getSettings(), { autoReleaseDays: 30, reminderChannel: "email" });
    process.env.AUTO_RELEASE_DAYS = "nol";
    process.env.REMINDER_CHANNEL = "sms";
    assert.deepEqual(getSettings(), { autoReleaseDays: 14, reminderChannel: "both" });
  } finally {
    if (savedDays !== undefined) process.env.AUTO_RELEASE_DAYS = savedDays;
    else delete process.env.AUTO_RELEASE_DAYS;
    if (savedCh !== undefined) process.env.REMINDER_CHANNEL = savedCh;
    else delete process.env.REMINDER_CHANNEL;
  }
});
