import assert from "node:assert/strict";
import test from "node:test";

import { CouponService, calcCouponDiscount } from "../services/coupon-service";

type Row = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOff: bigint | null;
  maxUses: number | null;
  usedCount: number;
};

function createMockDb(seed: Row[] = []) {
  const rows = new Map<string, Row>(seed.map((r) => [r.code, { ...r }]));
  let updates = 0;
  const db = {
    coupon: {
      findUnique: async (q: { where: { code: string } }) =>
        rows.get(q.where.code) ?? null,
      create: async (q: { data: Omit<Row, "id"> }) => {
        const row = { id: `c-${rows.size + 1}`, ...q.data };
        rows.set(row.code, row);
        return row;
      },
      update: async (q: { where: { id: string }; data: { usedCount: number } }) => {
        updates++;
        const row = [...rows.values()].find((r) => r.id === q.where.id);
        assert.ok(row, "row must exist");
        row.usedCount = q.data.usedCount;
        return row;
      },
    },
  };
  return { db, rows, get updates() { return updates; } };
}

test("create validasi: kode kosong / persen di luar 1-100 / tanpa diskon = ditolak", async () => {
  const { db } = createMockDb();
  const svc = new CouponService(db as never);
  await assert.rejects(() => svc.createCoupon({ code: "  ", percentOff: 10 }), /bad_input/);
  await assert.rejects(() => svc.createCoupon({ code: "X", percentOff: 0 }), /bad_input/);
  await assert.rejects(() => svc.createCoupon({ code: "X", percentOff: 101 }), /bad_input/);
  await assert.rejects(() => svc.createCoupon({ code: "X", amountOff: 0 }), /bad_input/);
  await assert.rejects(() => svc.createCoupon({ code: "X" }), /bad_input/);
  await assert.rejects(() => svc.createCoupon({ code: "X", percentOff: 10, maxUses: 0 }), /bad_input/);

  const ok = (await svc.createCoupon({ code: " hemat-10 ", percentOff: 10, maxUses: 100 })) as Row;
  assert.equal(ok.code, "HEMAT-10");
  assert.equal(ok.usedCount, 0);
  await assert.rejects(() => svc.createCoupon({ code: "hemat-10", percentOff: 5 }), /duplicate_code/);
});

test("coupon over maxUses = ditolak (validate + use, usedCount tidak nambah)", async () => {
  const store = createMockDb([
    { id: "c1", code: "HABIS", percentOff: 20, amountOff: null, maxUses: 1, usedCount: 1 },
  ]);
  const svc = new CouponService(store.db as never);
  await assert.rejects(() => svc.validateCoupon("HABIS", 100_000), /exhausted/);
  await assert.rejects(() => svc.useCoupon("HABIS", 100_000), /exhausted/);
  assert.equal(store.updates, 0);
  assert.equal(store.rows.get("HABIS")?.usedCount, 1);
});

test("validate hitung diskon persen + sisa kuota; use nambah usedCount 1", async () => {
  const store = createMockDb([
    { id: "c1", code: "DISKON10", percentOff: 10, amountOff: null, maxUses: 5, usedCount: 2 },
  ]);
  const svc = new CouponService(store.db as never);
  const v = await svc.validateCoupon("DISKON10", 100_000n);
  assert.equal(v.discount, 10_000n);
  assert.equal(v.remaining, 3);

  const u = await svc.useCoupon("DISKON10", 100_000n);
  assert.equal(u.coupon.usedCount, 3);
  assert.equal(store.updates, 1);
});

test("amountOff di-cap ke subtotal; kupon tanpa maxUses = unlimited", async () => {
  assert.equal(
    calcCouponDiscount({ percentOff: null, amountOff: 50_000n }, 30_000n),
    30_000n,
  );
  assert.equal(
    calcCouponDiscount({ percentOff: 10, amountOff: null }, null),
    0n, // persen tanpa subtotal = 0
  );
  const store = createMockDb([
    { id: "c1", code: "FOREVER", percentOff: null, amountOff: 5_000n, maxUses: null, usedCount: 999 },
  ]);
  const v = await new CouponService(store.db as never).validateCoupon("FOREVER", 100_000n);
  assert.equal(v.discount, 5_000n);
  assert.equal(v.remaining, null);
});

test("kode tak dikenal = not_found", async () => {
  const { db } = createMockDb();
  await assert.rejects(
    () => new CouponService(db as never).validateCoupon("TIDAK-ADA"),
    /not_found/,
  );
});
