import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthError,
  authErrorResponse,
  invoiceScopeWhere,
  normalizeRole,
  projectScopeWhere,
  requireRole,
  roleFromMetadata,
  type AuthUser,
} from "../services/auth-context";
import {
  requireClient,
  requireFreelancer,
  requireRole as requireRoleServer,
} from "../lib/auth-server";

const freelancer: AuthUser = {
  id: "u-f",
  clerkUserId: "clerk-f",
  role: "FREELANCER",
  email: "f@x.id",
  freelancerProfileId: "fp-1",
};
const client: AuthUser = {
  id: "u-c",
  clerkUserId: "clerk-c",
  role: "CLIENT",
  email: "c@x.id",
  freelancerProfileId: null,
};

test("normalizeRole: freelancer (lower/upper) -> FREELANCER", () => {
  assert.equal(normalizeRole("freelancer"), "FREELANCER");
  assert.equal(normalizeRole("FREELANCER"), "FREELANCER");
});

test("normalizeRole: tanpa klaim/eskalasi (ADMIN/garbage/kosong) -> CLIENT", () => {
  assert.equal(normalizeRole("client"), "CLIENT");
  assert.equal(normalizeRole(undefined), "CLIENT");
  assert.equal(normalizeRole(""), "CLIENT");
  assert.equal(normalizeRole("admin"), "CLIENT");
  assert.equal(normalizeRole("OWNER"), "CLIENT");
});

test("roleFromMetadata: privateMetadata menang; publik saja = diabaikan (hardened)", () => {
  const raw = roleFromMetadata({
    publicMetadata: { role: "freelancer" },
    privateMetadata: { role: "client" },
  });
  assert.equal(raw, "client");
  assert.equal(normalizeRole(raw), "CLIENT");
});

test("roleFromMetadata: tanpa private = null (wajib onboarding ulang)", () => {
  assert.equal(roleFromMetadata({ publicMetadata: { role: "freelancer" } }), undefined);
  assert.equal(roleFromMetadata(null), undefined);
  assert.equal(roleFromMetadata({}), undefined);
});

test("requireRole: peran cocok lolos tanpa throw", () => {
  requireRole(freelancer, "FREELANCER");
  requireRole(client, "CLIENT");
});

test("requireRole: CLIENT menyamar FREELANCER ditolak (FORBIDDEN)", () => {
  assert.throws(() => requireRole(client, "FREELANCER"), (e: unknown) => {
    assert.ok(e instanceof AuthError);
    assert.equal(e.code, "FORBIDDEN");
    return true;
  });
});

test("requireRole: FREELANCER menyamar CLIENT ditolak (FORBIDDEN)", () => {
  assert.throws(() => requireRole(freelancer, "CLIENT"), (e: unknown) => {
    assert.ok(e instanceof AuthError && e.code === "FORBIDDEN");
    return true;
  });
});

test("authErrorResponse: mapping status + null untuk non-AuthError", () => {
  assert.deepEqual(authErrorResponse(new AuthError("x", "FORBIDDEN")), {
    status: 403,
    body: { success: false, errorKey: "errors.auth.forbidden" },
  });
  assert.deepEqual(authErrorResponse(new AuthError("x", "UNAUTHENTICATED")), {
    status: 401,
    body: { success: false, errorKey: "errors.auth.unauthenticated" },
  });
  assert.deepEqual(authErrorResponse(new AuthError("x", "NOT_FOUND")), {
    status: 404,
    body: { success: false, errorKey: "errors.notExist" },
  });
  assert.equal(authErrorResponse(new Error("boom")), null);
});

test("auth-server: tanpa session ditolak (UNAUTHENTICATED)", async () => {
  await assert.rejects(() => requireRoleServer("FREELANCER", async () => null), (e: unknown) => {
    assert.ok(e instanceof AuthError && e.code === "UNAUTHENTICATED");
    return true;
  });
  await assert.rejects(() => requireFreelancer(async () => null), /Not authenticated/);
  await assert.rejects(() => requireClient(async () => null), /Not authenticated/);
});

test("auth-server: requireFreelancer menolak CLIENT yang menyamar", async () => {
  await assert.rejects(() => requireFreelancer(async () => client), (e: unknown) => {
    assert.ok(e instanceof AuthError && e.code === "FORBIDDEN");
    return true;
  });
  const ok = await requireFreelancer(async () => freelancer);
  assert.equal(ok.id, freelancer.id);
});

test("auth-server: requireClient menolak FREELANCER yang menyamar", async () => {
  await assert.rejects(() => requireClient(async () => freelancer), (e: unknown) => {
    assert.ok(e instanceof AuthError && e.code === "FORBIDDEN");
    return true;
  });
  const ok = await requireClient(async () => client);
  assert.equal(ok.id, client.id);
});

test("scope: freelancer vs client terisolasi", () => {
  assert.deepEqual(projectScopeWhere(freelancer), { freelancerId: "u-f" });
  assert.deepEqual(projectScopeWhere(client), { clientId: "u-c" });
  assert.deepEqual(invoiceScopeWhere(freelancer), { project: { freelancerId: "u-f" } });
  assert.deepEqual(invoiceScopeWhere(client), { project: { clientId: "u-c" } });
});
