import assert from "node:assert/strict";
import test from "node:test";

import {
  CommentService,
  COMMENT_EMPTY_BODY,
} from "../services/comment-service";

function createMockDb() {
  const rows: any[] = [];
  return {
    rows,
    db: {
      comment: {
        create: async (q: any) => {
          const row = { id: `c${rows.length + 1}`, createdAt: new Date(), ...q.data };
          rows.push(row);
          return row;
        },
        findMany: async (q: any) => {
          const where = q?.where ?? {};
          return rows.filter((r) =>
            Object.entries(where).every(([k, v]) => (r as any)[k] === v),
          );
        },
      },
    },
  };
}

const base = {
  projectId: "p1",
  authorId: "u1",
  authorRole: "CLIENT",
  body: "Minta revisi bagian hero.",
};

test("komentar kosong = gagal", async () => {
  const { db } = createMockDb();
  const service = new CommentService(db as any);
  await assert.rejects(() => service.addComment({ ...base, body: "" }), new RegExp(COMMENT_EMPTY_BODY.replace(/\./g, "\\.")));
});

test("komentar whitespace-only = gagal", async () => {
  const { db } = createMockDb();
  const service = new CommentService(db as any);
  await assert.rejects(() => service.addComment({ ...base, body: "   \n\t  " }), /empty_body/);
});

test("komentar valid tersimpan + tercatat sebagai evidence (filter milestone)", async () => {
  const { db, rows } = createMockDb();
  const service = new CommentService(db as any);
  const saved = await service.addComment({
    ...base,
    milestoneId: "m1",
    attachments: ["https://res.cloudinary.com/x/bukti.png"],
  });
  assert.equal(rows.length, 1);
  assert.equal(saved.body, base.body);
  assert.deepEqual(saved.attachments, ["https://res.cloudinary.com/x/bukti.png"]);

  const scoped = await service.getComments("p1", { milestoneId: "m1" });
  assert.equal(scoped.length, 1);
  const other = await service.getComments("p1", { milestoneId: "m2" });
  assert.equal(other.length, 0);
});

test("uploadAttachments mendelegasikan ke media-service", async () => {
  const { db } = createMockDb();
  const uploaded: string[] = [];
  const fakeMedia = {
    uploadMediaMultiple: async (files: unknown[]) => {
      uploaded.push(...files.map(() => "https://cdn/u.png"));
      return uploaded;
    },
  };
  const service = new CommentService(db as any, fakeMedia as any);
  const urls = await service.uploadAttachments([{}, {}] as any);
  assert.deepEqual(urls, ["https://cdn/u.png", "https://cdn/u.png"]);
});
