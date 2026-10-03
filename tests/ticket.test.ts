import assert from "node:assert/strict";
import test from "node:test";

import {
  TICKET_BAD_SEVERITY,
  TICKET_BAD_TRANSITION,
  TicketService,
  checkSlaBreach,
  isSlaBreached,
  slaDueFor,
  ticketEscalationLink,
  validateTicketTransition,
} from "../services/ticket-service";
import { buildSlaReport } from "../lib/sla-report";

function createMockDb() {
  const tickets: any[] = [];
  let n = 0;
  const db = {
    tickets,
    ticket: {
      create: async (q: any) => {
        n += 1;
        const row = { id: `k${n}`, createdAt: new Date(), ...q.data };
        tickets.push(row);
        return row;
      },
      findUnique: async (q: any) => tickets.find((t) => t.id === q.where.id) ?? null,
      update: async (q: any) => {
        const row = tickets.find((t) => t.id === q.where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, q.data);
        return row;
      },
      findMany: async (q: any) => {
        const where = q?.where ?? {};
        return tickets.filter((t) =>
          Object.entries(where).every(([k, v]: [string, any]) => {
            const val = (t as any)[k];
            if (v && typeof v === "object" && "in" in v) return v.in.includes(val);
            return val === v;
          }),
        );
      },
    },
  };
  return { db, tickets };
}

const NOW = new Date("2026-10-02T10:00:00Z");
const HOUR = 3_600_000;

test("SLA auto: KRITIS +4 jam, TINGGI +24 jam, NORMAL +72 jam", async () => {
  const { db } = createMockDb();
  const svc = new TicketService(db as any);
  const k = await svc.createTicket({ projectId: "p1", severity: "KRITIS", now: NOW });
  const t = await svc.createTicket({ projectId: "p1", severity: "TINGGI", now: NOW });
  const n = await svc.createTicket({ projectId: "p1", now: NOW });
  assert.equal(new Date(k.slaDue).getTime() - NOW.getTime(), 4 * HOUR);
  assert.equal(new Date(t.slaDue).getTime() - NOW.getTime(), 24 * HOUR);
  assert.equal(new Date(n.slaDue).getTime() - NOW.getTime(), 72 * HOUR);
});

test("slaDueFor murni ≈ +4 jam untuk KRITIS; severity asing ditolak", () => {
  const due = slaDueFor("KRITIS", NOW);
  assert.ok(Math.abs(due.getTime() - NOW.getTime() - 4 * HOUR) < 1000);
  assert.throws(() => slaDueFor("GENTING", NOW), new RegExp(TICKET_BAD_SEVERITY.replace(/\./g, "\\.")));
});

test("breach terdeteksi: lewat slaDue + OPEN; RESOLVED/CLOSED aman", () => {
  const late = new Date(NOW.getTime() + 5 * HOUR);
  assert.equal(isSlaBreached({ id: "1", status: "OPEN", slaDue: NOW }, late), true);
  assert.equal(isSlaBreached({ id: "1", status: "IN_PROGRESS", slaDue: NOW }, late), true);
  assert.equal(isSlaBreached({ id: "1", status: "RESOLVED", slaDue: NOW }, late), false);
  assert.equal(isSlaBreached({ id: "1", status: "CLOSED", slaDue: NOW }, late), false);
  assert.equal(isSlaBreached({ id: "1", status: "OPEN", slaDue: NOW }, NOW), false);
  assert.equal(isSlaBreached({ id: "1", status: "OPEN", slaDue: null }, late), false);
});

test("checkSlaBreach murni menyaring daftar", () => {
  const late = new Date(NOW.getTime() + 5 * HOUR);
  const rows = [
    { id: "a", status: "OPEN", slaDue: new Date(NOW.getTime() - HOUR) },
    { id: "b", status: "OPEN", slaDue: new Date(NOW.getTime() + 10 * HOUR) },
    { id: "c", status: "RESOLVED", slaDue: new Date(NOW.getTime() - HOUR) },
  ];
  assert.deepEqual(checkSlaBreach(rows, late).map((t) => t.id), ["a"]);
  assert.deepEqual(checkSlaBreach("bukan-array" as any, late), []);
});

test("changeStatus ikut state machine; OPEN→RESOLVED langsung ditolak", async () => {
  const { db } = createMockDb();
  const svc = new TicketService(db as any);
  const k = await svc.createTicket({ projectId: "p1", severity: "KRITIS", now: NOW });
  await assert.rejects(() => svc.changeStatus(k.id, "RESOLVED"), /bad_transition/);
  await svc.changeStatus(k.id, "IN_PROGRESS");
  await svc.changeStatus(k.id, "RESOLVED");
  await svc.changeStatus(k.id, "CLOSED");
  assert.throws(() => validateTicketTransition("CLOSED", "OPEN"), new RegExp(TICKET_BAD_TRANSITION.replace(/\./g, "\\.")));
});

test("listBreached hanya kembalikan yang lewat SLA", async () => {
  const { db } = createMockDb();
  const svc = new TicketService(db as any);
  await svc.createTicket({ projectId: "p1", severity: "KRITIS", now: new Date(NOW.getTime() - 5 * HOUR) });
  await svc.createTicket({ projectId: "p1", severity: "NORMAL", now: NOW });
  const breached = await svc.listBreached("p1", NOW);
  assert.equal(breached.length, 1);
  assert.equal(breached[0].severity, "KRITIS");
});

test("laporan SLA/bulan: total, breach, rate, per-severity", () => {
  const rows = [
    { id: "a", status: "OPEN", severity: "KRITIS", slaDue: new Date(NOW.getTime() - HOUR), createdAt: NOW },
    { id: "b", status: "RESOLVED", severity: "NORMAL", slaDue: new Date(NOW.getTime() - HOUR), createdAt: NOW },
    { id: "c", status: "OPEN", severity: "NORMAL", slaDue: new Date(NOW.getTime() + 10 * HOUR), createdAt: NOW },
  ];
  const r = buildSlaReport(rows, { month: "2026-10", now: NOW });
  assert.equal(r.total, 3);
  assert.equal(r.breached, 1);
  assert.equal(r.openBreached, 1);
  assert.equal(r.resolved, 1);
  assert.ok(Math.abs((r.breachRate ?? 0) - 1 / 3) < 1e-9);
  assert.deepEqual(r.perSeverity.KRITIS, { total: 1, breached: 1 });
  const empty = buildSlaReport([], { month: "2026-10", now: NOW });
  assert.equal(empty.breachRate, null);
});

test("link eskalasi WA berbentuk wa.me dengan pesan ter-encode", () => {
  const link = ticketEscalationLink({ id: "k1", severity: "KRITIS", project_id: "p1" }, "628123456789");
  assert.ok(link.startsWith("https://wa.me/628123456789?text="));
  assert.ok(link.includes("ESKALASI"));
  assert.ok(ticketEscalationLink({ id: "k1" }).startsWith("https://wa.me/?text="));
});
