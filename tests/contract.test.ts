import assert from "node:assert/strict";
import test from "node:test";

import { ContractService, hashContractBody } from "../services/contract-service";
import { LeadService } from "../services/lead-service";

function createContractDb() {
  const rows = new Map<string, any>();
  let seq = 0;
  const db = {
    contract: {
      findUnique: async (q: any) => rows.get(q.where.project_id) ?? null,
      create: async (q: any) => {
        const row = { id: `ct-${++seq}`, freelancerSignedAt: null, clientSignedAt: null, pdfUrl: null, ...q.data };
        rows.set(row.project_id, row);
        return row;
      },
      update: async (q: any) => {
        const row = rows.get(q.where.project_id);
        if (!row) throw new Error("not found");
        Object.assign(row, q.data);
        return row;
      },
    },
  };
  return { db, rows };
}

const BODY = "KONTRAK KERJA FREELANCE — Fix v1";

test("kontrak diubah setelah kedua pihak signed = invalid", async () => {
  const { db } = createContractDb();
  const svc = new ContractService(db as any);
  await svc.createContract("proj-1", BODY);
  await svc.signContract("proj-1", "FREELANCER", "Budi");
  await svc.signContract("proj-1", "CLIENT", "PT Maju");

  const before = await svc.verifyContract("proj-1");
  assert.equal(before.fullySigned, true);
  assert.equal(before.valid, true);

  await svc.updateContractBody("proj-1", "KONTRAK KERJA FREELANCE — Fix v1 DIUBAH");
  const after = await svc.verifyContract("proj-1");
  assert.equal(after.fullySigned, true);
  assert.equal(after.hashMatches, false);
  assert.equal(after.valid, false);
});

test("update sebelum fully-signed ikut hash baru (tetap valid); sign idempoten", async () => {
  const { db } = createContractDb();
  const svc = new ContractService(db as any);
  await svc.createContract("proj-2", BODY);
  const s1 = await svc.signContract("proj-2", "freelancer", "Budi");
  await svc.updateContractBody("proj-2", "KONTRAK revisi lingkup");
  const v = await svc.verifyContract("proj-2");
  assert.equal(v.fullySigned, false);
  assert.equal(v.valid, true);

  const s2 = await svc.signContract("proj-2", "FREELANCER", "Budi Lagi");
  assert.equal(new Date(s2.freelancerSignedAt).getTime(), new Date(s1.freelancerSignedAt).getTime());
  await assert.rejects(() => svc.signContract("proj-2", "CLIENT", "   "), /empty_name/);
  await assert.rejects(() => svc.signContract("proj-2", "ADMIN", "X"), /bad_role/);
});

test("hash stabil; kontrak ganda per project = tolak", async () => {
  assert.equal(hashContractBody("a"), hashContractBody("a"));
  const { db } = createContractDb();
  const svc = new ContractService(db as any);
  await svc.createContract("proj-3", BODY);
  await assert.rejects(() => svc.createContract("proj-3", BODY), /exists/);
  await assert.rejects(() => svc.createContract("proj-3", "   "), /empty_body/);
});

function createLeadDb() {
  const rows: any[] = [];
  let seq = 0;
  const db = {
    lead: {
      create: async (q: any) => {
        const row = { id: `l${++seq}`, ...q.data };
        rows.push(row);
        return row;
      },
      findMany: async (q: any) => rows.filter((r) => r.freelancerId === q.where.freelancerId),
      findUnique: async (q: any) => rows.find((r) => r.id === q.where.id) ?? null,
      update: async (q: any) => {
        const row = rows.find((r) => r.id === q.where.id);
        Object.assign(row, q.data);
        return row;
      },
      delete: async (q: any) => {
        const i = rows.findIndex((r) => r.id === q.where.id);
        rows.splice(i, 1);
        return { id: q.where.id };
      },
    },
  };
  return { db, rows };
}

test("lead: CRUD + moveStage BARU→NEGO→DEAL→KALAH; stage asing = tolak", async () => {
  const { db } = createLeadDb();
  const svc = new LeadService(db as any);
  const lead = await svc.createLead({ freelancerId: "f1", name: "PT Maju", contact: "0812", source: "IG" });
  assert.equal(lead.stage, "BARU");

  await svc.moveStage(lead.id, "NEGO");
  await svc.moveStage(lead.id, "DEAL");
  assert.equal((await svc.getLead(lead.id)).stage, "DEAL");
  await assert.rejects(() => svc.moveStage(lead.id, " Deal "), /bad_stage/);
  await assert.rejects(() => svc.moveStage("nope", "NEGO"), /not_found/);

  await svc.updateLead(lead.id, { notes: "budget 10jt" });
  assert.equal((await svc.getLead(lead.id)).notes, "budget 10jt");
  assert.equal((await svc.listLeads("f1")).length, 1);
  assert.equal(await svc.deleteLead(lead.id), true);
});
