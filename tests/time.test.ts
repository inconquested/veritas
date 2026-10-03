import assert from "node:assert/strict";
import test from "node:test";

import {
  TimeService,
  __clearTimeHintsForTest,
  type TimeEntryRow,
  type TimeInvoiceData,
} from "../services/time-service";

type Where = Record<string, string | undefined>;

function matches(row: TimeEntryRow, where: Where): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (v !== undefined && (row as Record<string, unknown>)[k] !== v) return false;
  }
  return true;
}

function createMockDb() {
  const entries: TimeEntryRow[] = [];
  let seq = 0;
  const db = {
    timeEntry: {
      findFirst: async (q: { where: Where }) =>
        entries.find((e) => matches(e, q.where)) ?? null,
      findMany: async (q: { where: Where }) =>
        entries.filter((e) => matches(e, q.where)),
      create: async (q: { data: Omit<TimeEntryRow, "id"> }) => {
        const row: TimeEntryRow = { id: `t${++seq}`, ...q.data };
        entries.push(row);
        return row;
      },
      update: async (q: { where: { id: string }; data: Partial<TimeEntryRow> }) => {
        const row = entries.find((e) => e.id === q.where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, q.data);
        return row;
      },
    },
    project: { findUnique: async () => null },
    freelancerProfile: { findFirst: async () => null },
    invoice: {
      findMany: async () => [],
      create: async () => ({ id: "unused" }),
    },
  };
  return { db, entries };
}

test("double-start = ditolak (1 timer aktif per freelancer)", async () => {
  __clearTimeHintsForTest();
  const { db } = createMockDb();
  const service = new TimeService(db as never);
  await service.startTimer({ project_id: "p1", freelancerId: "fl-1" });
  await assert.rejects(
    () => service.startTimer({ project_id: "p1", freelancerId: "fl-1" }),
    /already_running/,
  );
  // Freelancer lain boleh jalan bersamaan.
  const other = await service.startTimer({ project_id: "p1", freelancerId: "fl-2" });
  assert.equal(other.status, "RUNNING");
});

test("stop tanpa start = gagal", async () => {
  __clearTimeHintsForTest();
  const { db } = createMockDb();
  const service = new TimeService(db as never);
  await assert.rejects(
    () => service.stopTimer({ freelancerId: "fl-9", minutes: 30 }),
    /no_active_timer/,
  );
});

test("8 jam tracked → invoice 8×rate; convert ulang = no_billable", async () => {
  __clearTimeHintsForTest();
  const { db } = createMockDb();
  let seen: { title: string; amount: bigint } | null = null;
  const service = new TimeService(
    db as never,
    (async (d: TimeInvoiceData) => {
      seen = { title: d.title, amount: d.amount };
      return { id: "inv-1" };
    }) as never,
  );
  const e = await service.manualEntry({
    project_id: "p1",
    freelancerId: "fl-1",
    minutes: 480,
    rate: 150_000,
  });
  assert.equal(e.status, "DRAFT");
  await service.approveTime(e.id);
  const res = await service.convertToInvoice({ freelancerId: "fl-1" });
  assert.equal(res.invoiceId, "inv-1");
  assert.equal(res.amount, 8n * 150_000n); // 1.200.000
  assert.equal(seen!.amount, 1_200_000n);
  const again = service.convertToInvoice({ freelancerId: "fl-1" });
  await assert.rejects(again, /no_billable/);
});

test("start → stop mengisi minutes + DRAFT; approve/reject gate status", async () => {
  __clearTimeHintsForTest();
  const { db } = createMockDb();
  const service = new TimeService(db as never);
  await service.startTimer({ project_id: "p1", freelancerId: "fl-1", rate: 100_000 });
  const stopped = await service.stopTimer({ freelancerId: "fl-1", minutes: 60 });
  assert.equal(stopped.minutes, 60);
  assert.equal(stopped.status, "DRAFT");
  // Stop kedua tanpa timer aktif = gagal.
  await assert.rejects(
    () => service.stopTimer({ freelancerId: "fl-1", minutes: 10 }),
    /no_active_timer/,
  );
  // Approve RUNNING langsung = tolak (bukan DRAFT).
  await service.startTimer({ project_id: "p1", freelancerId: "fl-1" });
  const running = await service.activeTimer("fl-1");
  await assert.rejects(() => service.approveTime(running!.id), /bad_status/);
  await service.stopTimer({ freelancerId: "fl-1", minutes: 15 });
  const ok = await service.approveTime(running!.id);
  assert.equal(ok.status, "APPROVED");
  await assert.rejects(() => service.rejectTime(running!.id), /bad_status/);
});

test("convert tanpa rate / lintas project = tolak", async () => {
  __clearTimeHintsForTest();
  const { db } = createMockDb();
  const service = new TimeService(db as never, (async () => ({ id: "x" })) as never);
  const e = await service.manualEntry({
    project_id: "p1",
    freelancerId: "fl-1",
    minutes: 60,
  });
  await service.approveTime(e.id);
  await assert.rejects(() => service.convertToInvoice({ freelancerId: "fl-1" }), /missing_rate/);

  __clearTimeHintsForTest();
  const { db: db2 } = createMockDb();
  const s2 = new TimeService(db2 as never, (async () => ({ id: "x" })) as never);
  for (const p of ["p1", "p2"]) {
    const m = await s2.manualEntry({ project_id: p, freelancerId: "fl-1", minutes: 60, rate: 60_000 });
    await s2.approveTime(m.id);
  }
  await assert.rejects(() => s2.convertToInvoice({ freelancerId: "fl-1" }), /multi_project/);
  const one = await s2.convertToInvoice({ freelancerId: "fl-1", project_id: "p1" });
  assert.equal(one.amount, 60_000n);
});

test("menit di luar 1–1440 / rate nol = tolak", async () => {
  __clearTimeHintsForTest();
  const { db } = createMockDb();
  const service = new TimeService(db as never);
  await assert.rejects(
    () => service.manualEntry({ project_id: "p1", freelancerId: "fl-1", minutes: 0 }),
    /invalid_minutes/,
  );
  await assert.rejects(
    () => service.manualEntry({ project_id: "p1", freelancerId: "fl-1", minutes: 1441 }),
    /invalid_minutes/,
  );
  await assert.rejects(
    () => service.manualEntry({ project_id: "p1", freelancerId: "fl-1", minutes: 10, rate: 0 }),
    /invalid_rate/,
  );
});
