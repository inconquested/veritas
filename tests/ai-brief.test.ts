import assert from "node:assert/strict";
import test from "node:test";

import { stubComplete } from "../services/ai/ai-service";
import {
  generateBrief,
  parseBrief,
} from "../services/ai/brief-generator";

// Stub mode: tanpa AI_API_KEY semua harus hasilkan struktur valid.
delete process.env.AI_API_KEY;

const CHAT = `Halo mas, saya mau buatkan website company profile 5 halaman.
- Desain homepage + 4 halaman dalam
- Form kontak nyambung ke WA 081234567890
- Budget sekitar 5 juta, butuh dalam 2 minggu ya`;

test("stub mode: struktur valid dari chat nyata", async () => {
  const b = await generateBrief(CHAT);
  assert.equal(typeof b.scope, "string");
  assert.ok(b.scope.length > 0);
  assert.ok(Array.isArray(b.milestones) && b.milestones.length >= 2);
  assert.equal(typeof b.estimate, "string");
  assert.ok(Array.isArray(b.redFlags));
});

test("stubComplete tidak bocorkan PII", () => {
  const r = stubComplete("WA 081234567890 email a@b.co");
  assert.equal(r.stub, true);
  assert.ok(!r.text.includes("081234567890"));
  assert.ok(!r.text.includes("a@b.co"));
});

test("parseBrief: bullets jadi milestones", () => {
  const b = parseBrief("- Logo\n- Kartu nama\n- Kop surat");
  assert.equal(b.milestones.length, 3);
  assert.equal(b.milestones[0].title, "Logo");
});

test("parseBrief: estimasi minggu → hari", () => {
  const b = parseBrief("Butuhkan website, waktu 2 minggu, budget 5 juta");
  assert.equal(b.estimate, "±14 hari");
});

test("parseBrief: tanpa durasi/deadline → flag + estimasi kosong", () => {
  const b = parseBrief("Buatkan website company profile yang bagus dan modern untuk usaha kami tercinta");
  assert.equal(b.estimate, "Belum ada estimasi");
  assert.ok(b.redFlags.some((f) => f.includes("deadline")));
});

test("parseBrief: tanpa budget → red flag budget", () => {
  const b = parseBrief(
    "Buatkan aplikasi kasir lengkap dengan laporan harian dan manajemen stok barang toko kami",
  );
  assert.ok(b.redFlags.some((f) => f.includes("budget")));
});

test("parseBrief: scope kabur → red flag", () => {
  const b = parseBrief("halo mas bisa bantu?");
  assert.ok(b.redFlags.some((f) => f.includes("Scope kabur")));
});

test("parseBrief: chat kosong → struktur valid + flag", () => {
  const b = parseBrief("   ");
  assert.deepEqual(b.milestones, []);
  assert.equal(b.estimate, "Belum ada estimasi");
  assert.ok(b.redFlags.length > 0);
});

test("generateBrief: completeFn error → fallback parse", async () => {
  const b = await generateBrief(CHAT, async () => {
    throw new Error("down");
  });
  assert.ok(b.milestones.length >= 2);
});

test("generateBrief: JSON AI valid dipakai", async () => {
  const b = await generateBrief("apapun", async () => ({
    text: JSON.stringify({
      scope: "AI scope",
      milestones: [{ title: "M1" }, { title: "M2" }],
      estimate: "±7 hari",
      redFlags: ["f1"],
    }),
    stub: false,
    model: "fake",
  }));
  assert.equal(b.scope, "AI scope");
  assert.equal(b.milestones.length, 2);
  assert.equal(b.estimate, "±7 hari");
});

test("generateBrief: JSON AI rusak → fallback parse", async () => {
  const b = await generateBrief(CHAT, async () => ({
    text: "bukan json {{{",
    stub: false,
    model: "fake",
  }));
  assert.ok(b.milestones.length >= 2);
});
