import assert from "node:assert/strict";
import test from "node:test";

import {
  TOR_FUNDING_THRESHOLD,
  scoreTor,
  shouldBlockFunding,
  type TorInput,
} from "../services/ai/tor-score";

const FULL: TorInput = {
  scope: "Buatkan website company profile 5 halaman plus blog.",
  deliverables: ["Desain Figma", "Website live", "Dokumentasi"],
  deadline: "2026-12-31",
  price: 5_000_000,
  revisions: 2,
};

test("TOR lengkap = 100, tidak diblokir", () => {
  const r = scoreTor(FULL);
  assert.equal(r.score, 100);
  assert.deepEqual(r.missing, []);
  assert.equal(shouldBlockFunding(r), false);
});

test("tanpa scope = 75, tetap lolos", () => {
  const r = scoreTor({ ...FULL, scope: "" });
  assert.equal(r.score, 75);
  assert.deepEqual(r.missing, ["scope"]);
  assert.equal(shouldBlockFunding(r), false);
});

test("tanpa deliverable = 75", () => {
  const r = scoreTor({ ...FULL, deliverables: [] });
  assert.equal(r.score, 75);
  assert.deepEqual(r.missing, ["deliverables"]);
});

test("tanpa deadline = 80", () => {
  const r = scoreTor({ ...FULL, deadline: null });
  assert.equal(r.score, 80);
  assert.deepEqual(r.missing, ["deadline"]);
});

test("tanpa harga = 80", () => {
  const r = scoreTor({ ...FULL, price: null });
  assert.equal(r.score, 80);
  assert.deepEqual(r.missing, ["price"]);
});

test("tanpa revisi = 90 (revisi 0 tetap valid)", () => {
  const r = scoreTor({ ...FULL, revisions: 0 });
  assert.equal(r.score, 100);
  const r2 = scoreTor({ ...FULL, revisions: undefined });
  assert.equal(r2.score, 90);
  assert.deepEqual(r2.missing, ["revisions"]);
});

test("scope < 20 karakter dihitung kosong", () => {
  const r = scoreTor({ ...FULL, scope: "web" });
  assert.equal(r.score, 75);
  assert.ok(r.missing.includes("scope"));
});

test("harga 0 / negatif dihitung kosong", () => {
  assert.equal(scoreTor({ ...FULL, price: 0 }).score, 80);
  assert.equal(scoreTor({ ...FULL, price: -100 }).score, 80);
});

test("deadline tak valid dihitung kosong", () => {
  const r = scoreTor({ ...FULL, deadline: "kapan-kapan" });
  assert.equal(r.score, 80);
  assert.ok(r.missing.includes("deadline"));
});

test("semua kosong = 0, diblokir", () => {
  const r = scoreTor({});
  assert.equal(r.score, 0);
  assert.equal(r.missing.length, 5);
  assert.equal(shouldBlockFunding(r), true);
});

test("batas threshold: 69 blokir, 70 lolos", () => {
  assert.equal(TOR_FUNDING_THRESHOLD, 70);
  assert.equal(shouldBlockFunding(69), true);
  assert.equal(shouldBlockFunding(70), false);
  assert.equal(shouldBlockFunding(100), false);
});

test("hanya scope + deliverable (50) = diblokir", () => {
  const r = scoreTor({
    scope: "Buatkan logo dan kartu nama untuk kopi kenangan baru.",
    deliverables: ["Logo", "Kartu nama"],
  });
  assert.equal(r.score, 50);
  assert.equal(shouldBlockFunding(r), true);
});

test("shouldBlockFunding terima angka mentah", () => {
  assert.equal(shouldBlockFunding(0), true);
  assert.equal(shouldBlockFunding(71), false);
});
