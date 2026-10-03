import assert from "node:assert/strict";
import test from "node:test";

import { ProposalService } from "../services/proposal-service";
import { HandsoutApprovalService } from "../services/handsout-approval";

function createMockDb() {
  const proposals = new Map<string, any>();
  const projects = new Map<string, any>(); // slug -> project
  let seq = 0;
  const db = {
    proposal: {
      findUnique: async (q: any) => proposals.get(q.where.id) ?? null,
      create: async (q: any) => {
        const row = { id: `prop-${++seq}`, ...q.data };
        proposals.set(row.id, row);
        return row;
      },
      update: async (q: any) => {
        const row = proposals.get(q.where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, q.data);
        return row;
      },
      findMany: async () => [...proposals.values()],
    },
    project: {
      findUnique: async (q: any) => {
        if (q.where.slug) return projects.get(q.where.slug) ?? null;
        return [...projects.values()].find((p) => p.id === q.where.id) ?? null;
      },
    },
    milestone: {
      create: async (q: any) => ({ id: "m1", ...q.data }),
    },
  };
  return { db, proposals, projects };
}

const ITEMS = [
  { title: "Desain landing page", qty: 1, price: 6_000_000 },
  { title: "Integrasi pembayaran", qty: 2, price: 2_000_000 },
]; // total 10jt → DP 50% = 5jt

async function sentProposal(svc: ProposalService) {
  const p = await svc.createProposal({ freelancerId: "f1", clientName: "PT Maju", items: ITEMS });
  assert.equal(p.total, 10_000_000n);
  return svc.sendProposal(p.id);
}

test("approve 2x = 1 project (idempoten, guard status + slug)", async () => {
  const { db, projects } = createMockDb();
  let projectCalls = 0;
  let invoiceCalls = 0;
  const deps = {
    projectCreator: async (d: any) => {
      projectCalls++;
      const row = { id: "proj-1", ...d };
      projects.set(d.slug, row);
      return row;
    },
    invoiceCreator: async (d: any) => {
      invoiceCalls++;
      return { id: "inv-dp", ...d };
    },
  };
  const svc = new ProposalService(db as any, deps as any);
  const sent = await sentProposal(svc);

  const first = await svc.approveProposal(sent.id, { clientId: "c1" });
  assert.equal(first.deduped, false);
  assert.equal((first.project as any).id, "proj-1");
  assert.equal((first.invoice as any).amount, 5_000_000n);

  const second = await svc.approveProposal(sent.id, { clientId: "c1" });
  assert.equal(second.deduped, true);
  assert.equal((second.project as any).id, "proj-1");
  assert.equal(projectCalls, 1, "project hanya dibuat sekali");
  assert.equal(invoiceCalls, 1, "invoice DP hanya dibuat sekali");
});

test("approve DRAFT / REJECTED / expired = tolak", async () => {
  const { db } = createMockDb();
  const svc = new ProposalService(db as any, { projectCreator: async () => ({ id: "x" }), invoiceCreator: async () => ({ id: "y" }) } as any);
  const draft = await svc.createProposal({ freelancerId: "f1", clientName: "A", items: ITEMS });
  await assert.rejects(() => svc.approveProposal(draft.id, { clientId: "c1" }), /bad_status/);

  const expired = await svc.createProposal({
    freelancerId: "f1",
    clientName: "B",
    items: ITEMS,
    expiresAt: new Date(Date.now() - 1000),
  });
  await assert.rejects(() => svc.sendProposal(expired.id), /expired/);

  const sent = await sentProposal(svc);
  await svc.rejectProposal(sent.id);
  await assert.rejects(() => svc.approveProposal(sent.id, { clientId: "c1" }), /bad_status/);
});

function createHandsoutDb() {
  const rows = new Map<string, any>([["h1", { id: "h1", status: "DRAFT", version: 1 }]]);
  const db = {
    handsout: {
      findUnique: async (q: any) => rows.get(q.where.id) ?? null,
      update: async (q: any) => {
        const row = rows.get(q.where.id);
        Object.assign(row, q.data);
        return row;
      },
    },
  };
  return { db, rows };
}

test("handsout submit → approve OK; approve langsung dari DRAFT = tolak", async () => {
  const { db } = createHandsoutDb();
  const svc = new HandsoutApprovalService(db as any);
  await assert.rejects(() => svc.approveHandsout("h1"), /bad_status/);
  await svc.submitHandsout("h1");
  const approved = await svc.approveHandsout("h1");
  assert.equal(approved.status, "APPROVED");
  const again = await svc.approveHandsout("h1");
  assert.equal(again.status, "APPROVED");
});

test("handsout reject → versi +1, idempoten tanpa bump ganda", async () => {
  const { db } = createHandsoutDb();
  const svc = new HandsoutApprovalService(db as any);
  await svc.submitHandsout("h1");
  const rejected = await svc.rejectHandsout("h1");
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.version, 2);
  const again = await svc.rejectHandsout("h1");
  assert.equal(again.version, 2, "reject ulang tidak menaikkan versi lagi");
  // Bisa submit ulang setelah revisi
  const resub = await svc.submitHandsout("h1");
  assert.equal(resub.status, "SUBMITTED");
});
