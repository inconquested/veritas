import assert from "node:assert/strict";
import test from "node:test";

import {
  extractApiKey,
  guardApiKey,
  hasScope,
  inferScope,
  validateApiKey,
} from "../lib/api-key";

const READ = "vr_live_read_abc123";
const WRITE = "vr_live_write_xyz789";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/v1/projects", { headers });
}

test("scope: prefix write vs read", () => {
  assert.equal(inferScope(WRITE), "write");
  assert.equal(inferScope("VR_LIVE_WRITE_UPPER"), "write");
  assert.equal(inferScope(READ), "read");
  assert.equal(inferScope("random-key"), "read");
});

test("hasScope: write mencakup read, read tidak mencakup write", () => {
  assert.equal(hasScope("write", "read"), true);
  assert.equal(hasScope("write", "write"), true);
  assert.equal(hasScope("read", "read"), true);
  assert.equal(hasScope("read", "write"), false);
});

test("extract: Bearer utama, x-api-key fallback", () => {
  assert.equal(extractApiKey(req({ authorization: `Bearer ${READ}` })), READ);
  assert.equal(extractApiKey(req({ "x-api-key": READ })), READ);
  assert.equal(extractApiKey(req()), null);
});

test("validate: allowlist eksplisit, fails closed", () => {
  assert.deepEqual(validateApiKey(null, [READ]), { ok: false, error: "missing", status: 401 });
  assert.deepEqual(validateApiKey("salah", [READ]), { ok: false, error: "invalid", status: 401 });
  assert.deepEqual(validateApiKey(READ, []), { ok: false, error: "invalid", status: 401 });
  const ok = validateApiKey(READ, [READ, WRITE]);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.scope, "read");
  const okW = validateApiKey(WRITE, [READ, WRITE]);
  assert.equal(okW.ok, true);
  if (okW.ok) assert.equal(okW.scope, "write");
});

test("guard: read lolos GET, write-only ditolak untuk read-key", () => {
  const saved = process.env.VERITAS_API_KEY;
  process.env.VERITAS_API_KEY = `${READ},${WRITE}`;
  try {
    const gRead = guardApiKey(req({ authorization: `Bearer ${READ}` }), "read");
    assert.equal(gRead.ok, true);
    const gForbid = guardApiKey(req({ authorization: `Bearer ${READ}` }), "write");
    assert.equal(gForbid.ok, false);
    if (!gForbid.ok) assert.equal(gForbid.response.status, 403);
    const gWrite = guardApiKey(req({ authorization: `Bearer ${WRITE}` }), "write");
    assert.equal(gWrite.ok, true);
    const gMissing = guardApiKey(req(), "read");
    assert.equal(gMissing.ok, false);
    if (!gMissing.ok) assert.equal(gMissing.response.status, 401);
  } finally {
    if (saved === undefined) delete process.env.VERITAS_API_KEY;
    else process.env.VERITAS_API_KEY = saved;
  }
});
