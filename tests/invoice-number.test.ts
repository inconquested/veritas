import assert from "node:assert/strict";
import test from "node:test";

import {
  formatInvoiceNumber,
  isTerminSettled,
  nextInvoiceNumber,
  sumTerminAmounts,
} from "../services/invoice-number";

type NumRow = { number: string | null; freelancerId: string };

function mockDb(rows: NumRow[]) {
  return {
    invoice: {
      findMany: async (args: {
        where: { freelancerId: string; number: { startsWith: string } };
      }) =>
        rows.filter(
          (r) =>
            r.freelancerId === args.where.freelancerId &&
            (r.number ?? "").startsWith(args.where.number.startsWith),
        ),
    },
  };
}

const FL_A = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"; // kode A1B2
const FL_B = "ffff0000-1111-2222-3333-444455556666"; // kode FFFF
const Y2026 = new Date("2026-05-01T00:00:00Z");

test("format: INV/2026/<kode>/<seq 4 digit>", () => {
  assert.equal(formatInvoiceNumber(FL_A, 1, 2026), "INV/2026/A1B2/0001");
  assert.equal(formatInvoiceNumber(FL_A, 42, 2026), "INV/2026/A1B2/0042");
});

test("nomor pertama freelancer = 0001", async () => {
  const n = await nextInvoiceNumber(FL_A, mockDb([]) as never, Y2026);
  assert.equal(n, "INV/2026/A1B2/0001");
});

test("nomor berurutan mengikuti max yang ada", async () => {
  const db = mockDb([
    { freelancerId: FL_A, number: "INV/2026/A1B2/0001" },
    { freelancerId: FL_A, number: "INV/2026/A1B2/0002" },
  ]);
  assert.equal(await nextInvoiceNumber(FL_A, db as never, Y2026), "INV/2026/A1B2/0003");
});

test("unik per freelancer: freelancer lain mulai dari 0001", async () => {
  const db = mockDb([{ freelancerId: FL_A, number: "INV/2026/A1B2/0007" }]);
  assert.equal(await nextInvoiceNumber(FL_B, db as never, Y2026), "INV/2026/FFFF/0001");
  assert.equal(await nextInvoiceNumber(FL_A, db as never, Y2026), "INV/2026/A1B2/0008");
});

test("tahun dan nomor rusak diabaikan", async () => {
  const db = mockDb([
    { freelancerId: FL_A, number: "INV/2025/A1B2/0099" },
    { freelancerId: FL_A, number: "rusak" },
    { freelancerId: FL_A, number: null },
    { freelancerId: FL_A, number: "INV/2026/A1B2/0003" },
  ]);
  assert.equal(await nextInvoiceNumber(FL_A, db as never, Y2026), "INV/2026/A1B2/0004");
});

test("termin DP + pelunasan = nilai kontrak", () => {
  const kontrak = 10_000_000n;
  assert.equal(sumTerminAmounts([3_000_000n, 7_000_000n]), kontrak);
  assert.equal(isTerminSettled(kontrak, [3_000_000n, 7_000_000n]), true);
});

test("termin kurang/lebih dari kontrak = belum settled", () => {
  assert.equal(isTerminSettled(10_000_000n, [3_000_000n]), false);
  assert.equal(isTerminSettled(10_000_000n, [3_000_000n, 8_000_000n]), false);
});
