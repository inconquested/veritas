import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetRateLimitForTests,
  checkRateLimit,
  checkRateLimitSync,
} from "../lib/rate-limit";
import { portalRateLimit } from "../lib/portal-rate-limit";

const SAVED = {
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
};

function clearUpstashEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}
function restoreUpstashEnv() {
  if (SAVED.url !== undefined) process.env.UPSTASH_REDIS_REST_URL = SAVED.url;
  else delete process.env.UPSTASH_REDIS_REST_URL;
  if (SAVED.token !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = SAVED.token;
  else delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

test("sync: di bawah limit lolos, di atas limit ditolak + retryAfter", () => {
  __resetRateLimitForTests();
  const key = `t1:${Date.now()}`;
  for (let i = 0; i < 3; i++) {
    assert.equal(checkRateLimitSync(key, { limit: 3, windowMs: 60_000 }).ok, true);
  }
  const blocked = checkRateLimitSync(key, { limit: 3, windowMs: 60_000 });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec > 0);
});

test("sync fixed-window (portal): jendela baru mereset hitungan", async () => {
  __resetRateLimitForTests();
  const key = `t2:${Date.now()}`;
  assert.equal(checkRateLimitSync(key, { limit: 1, windowMs: 30, baseBackoffMs: false }).ok, true);
  assert.equal(checkRateLimitSync(key, { limit: 1, windowMs: 30, baseBackoffMs: false }).ok, false);
  await new Promise((r) => setTimeout(r, 45));
  assert.equal(checkRateLimitSync(key, { limit: 1, windowMs: 30, baseBackoffMs: false }).ok, true);
});

test("sync: backoff API menahan request beruntun (blockedUntil)", () => {
  __resetRateLimitForTests();
  const key = `t3:${Date.now()}`;
  checkRateLimitSync(key, { limit: 1, windowMs: 60_000 });
  const first = checkRateLimitSync(key, { limit: 1, windowMs: 60_000 });
  assert.equal(first.ok, false);
  assert.equal(first.retryAfterSec, 2);
  const second = checkRateLimitSync(key, { limit: 1, windowMs: 60_000 });
  assert.equal(second.ok, false);
  assert.ok(second.retryAfterSec >= 1);
});

test("shared: portal + API pakai satu store (konsisten lintas call)", () => {
  __resetRateLimitForTests();
  const key = `shared:${Date.now()}`;
  for (let i = 0; i < 30; i++) assert.equal(portalRateLimit(key).ok, true);
  assert.equal(portalRateLimit(key).ok, false);
  // Store yang sama: kunci namespaced portal:* terlihat dari lib bersama.
  const viaShared = checkRateLimitSync(`portal:${key}`, {
    limit: 30,
    windowMs: 60_000,
    baseBackoffMs: false,
  });
  assert.equal(viaShared.ok, false);
  // Namespace lain tidak ikut terblokir.
  assert.equal(portalRateLimit(`other:${Date.now()}`).ok, true);
});

test("async: tanpa env Upstash = fallback memory", async () => {
  __resetRateLimitForTests();
  clearUpstashEnv();
  try {
    const key = `t5:${Date.now()}`;
    assert.equal((await checkRateLimit(key, { limit: 1, windowMs: 60_000 })).ok, true);
    assert.equal((await checkRateLimit(key, { limit: 1, windowMs: 60_000 })).ok, false);
  } finally {
    restoreUpstashEnv();
  }
});

test("async: Upstash sukses — counter remote otoritatif", async () => {
  __resetRateLimitForTests();
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  try {
    const okFetch = (async (url: string) => {
      const u = String(url);
      if (u.includes("/incr/")) return new Response(JSON.stringify({ result: 1 }), { status: 200 });
      if (u.includes("/expire/")) return new Response(JSON.stringify({ result: 1 }), { status: 200 });
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    const r = await checkRateLimit(`t6:${Date.now()}`, { limit: 60 }, okFetch);
    assert.equal(r.ok, true);
  } finally {
    restoreUpstashEnv();
  }
});

test("async: Upstash over-limit memakai TTL remote", async () => {
  __resetRateLimitForTests();
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  try {
    const overFetch = (async (url: string) => {
      const u = String(url);
      if (u.includes("/incr/")) return new Response(JSON.stringify({ result: 61 }), { status: 200 });
      if (u.includes("/ttl/")) return new Response(JSON.stringify({ result: 42 }), { status: 200 });
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    const r = await checkRateLimit(`t7:${Date.now()}`, { limit: 60 }, overFetch);
    assert.equal(r.ok, false);
    assert.equal(r.retryAfterSec, 42);
  } finally {
    restoreUpstashEnv();
  }
});

test("async: Upstash error = fallback memory (tidak fail-closed)", async () => {
  __resetRateLimitForTests();
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  try {
    const boom = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const r = await checkRateLimit(`t8:${Date.now()}`, { limit: 5 }, boom);
    assert.equal(r.ok, true);
  } finally {
    restoreUpstashEnv();
  }
});
