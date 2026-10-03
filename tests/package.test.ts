import assert from "node:assert/strict";
import test from "node:test";

import { PackageService } from "../services/package-service";

type Row = {
  id: string;
  freelancerId: string;
  title: string;
  price: bigint;
  description: string | null;
  active: boolean;
};

function createMockDb(seed: Row[] = []) {
  const rows = new Map<string, Row>(seed.map((r) => [r.id, { ...r }]));
  const db = {
    servicePackage: {
      findMany: async (q: { where: { freelancerId: string; active?: boolean } }) =>
        [...rows.values()].filter(
          (r) =>
            r.freelancerId === q.where.freelancerId &&
            (q.where.active === undefined || r.active === q.where.active),
        ),
      findUnique: async (q: { where: { id: string } }) => rows.get(q.where.id) ?? null,
      create: async (q: { data: Omit<Row, "id"> }) => {
        const row = { id: `pkg-${rows.size + 1}`, ...q.data };
        rows.set(row.id, row);
        return row;
      },
      update: async (q: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.get(q.where.id);
        assert.ok(row, "row must exist");
        Object.assign(row, q.data);
        return row;
      },
      delete: async (q: { where: { id: string } }) => {
        assert.ok(rows.delete(q.where.id), "row must exist");
        return { id: q.where.id };
      },
    },
  };
  return { db, rows };
}

test("create validasi judul + harga; list filter activeOnly", async () => {
  const { db } = createMockDb();
  const svc = new PackageService(db as never);
  await assert.rejects(
    () => svc.createPackage({ freelancerId: "f1", title: "  ", price: 1000 }),
    /empty_title/,
  );
  await assert.rejects(
    () => svc.createPackage({ freelancerId: "f1", title: "OK", price: 0 }),
    /bad_price/,
  );
  await assert.rejects(
    () => svc.createPackage({ freelancerId: "f1", title: "OK", price: "abc" }),
    /bad_price/,
  );
  const p = (await svc.createPackage({
    freelancerId: "f1",
    title: " Landing Page ",
    price: "1500000",
    description: "  5 hari kerja ",
  })) as Row;
  assert.equal(p.title, "Landing Page");
  assert.equal(p.price, 1_500_000n);
  assert.equal(p.active, true);

  await svc.toggleActive(p.id, "f1");
  const all = (await svc.listPackages("f1")) as Row[];
  const active = (await svc.listPackages("f1", { activeOnly: true })) as Row[];
  assert.equal(all.length, 1);
  assert.equal(active.length, 0); // profil publik sembunyikan nonaktif
});

test("mutasi milik orang lain = forbidden; hapus = hilang", async () => {
  const { db } = createMockDb([
    { id: "p1", freelancerId: "f1", title: "A", price: 100n, description: null, active: true },
  ]);
  const svc = new PackageService(db as never);
  await assert.rejects(() => svc.updatePackage("p1", "f2", { title: "B" }), /forbidden/);
  await assert.rejects(() => svc.toggleActive("p1", "f2"), /forbidden/);
  await assert.rejects(() => svc.deletePackage("p1", "f2"), /forbidden/);
  await assert.rejects(() => svc.getPackage("nope"), /not_found/);

  const updated = (await svc.updatePackage("p1", "f1", { price: 200 })) as Row;
  assert.equal(updated.price, 200n);
  assert.equal(await svc.deletePackage("p1", "f1"), true);
  await assert.rejects(() => svc.getPackage("p1"), /not_found/);
});
