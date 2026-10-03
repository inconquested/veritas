import assert from "node:assert/strict";
import test from "node:test";

import { ReferralService } from "../services/referral-service";

type Row = { id: string; code: string; referrerId: string; converted: boolean };

function createMockDb(seed: Row[] = []) {
  const rows = new Map<string, Row>(seed.map((r) => [r.code, { ...r }]));
  let updates = 0;
  const db = {
    referral: {
      findUnique: async (q: { where: { code: string } }) =>
        rows.get(q.where.code) ?? null,
      findMany: async (q: { where: { referrerId: string } }) =>
        [...rows.values()].filter((r) => r.referrerId === q.where.referrerId),
      create: async (q: { data: { code: string; referrerId: string; converted: boolean } }) => {
        const row = { id: `ref-${rows.size + 1}`, ...q.data };
        rows.set(row.code, row);
        return row;
      },
      update: async (q: { where: { id: string }; data: { converted: boolean } }) => {
        updates++;
        const row = [...rows.values()].find((r) => r.id === q.where.id);
        assert.ok(row, "row must exist");
        row.converted = q.data.converted;
        return row;
      },
    },
  };
  return { db, rows, get updates() { return updates; } };
}

test("create kode auto-generate + custom dinormalisasi", async () => {
  const { db } = createMockDb();
  const svc = new ReferralService(db as never);
  const auto = (await svc.createReferralCode("u1")) as Row;
  assert.match(auto.code, /^VTS-[A-Z2-9]{6}$/);
  assert.equal(auto.converted, false);

  const custom = (await svc.createReferralCode("u1", "  ajak-teman ")) as Row;
  assert.equal(custom.code, "AJAK-TEMAN");
});

test("create tanpa referrer / kode dobel = ditolak", async () => {
  const { db } = createMockDb();
  const svc = new ReferralService(db as never);
  await assert.rejects(() => svc.createReferralCode(""), /missing_referrer/);
  await svc.createReferralCode("u1", "DOBEL");
  await assert.rejects(() => svc.createReferralCode("u2", "dobel"), /duplicate_code/);
});

test("redeem 2x = 1 konversi (kedua ditolak, converted tetap true)", async () => {
  const store = createMockDb([{ id: "r1", code: "VTS-ABC123", referrerId: "u1", converted: false }]);
  const svc = new ReferralService(store.db as never);

  const first = (await svc.redeemReferral("vts-abc123")) as Row; // case-insensitive
  assert.equal(first.converted, true);
  assert.equal(store.updates, 1);

  await assert.rejects(() => svc.redeemReferral("VTS-ABC123"), /already_converted/);
  assert.equal(store.updates, 1); // tidak ada update kedua
  assert.equal(store.rows.get("VTS-ABC123")?.converted, true); // tetap 1 konversi
});

test("redeem kode tak dikenal = not_found", async () => {
  const { db } = createMockDb();
  await assert.rejects(
    () => new ReferralService(db as never).redeemReferral("VTS-NOPE00"),
    /not_found/,
  );
});
