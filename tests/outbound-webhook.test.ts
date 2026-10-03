import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOutboundEnvelope,
  isOutboundEvent,
  sendOutboundWebhook,
  signOutboundPayload,
  verifyOutboundSignature,
} from "../lib/outbound-webhook";
import { GET as outboundGET, POST as outboundPOST } from "../app/api/webhooks/outbound/route";

const SECRET = "wh-test-secret";
const SAVED = {
  secret: process.env.OUTBOUND_WEBHOOK_SECRET,
  url: process.env.OUTBOUND_WEBHOOK_URL,
};
function restoreEnv() {
  if (SAVED.secret !== undefined) process.env.OUTBOUND_WEBHOOK_SECRET = SAVED.secret;
  else delete process.env.OUTBOUND_WEBHOOK_SECRET;
  if (SAVED.url !== undefined) process.env.OUTBOUND_WEBHOOK_URL = SAVED.url;
  else delete process.env.OUTBOUND_WEBHOOK_URL;
}

test("HMAC: sign -> verify roundtrip", () => {
  const raw = JSON.stringify({ event: "invoice.paid", n: 1 });
  const sig = signOutboundPayload(raw, SECRET);
  assert.match(sig, /^[0-9a-f]{64}$/);
  assert.equal(verifyOutboundSignature(raw, sig, SECRET), true);
});

test("HMAC: secret salah / body diubah / signature kosong -> ditolak", () => {
  const raw = JSON.stringify({ event: "invoice.paid" });
  const sig = signOutboundPayload(raw, SECRET);
  assert.equal(verifyOutboundSignature(raw, sig, "secret-lain"), false);
  assert.equal(verifyOutboundSignature(`${raw} `, sig, SECRET), false);
  assert.equal(verifyOutboundSignature(raw, "", SECRET), false);
  assert.equal(verifyOutboundSignature(raw, null, SECRET), false);
});

test("HMAC: fails closed tanpa secret", () => {
  delete process.env.OUTBOUND_WEBHOOK_SECRET;
  try {
    assert.throws(() => signOutboundPayload("x"), /not configured/);
    assert.equal(verifyOutboundSignature("x", "abc", ""), false);
  } finally {
    restoreEnv();
  }
});

test("envelope: bentuk + id + occurredAt ISO", () => {
  process.env.OUTBOUND_WEBHOOK_SECRET = SECRET;
  try {
    const { envelope, raw, signature } = buildOutboundEnvelope("escrow.released", { invoiceId: "inv_1" });
    assert.equal(envelope.event, "escrow.released");
    assert.match(envelope.id, /^wh_/);
    assert.ok(!Number.isNaN(Date.parse(envelope.occurredAt)));
    assert.equal(raw, JSON.stringify(envelope));
    assert.equal(verifyOutboundSignature(raw, signature, SECRET), true);
  } finally {
    restoreEnv();
  }
});

test("isOutboundEvent: allowlist ketat", () => {
  assert.equal(isOutboundEvent("invoice.paid"), true);
  assert.equal(isOutboundEvent("escrow.released"), true);
  assert.equal(isOutboundEvent("invoice.created"), false);
  assert.equal(isOutboundEvent(""), false);
  assert.equal(isOutboundEvent(null), false);
});

test("kirim: sukses 1x percobaan + header signature valid", async () => {
  process.env.OUTBOUND_WEBHOOK_SECRET = SECRET;
  delete process.env.OUTBOUND_WEBHOOK_URL;
  try {
    let seen: { sig: string; event: string; body: string } | null = null;
    const okFetch = (async (url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      seen = {
        sig: String((init?.headers as Record<string, string>)["x-veritas-signature"]),
        event: String((init?.headers as Record<string, string>)["x-veritas-event"]),
        body,
      };
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const r = await sendOutboundWebhook({
      url: "https://hooks.zapier.com/hooks/catch/x",
      event: "invoice.paid",
      data: { invoiceId: "inv_1" },
      fetchImpl: okFetch,
      delaysMs: [0, 0],
    });
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 1);
    assert.equal(r.stubbed, false);
    assert.equal(seen!.event, "invoice.paid");
    assert.equal(verifyOutboundSignature(seen!.body, seen!.sig, SECRET), true);
  } finally {
    restoreEnv();
  }
});

test("kirim: gagal lalu sukses = retry (attempts 2)", async () => {
  process.env.OUTBOUND_WEBHOOK_SECRET = SECRET;
  try {
    let calls = 0;
    const flaky = (async () => {
      calls += 1;
      return calls === 1 ? new Response("err", { status: 500 }) : new Response("ok", { status: 200 });
    }) as typeof fetch;
    const r = await sendOutboundWebhook({
      url: "https://example.com/hook",
      event: "escrow.released",
      data: {},
      fetchImpl: flaky,
      delaysMs: [0, 0],
    });
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 2);
  } finally {
    restoreEnv();
  }
});

test("kirim: selalu gagal = 3x percobaan lalu gagal elegan", async () => {
  process.env.OUTBOUND_WEBHOOK_SECRET = SECRET;
  try {
    let calls = 0;
    const dead = (async () => {
      calls += 1;
      return new Response("err", { status: 500 });
    }) as typeof fetch;
    const r = await sendOutboundWebhook({
      url: "https://example.com/hook",
      event: "invoice.paid",
      data: {},
      fetchImpl: dead,
      delaysMs: [0, 0],
    });
    assert.equal(r.ok, false);
    assert.equal(r.attempts, 3);
    assert.equal(calls, 3);
    assert.ok(r.error);
  } finally {
    restoreEnv();
  }
});

test("kirim: tanpa URL = stub (tidak kirim, tidak crash)", async () => {
  process.env.OUTBOUND_WEBHOOK_SECRET = SECRET;
  delete process.env.OUTBOUND_WEBHOOK_URL;
  try {
    const r = await sendOutboundWebhook({ event: "invoice.paid", data: {} });
    assert.equal(r.ok, true);
    assert.equal(r.stubbed, true);
    assert.equal(r.attempts, 0);
  } finally {
    restoreEnv();
  }
});

test("route GET: dokumentasi event + Zapier/Make + contoh payload", async () => {
  const res = await outboundGET();
  const json = (await res.json()) as {
    events: string[];
    zapier: string;
    make: string;
    example: { event: string; data: object };
  };
  assert.ok(json.events.includes("invoice.paid"));
  assert.ok(json.events.includes("escrow.released"));
  assert.ok(json.zapier.length > 0 && json.make.length > 0);
  assert.equal(json.example.event, "invoice.paid");
});

test("route POST: event tak dikenal -> 400; valid tanpa URL -> stub sukses", async () => {
  process.env.OUTBOUND_WEBHOOK_SECRET = SECRET;
  delete process.env.OUTBOUND_WEBHOOK_URL;
  try {
    const bad = await outboundPOST(new Request("http://x/api/webhooks/outbound", {
      method: "POST",
      body: JSON.stringify({ event: "invoice.created", data: {} }),
    }));
    assert.equal(bad.status, 400);
    const good = await outboundPOST(new Request("http://x/api/webhooks/outbound", {
      method: "POST",
      body: JSON.stringify({ event: "invoice.paid", data: { invoiceId: "inv_1" } }),
    }));
    const json = (await good.json()) as { success: boolean; delivery: { stubbed: boolean } };
    assert.equal(json.success, true);
    assert.equal(json.delivery.stubbed, true);
  } finally {
    restoreEnv();
  }
});
