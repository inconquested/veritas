import assert from "node:assert/strict";
import test from "node:test";

import { classifyDigitRun, containsPII, redactPII } from "../lib/redact";

test("email tersensor", () => {
  const { text, redacted } = redactPII("hubungi budi@gmail.com ya");
  assert.equal(text, "hubungi [email disensor] ya");
  assert.equal(redacted.email, 1);
  assert.equal(containsPII(text), false);
});

test("banyak email sekaligus tersensor", () => {
  const { text, redacted } = redactPII("a@x.co dan b@y.id");
  assert.equal(redacted.email, 2);
  assert.ok(!text.includes("@"));
});

test("nomor WA 08xx tersensor", () => {
  const { text, redacted } = redactPII("WA saya 081234567890");
  assert.equal(text, "WA saya [nomor disensor]");
  assert.equal(redacted.phone, 1);
  assert.equal(containsPII(text), false);
});

test("nomor +62 dengan spasi/dash tersensor", () => {
  const { text } = redactPII("hubungi +62 812-3456-7890 segera");
  assert.ok(text.includes("[nomor disensor]"));
  assert.ok(!text.includes("812"));
});

test("nomor 62 tanpa plus tersensor", () => {
  const { text, redacted } = redactPII("kirim ke 6281234567890");
  assert.equal(redacted.phone, 1);
  assert.ok(!text.includes("6281234567890"));
});

test("nomor rekening bank tersensor", () => {
  const { text, redacted } = redactPII("transfer ke BCA 1234567890 a.n Budi");
  assert.equal(redacted.account, 1);
  assert.ok(text.includes("[rekening disensor]"));
  assert.ok(!text.includes("1234567890"));
});

test("angka pendek (tahun/nominal kecil) dibiarkan", () => {
  const { text } = redactPII("deadline 2026, budget 5 juta");
  assert.equal(text, "deadline 2026, budget 5 juta");
  assert.equal(containsPII(text), false);
});

test("teks bersih → containsPII false, tanpa perubahan", () => {
  const { text, redacted } = redactPII("buatkan website company profile");
  assert.equal(text, "buatkan website company profile");
  assert.deepEqual(redacted, { email: 0, phone: 0, account: 0 });
});

test("campuran email + WA + rekening sekaligus", () => {
  const { text } = redactPII(
    "saya rina@mail.com, WA 081111222333, BCA 9876543210987654",
  );
  assert.ok(text.includes("[email disensor]"));
  assert.ok(text.includes("[nomor disensor]"));
  assert.ok(text.includes("[rekening disensor]"));
  assert.equal(containsPII(text), false);
  assert.equal(containsPII("rina@mail.com"), true);
});
