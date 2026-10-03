import assert from "node:assert/strict";
import test from "node:test";

import { STUDIO_ROLES, can, type StudioAction } from "../lib/studio-roles";

const ALL: StudioAction[] = [
  "project.read",
  "project.write",
  "invoice.read",
  "invoice.write",
  "payout.request",
  "payout.approve",
  "member.invite",
  "member.remove",
  "settings.write",
  "dispute.resolve",
];

test("Owner boleh semua aksi", () => {
  for (const a of ALL) assert.equal(can(a, "Owner"), true, a);
});

test("Viewer read-only (project.read saja)", () => {
  assert.equal(can("project.read", "Viewer"), true);
  for (const a of ALL.filter((x) => x !== "project.read")) {
    assert.equal(can(a, "Viewer"), false, a);
  }
});

test("Finance: baca/tulis invoice + request payout, tanpa approve/invite", () => {
  assert.equal(can("invoice.read", "Finance"), true);
  assert.equal(can("invoice.write", "Finance"), true);
  assert.equal(can("payout.request", "Finance"), true);
  assert.equal(can("payout.approve", "Finance"), false);
  assert.equal(can("member.invite", "Finance"), false);
  assert.equal(can("project.write", "Finance"), false);
});

test("Admin: semua kecuali member.remove", () => {
  for (const a of ALL.filter((x) => x !== "member.remove")) {
    assert.equal(can(a, "Admin"), true, a);
  }
  assert.equal(can("member.remove", "Admin"), false);
});

test("aksi tak dikenal -> false; daftar peran lengkap", () => {
  assert.equal(can("server.reboot" as StudioAction, "Owner"), false);
  assert.deepEqual(STUDIO_ROLES, ["Owner", "Admin", "Finance", "Viewer"]);
});
