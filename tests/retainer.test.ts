import assert from "node:assert/strict";
import test from "node:test";

import {
  RetainerService,
  type RetainerRow,
} from "../services/retainer-service";

type InvoiceRow = {
  id: string;
  project_id: string;
  type: string;
  createdAt: Date;
};

function createMockDb(seed: RetainerRow[] = []) {
  const retainers: RetainerRow[] = [...seed];
  const invoices: InvoiceRow[] = [];
  let creatorCalls = 0;
  const db = {
    retainer: {
      findMany: async (q: {
        where: { active: boolean; nextRunAt: { lte: Date } };
      }) =>
        retainers.filter(
          (r) =>
            r.active === q.where.active && r.nextRunAt <= q.where.nextRunAt.lte,
        ),
      findUnique: async (q: { where: { id: string } }) =>
        retainers.find((r) => r.id === q.where.id) ?? null,
      create: async (q: { data: Omit<RetainerRow, "id"> }) => {
        const row: RetainerRow = { id: `rt${retainers.length + 1}`, ...q.data };
        retainers.push(row);
        return row;
      },
      update: async (q: { where: { id: string }; data: Partial<RetainerRow> }) => {
        const row = retainers.find((r) => r.id === q.where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, q.data);
        return row;
      },
    },
    invoice: {
      findFirst: async (q: {
        where: {
          project_id: string;
          type: string;
          createdAt: { gte: Date; lt: Date };
        };
      }) =>
        invoices.find(
          (i) =>
            i.project_id === q.where.project_id &&
            i.type === q.where.type &&
            i.createdAt >= q.where.createdAt.gte &&
            i.createdAt < q.where.createdAt.lt,
        ) ?? null,
      findMany: async () => [],
      create: async () => ({ id: "unused" }),
    },
    project: { findUnique: async () => null },
    freelancerProfile: { findFirst: async () => null },
  };
  const creator = async (data: { project_id: string }) => {
    creatorCalls++;
    const row: InvoiceRow = {
      id: `inv${invoices.length + 1}`,
      project_id: data.project_id,
      type: "RETAINER",
      createdAt: new Date(),
    };
    invoices.push(row);
    return row;
  };
  return { db, retainers, invoices, creator, calls: () => creatorCalls };
}

const NOW = new Date(2026, 9, 2, 12, 0, 0); // 2 Okt 2026 siang

test("retainer generate 2x di bulan sama = 1 invoice", async () => {
  const { db, retainers, invoices, creator, calls } = createMockDb([
    {
      id: "rt1",
      project_id: "p1",
      monthlyFee: 1_000_000n,
      nextRunAt: new Date(2026, 9, 1),
      active: true,
    },
  ]);
  const service = new RetainerService(db as never, creator as never);
  const first = await service.runRetainerCycle({ now: NOW });
  assert.equal(first.length, 1);
  assert.ok(first[0].invoiceId);
  // Replay di bulan sama (nextRunAt mundur lagi, mis. retry/cron ganda):
  // guard query menemukan invoice Okt → skip, tanpa invoice ke-2.
  retainers[0].nextRunAt = new Date(2026, 9, 1);
  const replay = await service.runRetainerCycle({ now: NOW });
  assert.equal(replay.length, 1);
  assert.equal(replay[0].invoiceId, first[0].invoiceId);
  assert.equal(invoices.length, 1);
  assert.equal(calls(), 1);
  const second = await service.runRetainerCycle({
    now: new Date(2026, 9, 20),
  });
  // Putaran 2 tidak jatuh tempo lagi (nextRunAt sudah maju) → tak ada kerja.
  assert.equal(second.length, 0);
  assert.equal(invoices.length, 1);
  assert.equal(calls(), 1);
});

test("skip idempoten saat invoice bulan itu sudah ada (guard query)", async () => {
  const { db, invoices } = createMockDb([
    {
      id: "rt1",
      project_id: "p9",
      monthlyFee: 500_000n,
      nextRunAt: new Date(2026, 9, 1),
      active: true,
    },
  ]);
  // Seolah invoice bulan Okt sudah dibuat jalur lain.
  invoices.push({
    id: "inv-ext",
    project_id: "p9",
    type: "RETAINER",
    createdAt: new Date(2026, 9, 5),
  });
  let created = 0;
  const service = new RetainerService(
    db as never,
    (async () => {
      created++;
      return { id: "inv-new" };
    }) as never,
  );
  const res = await service.runRetainerCycle({ now: NOW });
  assert.equal(res.length, 1);
  assert.equal(res[0].invoiceId, "inv-ext");
  assert.equal(created, 0);
  assert.equal(invoices.length, 1);
});

test("fee nol/negatif ditolak; cancel idempoten", async () => {
  const { db, retainers } = createMockDb();
  const service = new RetainerService(db as never, (async () => ({ id: "x" })) as never);
  await assert.rejects(
    () => service.createRetainer({ project_id: "p1", monthlyFee: 0 }),
    /invalid_fee/,
  );
  await assert.rejects(
    () => service.createRetainer({ project_id: "p1", monthlyFee: -100 }),
    /invalid_fee/,
  );
  const rt = await service.createRetainer({ project_id: "p1", monthlyFee: 250_000 });
  assert.equal(rt.active, true);
  const off = await service.cancelRetainer(rt.id);
  assert.equal(off.active, false);
  const again = await service.cancelRetainer(rt.id);
  assert.equal(again.active, false);
  assert.equal(retainers.length, 1);
  await assert.rejects(() => service.cancelRetainer("nope"), /not_found/);
});
