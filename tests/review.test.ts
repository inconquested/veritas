import assert from "node:assert/strict";
import test from "node:test";

import { ReviewService } from "../services/review-service";

function createMockDb(opts: {
  paidIds?: string[];
  escrowStatus?: Record<string, string>;
  existingReview?: boolean;
} = {}) {
  const created: unknown[] = [];
  const db = {
    invoice: {
      findMany: async () => (opts.paidIds ?? []).map((id) => ({ id })),
    },
    escrow: {
      findMany: async (q: {
        where: { invoiceId: { in: string[] } };
      }) =>
        q.where.invoiceId.in.map((id) => ({
          status: opts.escrowStatus?.[id] ?? "FUNDS_HELD",
        })),
    },
    review: {
      findUnique: async () =>
        opts.existingReview ? { id: "r1" } : null,
      create: async (q: { data: Record<string, unknown> }) => {
        const row = { id: "r-new", ...q.data };
        created.push(row);
        return row;
      },
    },
  };
  return { db, created };
}

test("review tanpa invoice PAID = ditolak", async () => {
  const { db, created } = createMockDb({ paidIds: [] });
  const service = new ReviewService(db as never);
  await assert.rejects(
    () => service.submitReview({ project_id: "p1", rating: 5, text: "Bagus" }),
    /unpaid/,
  );
  assert.equal(created.length, 0);
});

test("review PAID tapi escrow belum RELEASED = ditolak", async () => {
  const { db, created } = createMockDb({
    paidIds: ["inv1"],
    escrowStatus: { inv1: "FUNDS_HELD" },
  });
  const service = new ReviewService(db as never);
  await assert.rejects(
    () => service.submitReview({ project_id: "p1", rating: 5 }),
    /escrow_not_released/,
  );
  assert.equal(created.length, 0);
});

test("PAID + RELEASED = tersimpan dengan verifiedAt", async () => {
  const { db, created } = createMockDb({
    paidIds: ["inv1", "inv2"],
    escrowStatus: { inv1: "FUNDS_HELD", inv2: "RELEASED" },
  });
  const service = new ReviewService(db as never);
  const row = (await service.submitReview({
    project_id: "p1",
    rating: 4,
    text: "  Rapi dan cepat  ",
  })) as { verifiedAt: Date; rating: number; text: string };
  assert.equal(row.rating, 4);
  assert.equal(row.text, "Rapi dan cepat");
  assert.ok(row.verifiedAt instanceof Date);
  assert.equal(created.length, 1);
});

test("rating di luar 1-5 / dobel review = ditolak", async () => {
  const { db } = createMockDb({
    paidIds: ["inv1"],
    escrowStatus: { inv1: "RELEASED" },
  });
  const service = new ReviewService(db as never);
  await assert.rejects(() => service.submitReview({ project_id: "p1", rating: 0 }), /invalid_rating/);
  await assert.rejects(() => service.submitReview({ project_id: "p1", rating: 6 }), /invalid_rating/);

  const { db: db2 } = createMockDb({
    paidIds: ["inv1"],
    escrowStatus: { inv1: "RELEASED" },
    existingReview: true,
  });
  await assert.rejects(
    () => new ReviewService(db2 as never).submitReview({ project_id: "p1", rating: 5 }),
    /already_exists/,
  );
});
