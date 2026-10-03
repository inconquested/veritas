import assert from "node:assert/strict";
import test from "node:test";

import {
  createAction,
  dequeue,
  enqueue,
  peek,
  replayQueue,
  type QueuedAction,
} from "../lib/offline-queue";

function q(n: number): QueuedAction[] {
  return Array.from({ length: n }, (_, i) =>
    createAction("comment", "/api/comments", { body: `komentar ${i + 1}` }),
  );
}

test("enqueue FIFO + cap 100", () => {
  let queue: QueuedAction[] = [];
  for (const a of q(3)) queue = enqueue(queue, a);
  assert.equal(peek(queue)?.payload.body, "komentar 1");
  let big: QueuedAction[] = [];
  for (const a of q(105)) big = enqueue(big, a);
  assert.equal(big.length, 100);
  assert.equal(big[0].payload.body, "komentar 6");
});

test("dequeue mengeluarkan kepala", () => {
  const queue = q(2);
  const { head, rest } = dequeue(queue);
  assert.equal(head?.payload.body, "komentar 1");
  assert.equal(rest.length, 1);
  assert.deepEqual(dequeue([]), { head: null, rest: [] });
});

test("replay berurutan; berhenti di gagal pertama", async () => {
  const queue = q(3);
  const order: string[] = [];
  const res = await replayQueue(queue, async (a) => {
    order.push(String(a.payload.body));
    return a.payload.body !== "komentar 2";
  });
  assert.deepEqual(order, ["komentar 1", "komentar 2"]);
  assert.equal(res.sent.length, 1);
  assert.equal(res.failed?.payload.body, "komentar 2");
  assert.equal(res.remaining.length, 2);
  assert.equal(res.remaining[0].payload.body, "komentar 2");
  assert.equal(res.failed?.attempts, 1);
});

test("replay sukses semua -> antrean kosong", async () => {
  const res = await replayQueue(q(2), async () => true);
  assert.equal(res.failed, null);
  assert.equal(res.remaining.length, 0);
  assert.equal(res.sent.length, 2);
});

test("sender throw dianggap gagal (tidak lempar)", async () => {
  const res = await replayQueue(q(1), async () => {
    throw new Error("offline");
  });
  assert.equal(res.sent.length, 0);
  assert.notEqual(res.failed, null);
});
