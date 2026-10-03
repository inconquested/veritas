import assert from "node:assert/strict";
import test from "node:test";

import {
  rankDocuments,
  scoreDoc,
  semanticSearch,
  tokenize,
  type SearchDoc,
} from "../lib/semantic-search";

const DOCS: SearchDoc[] = [
  { id: "p1", kind: "project", title: "Website UMKM Kopi", body: "katalog online", projectId: "p1" },
  { id: "i1", kind: "invoice", title: "Termin 1 website", body: "DP kopi", projectId: "p1" },
  { id: "c1", kind: "comment", title: "Minta revisi hero", body: "Minta revisi bagian hero besok", projectId: "p1" },
  { id: "t1", kind: "task", title: "Perbaiki hero mobile", projectId: "p2" },
];

test("tokenize: lowercase + buang token pendek", () => {
  assert.deepEqual(tokenize("Minta Revisi! a hero"), ["minta", "revisi", "hero"]);
  assert.deepEqual(tokenize("a"), []);
});

test("ranking dasar: judul berbobot + frasa menang", () => {
  const ranked = rankDocuments(DOCS, "revisi hero");
  assert.equal(ranked[0].id, "c1");
  assert.ok((ranked[0].score ?? 0) > (ranked[1]?.score ?? 0));
  // unrelated query tanpa overlap -> kosong
  assert.deepEqual(rankDocuments(DOCS, "zxqw kjhd"), []);
  // query kosong -> kosong
  assert.deepEqual(rankDocuments(DOCS, ""), []);
});

test("filter kind + projectId + limit dihormati", () => {
  const onlyTask = rankDocuments(DOCS, "hero", { kind: "task" });
  assert.deepEqual(onlyTask.map((d) => d.id), ["t1"]);
  const scoped = rankDocuments(DOCS, "hero", { projectId: "p2" });
  assert.deepEqual(scoped.map((d) => d.id), ["t1"]);
  const limited = rankDocuments(DOCS, "website kopi hero revisi termin", { limit: 1 });
  assert.equal(limited.length, 1);
});

test("scoreDoc: judul 3x body 1x", () => {
  const inTitle: SearchDoc = { id: "a", kind: "task", title: "hero section" };
  const inBody: SearchDoc = { id: "b", kind: "task", title: "lain", body: "hero section" };
  assert.ok(scoreDoc(inTitle, ["hero"], "hero") > scoreDoc(inBody, ["hero"], "hero"));
});

test("semanticSearch: agregat Prisma-like + ranking", async () => {
  const db = {
    project: { findMany: async () => [{ id: "p1", title: "Website UMKM", description: "kopi" }] },
    invoice: { findMany: async () => [] },
    comment: {
      findMany: async () => [{ id: "c1", body: "minta revisi hero", project_id: "p1" }],
    },
    task: { findMany: async () => [] },
  };
  const res = await semanticSearch(db as never, "revisi");
  assert.equal(res[0].id, "c1");
  assert.equal(await semanticSearch(db as never, "").then((r) => r.length), 0);
});
