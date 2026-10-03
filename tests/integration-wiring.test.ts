import assert from "node:assert/strict";
import test from "node:test";

import {
  collectAutoReleaseCandidates,
  shouldAutoRelease,
} from "../app/api/cron/auto-release/route";
import {
  idempotencyKeyFor,
  isNotifyLogged,
  recordNotifyLog,
} from "../services/vendor/notify/notify-service";
import { getSettingsFor } from "../lib/freelancer-settings";

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 2, 12, 0, 0);
const old = new Date(NOW.getTime() - 20 * DAY);

// ---------------------------------------------------------------------------
// 1. Dispute OPEN memblokir auto-release (logic murni)
// ---------------------------------------------------------------------------

test("wiring: hasOpenDispute=true memblokir escrow yang diam sekalipun", () => {
  const r = shouldAutoRelease(
    { invoiceId: "i1", status: "FUNDS_HELD", updatedAt: old },
    [],
    NOW,
    14,
    { hasOpenDispute: true },
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "open-dispute");
});

test("wiring: tanpa dispute flag, escrow diam tetap lolos", () => {
  const r = shouldAutoRelease(
    { invoiceId: "i1", status: "FUNDS_HELD", updatedAt: old },
    [],
    NOW,
    14,
    { hasOpenDispute: false },
  );
  assert.equal(r.ok, true);
});

test("wiring: collectAutoReleaseCandidates menyaring escrow ber-Dispute OPEN", async () => {
  const rows = [
    { id: "esc-ok", invoiceId: "inv-ok", status: "FUNDS_HELD", updatedAt: old, events: [] },
    { id: "esc-sengketa", invoiceId: "inv-gugur", status: "FUNDS_HELD", updatedAt: old, events: [] },
  ];
  const db = {
    escrow: { findMany: async () => rows },
    dispute: {
      findMany: async () => [{ escrowId: "esc-sengketa" }], // status sudah difilter di query
    },
  };
  const c = await collectAutoReleaseCandidates(db, NOW, 14);
  assert.deepEqual(
    c.map((r) => r.invoiceId),
    ["inv-ok"],
  );
});

test("wiring: pre-migrate (db.dispute undefined) = fail-open, kandidat tetap jalan", async () => {
  const rows = [
    { id: "esc-ok", invoiceId: "inv-ok", status: "FUNDS_HELD", updatedAt: old, events: [] },
  ];
  const db = { escrow: { findMany: async () => rows } };
  const c = await collectAutoReleaseCandidates(db, NOW, 14);
  assert.deepEqual(
    c.map((r) => r.invoiceId),
    ["inv-ok"],
  );
});

// ---------------------------------------------------------------------------
// 2. Idempotency NotifyLog unik
// ---------------------------------------------------------------------------

test("wiring: key unik per (template, entityId, suffix)", () => {
  const a = idempotencyKeyFor("dispute.opened", "d1");
  const b = idempotencyKeyFor("dispute.resolved", "d1");
  const c = idempotencyKeyFor("dispute.opened", "d2");
  const d = idempotencyKeyFor("invoice.sent", "inv-9", "H-3");
  const e = idempotencyKeyFor("invoice.sent", "inv-9", "H+0");
  assert.equal(new Set([a, b, c, d, e]).size, 5);
});

test("wiring: NotifyLog L2 hermetic tanpa DATABASE_URL (no-throw, fallback L1)", async () => {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.equal(await isNotifyLogged("invoice.sent:x"), false);
    await recordNotifyLog("invoice.sent:x", "invoice.sent"); // tidak throw
  } finally {
    if (saved !== undefined) process.env.DATABASE_URL = saved;
  }
});

// ---------------------------------------------------------------------------
// 3. Settings fallback env
// ---------------------------------------------------------------------------

test("wiring: getSettingsFor(null) = fallback env", async () => {
  const sD = process.env.AUTO_RELEASE_DAYS;
  const sC = process.env.REMINDER_CHANNEL;
  const sDb = process.env.DATABASE_URL;
  delete process.env.AUTO_RELEASE_DAYS;
  delete process.env.REMINDER_CHANNEL;
  delete process.env.DATABASE_URL;
  try {
    assert.deepEqual(await getSettingsFor(null), { autoReleaseDays: 14, reminderChannel: "both" });
    assert.deepEqual(await getSettingsFor("freelancer-x"), {
      autoReleaseDays: 14,
      reminderChannel: "both",
    });
    process.env.AUTO_RELEASE_DAYS = "21";
    process.env.REMINDER_CHANNEL = "wa";
    assert.deepEqual(await getSettingsFor("freelancer-x"), {
      autoReleaseDays: 21,
      reminderChannel: "wa",
    });
  } finally {
    if (sD !== undefined) process.env.AUTO_RELEASE_DAYS = sD;
    else delete process.env.AUTO_RELEASE_DAYS;
    if (sC !== undefined) process.env.REMINDER_CHANNEL = sC;
    else delete process.env.REMINDER_CHANNEL;
    if (sDb !== undefined) process.env.DATABASE_URL = sDb;
  }
});
