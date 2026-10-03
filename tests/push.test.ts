import assert from "node:assert/strict";
import test from "node:test";

import {
  getVapidPublicKey,
  isPushConfigured,
  sendPush,
  type WebPushSubscription,
} from "../lib/push";

const SAVED = {
  pub: process.env.VAPID_PUBLIC_KEY,
  priv: process.env.VAPID_PRIVATE_KEY,
  sub: process.env.VAPID_SUBJECT,
};
function clearVapid() {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
}
function restoreVapid() {
  if (SAVED.pub !== undefined) process.env.VAPID_PUBLIC_KEY = SAVED.pub;
  else delete process.env.VAPID_PUBLIC_KEY;
  if (SAVED.priv !== undefined) process.env.VAPID_PRIVATE_KEY = SAVED.priv;
  else delete process.env.VAPID_PRIVATE_KEY;
  if (SAVED.sub !== undefined) process.env.VAPID_SUBJECT = SAVED.sub;
  else delete process.env.VAPID_SUBJECT;
}

const sub: WebPushSubscription = {
  endpoint: "https://push.example.com/sub/1",
  keys: { p256dh: "k1", auth: "k2" },
};

test("push: subscription/payload invalid -> stub gagal elegan", async () => {
  assert.deepEqual(await sendPush(null, { title: "t", body: "b" }), {
    ok: false,
    stubbed: true,
    error: "invalid-subscription-or-payload",
  });
  assert.equal((await sendPush(sub, { title: "", body: "b" })).ok, false);
});

test("push: tanpa VAPID env -> stub sukses (tidak crash)", async () => {
  clearVapid();
  try {
    assert.equal(isPushConfigured(), false);
    assert.equal(getVapidPublicKey(), null);
    const r = await sendPush(sub, { title: "Invoice dibayar", body: "Rp1.500.000" });
    assert.equal(r.ok, true);
    assert.equal(r.stubbed, true);
  } finally {
    restoreVapid();
  }
});

test("push: VAPID terisi tapi lib web-push belum diinstal -> stub", async () => {
  process.env.VAPID_PUBLIC_KEY = "BK-test";
  process.env.VAPID_PRIVATE_KEY = "test";
  process.env.VAPID_SUBJECT = "mailto:test@veritas.id";
  try {
    assert.equal(isPushConfigured(), true);
    assert.equal(getVapidPublicKey(), "BK-test");
    const r = await sendPush(sub, { title: "Dispute dibuka", body: "segera respons" });
    assert.equal(r.ok, true);
    assert.equal(r.stubbed, true);
  } finally {
    restoreVapid();
  }
});
