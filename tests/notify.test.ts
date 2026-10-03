import assert from "node:assert/strict";
import test from "node:test";

import {
  NOTIFY_EVENTS,
  __resetNotifyFetch,
  __setNotifyFetch,
  getNotifyStats,
  idempotencyKeyFor,
  renderNotify,
  resetNotifyDedupe,
  send,
  type NotifyEvent,
} from "../services/vendor/notify/notify-service";

const SAVED = {
  resend: process.env.RESEND_API_KEY,
  wa: process.env.WA_API_KEY,
  waProvider: process.env.WA_PROVIDER,
};

function stubEnv() {
  delete process.env.RESEND_API_KEY;
  delete process.env.WA_API_KEY;
  delete process.env.WA_PROVIDER;
}

function restoreEnv() {
  if (SAVED.resend !== undefined) process.env.RESEND_API_KEY = SAVED.resend;
  else delete process.env.RESEND_API_KEY;
  if (SAVED.wa !== undefined) process.env.WA_API_KEY = SAVED.wa;
  else delete process.env.WA_API_KEY;
  if (SAVED.waProvider !== undefined) process.env.WA_PROVIDER = SAVED.waProvider;
  else delete process.env.WA_PROVIDER;
  __resetNotifyFetch();
}

const origLog = console.log;

function silence() {
  console.log = () => {};
}

function unsilence() {
  console.log = origLog;
}

const basePayload = {
  portalToken: "tok-123",
  amount: 1_500_000n,
  currency: "IDR",
  deadline: new Date(2026, 9, 20),
  projectTitle: "Redesain Web",
  invoiceTitle: "DP 50%",
};

test("idempotency: kirim 2x (event, entityId) sama = 1 pengiriman", async () => {
  stubEnv();
  silence();
  resetNotifyDedupe();
  try {
    const first = await send("client@example.com", "invoice.sent", { entityId: "inv-1", ...basePayload });
    const second = await send("client@example.com", "invoice.sent", { entityId: "inv-1", ...basePayload });
    assert.equal(first.ok, true);
    assert.equal(first.stubbed, true);
    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true);
    assert.equal(getNotifyStats().sent, 1);
    assert.equal(first.idempotencyKey, "invoice.sent:inv-1");
  } finally {
    unsilence();
    restoreEnv();
  }
});

test("entityId beda = kirim lagi (tidak saling menelan)", async () => {
  stubEnv();
  silence();
  resetNotifyDedupe();
  try {
    await send("client@example.com", "invoice.sent", { entityId: "a", ...basePayload });
    await send("client@example.com", "invoice.sent", { entityId: "b", ...basePayload });
    assert.equal(getNotifyStats().sent, 2);
  } finally {
    unsilence();
    restoreEnv();
  }
});

test("dedupeSuffix memisahkan bucket reminder H-3/H+0/H+1", async () => {
  stubEnv();
  silence();
  resetNotifyDedupe();
  try {
    await send("c@example.com", "invoice.sent", { entityId: "inv-9", dedupeSuffix: "H-3", ...basePayload });
    await send("c@example.com", "invoice.sent", { entityId: "inv-9", dedupeSuffix: "H+0", ...basePayload });
    const replay = await send("c@example.com", "invoice.sent", { entityId: "inv-9", dedupeSuffix: "H-3", ...basePayload });
    assert.equal(getNotifyStats().sent, 2);
    assert.equal(replay.replayed, true);
    assert.equal(idempotencyKeyFor("invoice.sent", "inv-9", "H-3"), "invoice.sent:inv-9:H-3");
  } finally {
    unsilence();
    restoreEnv();
  }
});

test("semua template ID+EN memuat link /p/[token] + nominal + deadline", () => {
  assert.equal(NOTIFY_EVENTS.length, 13);
  for (const event of NOTIFY_EVENTS) {
    for (const locale of ["id", "en"] as const) {
      const { subject, text } = renderNotify(event as NotifyEvent, { entityId: "e1", locale, ...basePayload });
      assert.ok(text.includes("/p/tok-123"), `${event}/${locale}: harus ada magic-link /p/[token]`);
      assert.ok(text.includes(locale === "id" ? "500.000" : "500,000"), `${event}/${locale}: harus ada nominal (1.500.000)`);
      assert.ok(text.includes("2026"), `${event}/${locale}: harus ada deadline`);
      assert.ok(subject.length > 0, `${event}/${locale}: subject tidak boleh kosong`);
    }
  }
});

test("channel dari bentuk alamat: email vs WA, stub saat key kosong", async () => {
  stubEnv();
  silence();
  resetNotifyDedupe();
  try {
    const email = await send("client@example.com", "escrow.funded", { entityId: "e1", ...basePayload });
    const wa = await send("6281234567890", "escrow.funded", { entityId: "e2", ...basePayload });
    assert.equal(email.channel, "email");
    assert.equal(wa.channel, "wa");
    assert.equal(email.stubbed, true);
    assert.equal(wa.stubbed, true);
  } finally {
    unsilence();
    restoreEnv();
  }
});

test("transport Resend dipanggil 1x walau send 2x (mock fetch)", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  delete process.env.WA_API_KEY;
  resetNotifyDedupe();
  let fetchCalls = 0;
  __setNotifyFetch((async () => {
    fetchCalls += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch);
  silence();
  try {
    const first = await send("c@example.com", "invoice.overdue", { entityId: "inv-x", ...basePayload });
    const second = await send("c@example.com", "invoice.overdue", { entityId: "inv-x", ...basePayload });
    assert.equal(first.ok, true);
    assert.equal(first.stubbed, false);
    assert.equal(second.replayed, true);
    assert.equal(fetchCalls, 1);
  } finally {
    unsilence();
    restoreEnv();
  }
});

test("gagal transport tidak menghanguskan idempotency (boleh retry)", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  resetNotifyDedupe();
  __setNotifyFetch((async () => new Response("boom", { status: 500 })) as typeof fetch);
  silence();
  try {
    const failed = await send("c@example.com", "dispute.opened", { entityId: "inv-r", ...basePayload });
    assert.equal(failed.ok, false);
    assert.match(failed.error ?? "", /resend:500/);
    __setNotifyFetch((async () => new Response("{}", { status: 200 })) as typeof fetch);
    const retry = await send("c@example.com", "dispute.opened", { entityId: "inv-r", ...basePayload });
    assert.equal(retry.ok, true);
    assert.equal(retry.replayed, false, "retry setelah gagal = kiriman baru, bukan replay");
  } finally {
    unsilence();
    restoreEnv();
  }
});
