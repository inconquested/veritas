import assert from "node:assert/strict";
import test from "node:test";

import {
  PayoutService,
  payoutMinimumForBank,
  type PayoutRow,
} from "../services/payout-service";

function uniqueError() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

function createMockDb(seed: PayoutRow[] = []) {
  const rows: PayoutRow[] = [...seed];
  const db = {
    payout: {
      findUnique: async (args: {
        where: { id?: string; idempotencyKey?: string };
      }) => {
        if (args.where.idempotencyKey != null) {
          return (
            rows.find((r) => r.idempotencyKey === args.where.idempotencyKey) ??
            null
          );
        }
        return rows.find((r) => r.id === args.where.id) ?? null;
      },
      findMany: async () => [...rows],
      create: async (args: { data: Omit<PayoutRow, "id"> }) => {
        if (
          args.data.idempotencyKey &&
          rows.some((r) => r.idempotencyKey === args.data.idempotencyKey)
        ) {
          throw uniqueError();
        }
        const row: PayoutRow = { id: `p${rows.length + 1}`, ...args.data };
        rows.push(row);
        return row;
      },
      update: async (args: { where: { id: string }; data: Partial<PayoutRow> }) => {
        const row = rows.find((r) => r.id === args.where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, args.data);
        return row;
      },
    },
  };
  return { db, rows };
}

const BASE = {
  freelancerId: "fl-1",
  bank: "BCA",
  accountNo: "8210123456",
};

test("minimum: BCA/Mandiri/BNI Rp10rb, bank lain Rp57.500", () => {
  assert.equal(payoutMinimumForBank("BCA"), 10_000);
  assert.equal(payoutMinimumForBank("mandiri"), 10_000);
  assert.equal(payoutMinimumForBank("bni"), 10_000);
  assert.equal(payoutMinimumForBank("BRI"), 57_500);
  assert.equal(payoutMinimumForBank("BANK LAIN"), 57_500);
});

test("payout di bawah minimal = tolak", async () => {
  const { db } = createMockDb();
  const service = new PayoutService(db as never);
  await assert.rejects(
    () => service.requestPayout({ ...BASE, amount: 9_999, idempotencyKey: "k1-valid-key" }),
    /below_minimum/,
  );
  await assert.rejects(
    () =>
      service.requestPayout({
        ...BASE,
        bank: "BRI",
        amount: 57_499,
        idempotencyKey: "k2-valid-key",
      }),
    /below_minimum/,
  );
  // Batas pas: lolos
  const ok = await service.requestPayout({
    ...BASE,
    bank: "BRI",
    amount: 57_500,
    idempotencyKey: "k3-valid-key",
  });
  assert.equal(ok.status, "QUEUED");
});

test("payout double-submit (key sama) = 1 baris", async () => {
  const { db, rows } = createMockDb();
  const service = new PayoutService(db as never);
  const input = { ...BASE, amount: 100_000, idempotencyKey: "double-click-key" };
  const first = await service.requestPayout(input);
  const second = await service.requestPayout(input);
  assert.equal(first.id, second.id);
  assert.equal(rows.length, 1);
});

test("balapan konkuren (P2002) kembali ke baris pemenang", async () => {
  const winner: PayoutRow = {
    id: "p-win",
    freelancerId: "fl-1",
    amount: 100_000n,
    bank: "BCA",
    accountNo: "8210123456",
    status: "QUEUED",
    extRef: null,
    idempotencyKey: "race-key-123",
  };
  let reads = 0;
  const db = {
    payout: {
      findUnique: async () => (reads++ === 0 ? null : winner),
      findMany: async () => [winner],
      create: async () => {
        throw uniqueError();
      },
      update: async () => winner,
    },
  };
  const service = new PayoutService(db as never);
  const row = await service.requestPayout({
    ...BASE,
    amount: 100_000,
    idempotencyKey: "race-key-123",
  });
  assert.equal(row.id, "p-win");
});

test("markDone QUEUED -> DONE, idempoten diulang", async () => {
  const { db } = createMockDb([
    {
      id: "p1",
      freelancerId: "fl-1",
      amount: 50_000n,
      bank: "BNI",
      accountNo: "1234567890",
      status: "QUEUED",
      extRef: null,
      idempotencyKey: "seed-key-1",
    },
  ]);
  const service = new PayoutService(db as never);
  const done = await service.markDone("p1", "REF-BANK-1");
  assert.equal(done.status, "DONE");
  assert.equal(done.extRef, "REF-BANK-1");
  const again = await service.markDone("p1");
  assert.equal(again.status, "DONE");
  await assert.rejects(() => service.markFailed("p1"), /bad_status/);
});

test("markDone id tak dikenal = not_found; input invalid ditolak", async () => {
  const { db } = createMockDb();
  const service = new PayoutService(db as never);
  await assert.rejects(() => service.markDone("nope"), /not_found/);
  await assert.rejects(
    () => service.requestPayout({ ...BASE, amount: 50_000, idempotencyKey: "short" }),
    /invalid_key/,
  );
  await assert.rejects(
    () =>
      service.requestPayout({
        ...BASE,
        amount: 50_000,
        accountNo: "12",
        idempotencyKey: "valid-key-acc",
      }),
    /invalid_account/,
  );
});
