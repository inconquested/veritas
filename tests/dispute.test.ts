import assert from "node:assert/strict";
import test from "node:test";

import {
  DisputeService,
  DEFAULT_DISPUTE_DEADLINE_DAYS,
} from "../services/dispute-service";

function createMockDb(disputes: any[] = []) {
  const calls: { action: string; invoiceId: string; role: string; key: string }[] = [];
  const db = {
    disputes,
    dispute: {
      findFirst: async (q: any) =>
        disputes.find(
          (d) =>
            d.escrowId === q.where.escrowId &&
            (q.where.status?.in ?? []).includes(d.status),
        ) ?? null,
      findUnique: async (q: any) => disputes.find((d) => d.id === q.where.id) ?? null,
      create: async (q: any) => {
        const row = { id: `d${disputes.length + 1}`, ...q.data };
        disputes.push(row);
        return row;
      },
      update: async (q: any) => {
        const row = disputes.find((d) => d.id === q.where.id);
        Object.assign(row, q.data);
        return row;
      },
      findMany: async () => disputes,
    },
  };
  const transition = async (action: any, invoiceId: string, role: any, key: string) => {
    calls.push({ action, invoiceId, role, key });
    return { to: action === "dispute" ? "DISPUTED" : action === "refund" ? "REFUNDED" : "RELEASED" };
  };
  return { db, calls };
}

test("buka dispute 2x = gagal (double-open dicegah)", async () => {
  const { db, calls } = createMockDb();
  const transition = (async (...a: any[]) => {
    calls.push({ action: a[0], invoiceId: a[1], role: a[2], key: a[3] });
  }) as any;
  const service = new DisputeService(db as any, transition);
  const first = await service.openDispute("esc1", "Hasil tidak sesuai brief", 500_000, { invoiceId: "inv1" });
  assert.equal(first.status, "OPEN");
  const ttl = new Date(first.deadlineAt).getTime() - Date.now();
  assert.ok(ttl > (DEFAULT_DISPUTE_DEADLINE_DAYS - 0.1) * 86_400_000);
  await assert.rejects(
    () => service.openDispute("esc1", "Coba buka lagi", null, { invoiceId: "inv1" }),
    /already_open/,
  );
  assert.equal(calls.filter((c) => c.action === "dispute").length, 1);
});

test("resolve setelah deadline = gagal", async () => {
  const past = new Date(Date.now() - 1000);
  const { db, calls } = createMockDb([
    { id: "d1", escrowId: "esc9", reason: "telat", status: "OPEN", deadlineAt: past },
  ]);
  const service = new DisputeService(
    db as any,
    (async (...a: any[]) => { calls.push({ action: a[0], invoiceId: a[1], role: a[2], key: a[3] }); }) as any,
  );
  await assert.rejects(() => service.resolveDispute("d1", "REFUND", { invoiceId: "inv9" }), /deadline_passed/);
  assert.equal(calls.length, 0, "tidak ada transisi escrow saat deadline lewat");
});

test("resolve REFUND/RELEASE memakai transisi escrow + tercatat", async () => {
  const future = new Date(Date.now() + 86_400_000);
  for (const outcome of ["REFUND", "RELEASE"] as const) {
    const { db, calls } = createMockDb([
      { id: "d1", escrowId: "esc1", reason: "x", status: "NEGOTIATING", deadlineAt: future },
    ]);
    const service = new DisputeService(
      db as any,
      (async (...a: any[]) => { calls.push({ action: a[0], invoiceId: a[1], role: a[2], key: a[3] }); }) as any,
    );
    const row = await service.resolveDispute("d1", outcome, { invoiceId: "inv1" });
    assert.equal(row.status, outcome === "REFUND" ? "RESOLVED_REFUND" : "RESOLVED_RELEASE");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].action, outcome === "REFUND" ? "refund" : "release");
  }
});

test("respondDispute OPEN -> NEGOTIATING; alasan kosong = gagal", async () => {
  const future = new Date(Date.now() + 86_400_000);
  const { db } = createMockDb([
    { id: "d1", escrowId: "esc1", reason: "x", status: "OPEN", deadlineAt: future },
  ]);
  const noop = (async () => {}) as any;
  const service = new DisputeService(db as any, noop);
  const row = await service.respondDispute("d1");
  assert.equal(row.status, "NEGOTIATING");
  await assert.rejects(() => service.openDispute("esc2", "   ", null, { invoiceId: "i" }), /empty_reason/);
});
