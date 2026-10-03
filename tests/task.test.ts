import assert from "node:assert/strict";
import test from "node:test";

import {
  TaskService,
  isTaskTransitionAllowed,
  validateTaskTransition,
  TASK_BAD_TRANSITION,
} from "../services/task-service";
import { parseMentions } from "../lib/mention";
import { getMyInbox, recordMentions } from "../services/inbox-service";

// ---------------------------------------------------------------------------
// Mock DB (pola comment.test.ts): task + activityEvent in-memory
// ---------------------------------------------------------------------------

function createMockDb() {
  const tasks: any[] = [];
  const events: any[] = [];
  let n = 0;
  const db = {
    tasks,
    events,
    task: {
      create: async (q: any) => {
        n += 1;
        const row = { id: `t${n}`, ...q.data };
        tasks.push(row);
        return row;
      },
      findUnique: async (q: any) => tasks.find((t) => t.id === q.where.id) ?? null,
      update: async (q: any) => {
        const row = tasks.find((t) => t.id === q.where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, q.data);
        return row;
      },
      delete: async (q: any) => {
        const i = tasks.findIndex((t) => t.id === q.where.id);
        if (i < 0) throw new Error("not found");
        const [row] = tasks.splice(i, 1);
        return row;
      },
      findMany: async (q: any) => {
        const where = q?.where ?? {};
        if (where.OR) {
          return tasks.filter((t) =>
            where.OR.some((cond: any) =>
              Object.entries(cond).every(([k, v]) => (t as any)[k] === v),
            ),
          );
        }
        return tasks.filter((t) =>
          Object.entries(where).every(([k, v]) => (t as any)[k] === v),
        );
      },
    },
    activityEvent: {
      create: async (q: any) => {
        const row = { id: `e${events.length + 1}`, createdAt: new Date(), ...q.data };
        events.push(row);
        return row;
      },
      findMany: async (q: any) => {
        const where = q?.where ?? {};
        return events.filter((e) =>
          Object.entries(where).every(([k, v]) => (e as any)[k] === v),
        );
      },
    },
  };
  return { db, tasks, events };
}

// ---------------------------------------------------------------------------
// State machine: maju 1 langkah, REVIEW→DOING pengecualian, mundur = tolak
// ---------------------------------------------------------------------------

test("TODO→DOING→REVIEW→DONE legal selangkah", () => {
  for (const [from, to] of [["TODO", "DOING"], ["DOING", "REVIEW"], ["REVIEW", "DONE"]] as const) {
    validateTaskTransition(from, to);
    assert.equal(isTaskTransitionAllowed(from, to), true);
  }
});

test("REVIEW→DOING (rework) legal, sama-status no-op", () => {
  validateTaskTransition("REVIEW", "DOING");
  for (const s of ["TODO", "DOING", "REVIEW", "DONE"]) validateTaskTransition(s, s);
});

test("status mundur / loncat ilegal ditolak", () => {
  const bad: [string, string][] = [
    ["TODO", "DONE"], // loncat
    ["TODO", "REVIEW"], // loncat
    ["DOING", "TODO"], // mundur
    ["DOING", "DONE"], // loncat
    ["REVIEW", "TODO"], // mundur jauh
    ["DONE", "REVIEW"], // keluar terminal
    ["DONE", "TODO"],
  ];
  for (const [from, to] of bad) {
    assert.throws(() => validateTaskTransition(from, to), /bad_transition/, `${from}→${to}`);
    assert.equal(isTaskTransitionAllowed(from, to), false);
  }
});

test("moveStatus mundur via service = throw errors.task.bad_transition", async () => {
  const { db } = createMockDb();
  const svc = new TaskService(db as any);
  const t = await svc.createTask({ projectId: "p1", title: "Desain hero" });
  await svc.moveStatus(t.id, "DOING");
  await assert.rejects(() => svc.moveStatus(t.id, "TODO"), new RegExp(TASK_BAD_TRANSITION.replace(/\./g, "\\.")));
  // Maju tetap bisa setelah gagal mundur
  await svc.moveStatus(t.id, "REVIEW");
  assert.equal((await svc.listByProject("p1"))[0].status, "REVIEW");
});

test("CRUD + assign + daftar per project/milestone", async () => {
  const { db, events } = createMockDb();
  const svc = new TaskService(db as any);
  const a = await svc.createTask({ projectId: "p1", milestoneId: "m1", title: "A", actorId: "u1" });
  const b = await svc.createTask({ projectId: "p1", title: "B" });
  await svc.assign(a.id, "budi", { actorId: "u1" });
  await svc.updateTask(b.id, { title: "B revisi" }, { actorId: "u1" });

  assert.equal((await svc.listByProject("p1")).length, 2);
  assert.equal((await svc.listByProject("p1", { assignee: "budi" })).length, 1);
  assert.equal((await svc.listByProject("p1", { milestoneId: "m1" })).length, 1);
  assert.equal((await svc.listByProject("p1", { search: "revisi" })).length, 1);
  assert.equal((await svc.listByMilestone("m1")).length, 1);

  await svc.deleteTask(b.id);
  assert.equal((await svc.listByProject("p1")).length, 1);
  // Setiap aksi tercatat di feed
  const actions = events.map((e) => e.action);
  for (const want of ["task.created", "task.assigned", "task.updated", "task.deleted"]) {
    assert.ok(actions.includes(want), `feed memuat ${want}`);
  }
});

// ---------------------------------------------------------------------------
// Mention: parse + simpan sebagai ActivityEvent + inbox "perlu aksiku"
// ---------------------------------------------------------------------------

test("mention ter-parse: @nama ganda unik, email bukan mention", () => {
  assert.deepEqual(parseMentions("Halo @budi tolong cek @ani-sari ya"), ["budi", "ani-sari"]);
  assert.deepEqual(parseMentions("@budi @budi @budi."), ["budi"]);
  assert.deepEqual(parseMentions("kirim ke a@mail.com ya"), []);
  assert.deepEqual(parseMentions("(@citra), revisi!"), ["citra"]);
  assert.deepEqual(parseMentions(""), []);
  assert.deepEqual(parseMentions(null), []);
});

test("recordMentions simpan 1 ActivityEvent per @nama + inbox terbaca", async () => {
  const { db } = createMockDb();
  const svc = new TaskService(db as any);
  const t = await svc.createTask({ projectId: "p1", title: "Tolong @budi review @ani" });
  const rows = await recordMentions(db as any, {
    projectId: "p1",
    actorId: "u1",
    body: "setuju @budi, cc @budi lagi",
    source: { kind: "comment", id: "c1" },
  });
  assert.equal(rows.length, 1); // dedupe @budi ganda
  assert.equal(rows[0].action, "mention");

  await svc.assign(t.id, "budi", { actorId: "u1" });
  const inbox = await getMyInbox(db as any, { userId: "budi", userName: "budi" });
  assert.ok(inbox.tasks.some((x) => x.id === t.id), "task assigned masuk inbox");
  assert.ok(inbox.mentions.length >= 1, "mention masuk inbox");
  assert.ok(inbox.mentions.every((m) => m.action === "mention"));

  const other = await getMyInbox(db as any, { userId: "orang-lain", userName: "lain" });
  assert.equal(other.tasks.length, 0);
  assert.equal(other.mentions.length, 0);
});
