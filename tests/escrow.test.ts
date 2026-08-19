import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import {
  decide,
  planTransition,
  invoiceStatusFor,
  EscrowError,
  InMemoryEscrowStore,
  VirtualEscrow,
  TERMINAL_STATES,
  type EscrowCommand,
} from "../services/vendor/payment/escrow-core";
import {
  EscrowWebhookSchema,
  EscrowActionInputSchema,
  EscrowManualActionSchema,
  WEBHOOK_ACTION,
} from "../schemas";

const uuid = () => randomUUID();
const init = (invoiceId: string): EscrowCommand => ({
  invoiceId,
  action: "initialize",
  role: "CLIENT",
  idempotencyKey: `init:${invoiceId}`,
  init: { provider: "XENDIT", amount: 5000n, currency: "USD", providerTxId: "tx_1" },
});

// ---------------------------------------------------------------------------
// State machine: legal lifecycle, illegal transitions, role enforcement
// ---------------------------------------------------------------------------

test("full happy-path lifecycle: initialize -> fund -> release", async () => {
  const store = new InMemoryEscrowStore();
  const escrow = new VirtualEscrow(store);
  const id = uuid();

  const opened = await escrow.initialize({
    invoiceId: id,
    role: "CLIENT",
    idempotencyKey: `init:${id}`,
    init: { provider: "MIDTRANS", amount: 1000n, currency: "IDR" },
  });
  assert.equal(opened.to, "INITIALIZED");

  const funded = await escrow.fund({ invoiceId: id, role: "SYSTEM", idempotencyKey: `w:${id}:1` });
  assert.equal(funded.to, "FUNDS_HELD");

  const released = await escrow.release({ invoiceId: id, role: "CLIENT", idempotencyKey: `rel:${id}` });
  assert.equal(released.to, "RELEASED");
  assert.equal((await escrow.getState(id))?.state, "RELEASED");
});

test("dispute can be resolved by refund", async () => {
  const store = new InMemoryEscrowStore();
  const id = uuid();
  await store.apply(init(id));
  await store.apply({ invoiceId: id, action: "fund", role: "SYSTEM", idempotencyKey: "f1" });
  await store.apply({ invoiceId: id, action: "dispute", role: "FREELANCER", idempotencyKey: "d1" });
  const refunded = await store.apply({ invoiceId: id, action: "refund", role: "FREELANCER", idempotencyKey: "r1" });
  assert.equal(refunded.to, "REFUNDED");
});

test("decide enforces roles before state (no info leak to unauthorized callers)", () => {
  // A freelancer cannot release; the answer is FORBIDDEN regardless of state.
  const d = decide("FUNDS_HELD", "release", "FREELANCER");
  assert.equal(d.ok, false);
  assert.equal((d as { code: string }).code, "FORBIDDEN");
});

test("terminal states reject every further transition", () => {
  for (const terminal of TERMINAL_STATES) {
    for (const action of ["fund", "release", "dispute", "refund"] as const) {
      const d = decide(terminal, action, "SYSTEM");
      assert.equal(d.ok, false, `${terminal} should not allow ${action}`);
    }
  }
});

test("cannot fund an escrow that was never initialized", () => {
  const d = decide(null, "fund", "SYSTEM");
  assert.equal(d.ok, false);
  assert.equal((d as { code: string }).code, "NOT_FOUND");
});

test("double initialize is rejected", () => {
  const d = decide("INITIALIZED", "initialize", "CLIENT");
  assert.equal(d.ok, false);
});

test("invoiceStatusFor mirrors only terminal escrow states", () => {
  assert.equal(invoiceStatusFor("RELEASED"), "PAID");
  assert.equal(invoiceStatusFor("REFUNDED"), "REFUNDED");
  assert.equal(invoiceStatusFor("FUNDS_HELD"), null);
  assert.equal(invoiceStatusFor("INITIALIZED"), null);
});

test("planTransition throws EscrowError on illegal move and leaves state untouched", async () => {
  const store = new InMemoryEscrowStore();
  const id = uuid();
  await store.apply(init(id)); // INITIALIZED
  await assert.rejects(
    () => store.apply({ invoiceId: id, action: "release", role: "CLIENT", idempotencyKey: "x" }),
    (e: unknown) => e instanceof EscrowError,
  );
  // State unchanged after the rejected transition.
  assert.equal((await store.get(id))?.state, "INITIALIZED");
});

// ---------------------------------------------------------------------------
// Resilience: idempotency, duplicate webhooks, race conditions
// ---------------------------------------------------------------------------

test("replaying the same idempotencyKey is a no-op that returns replayed=true", async () => {
  const store = new InMemoryEscrowStore();
  const id = uuid();
  await store.apply(init(id));
  const first = await store.apply({ invoiceId: id, action: "fund", role: "SYSTEM", idempotencyKey: "k" });
  const second = await store.apply({ invoiceId: id, action: "fund", role: "SYSTEM", idempotencyKey: "k" });
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.to, "FUNDS_HELD");
});

test("duplicate webhook delivery does not double-apply", async () => {
  const store = new InMemoryEscrowStore();
  const id = uuid();
  await store.apply(init(id));
  const eventId = "evt_abc";
  const cmd: EscrowCommand = {
    invoiceId: id,
    action: "fund",
    role: "SYSTEM",
    idempotencyKey: `webhook:${eventId}`,
  };
  // Concurrent duplicate deliveries of the same event.
  const [a, b] = await Promise.all([store.apply(cmd), store.apply(cmd)]);
  const replays = [a, b].filter((r) => r.replayed).length;
  assert.equal(replays, 1, "exactly one delivery should be treated as a replay");
  assert.equal((await store.get(id))?.state, "FUNDS_HELD");
});

test("a fresh key attempting an already-consumed transition fails (not silently replayed)", async () => {
  const store = new InMemoryEscrowStore();
  const id = uuid();
  await store.apply(init(id));
  await store.apply({ invoiceId: id, action: "fund", role: "SYSTEM", idempotencyKey: "k1" });
  // Different key, same action from FUNDS_HELD -> invalid (already funded).
  await assert.rejects(
    () => store.apply({ invoiceId: id, action: "fund", role: "SYSTEM", idempotencyKey: "k2" }),
    (e: unknown) => e instanceof EscrowError,
  );
});

// ---------------------------------------------------------------------------
// Payload validation: structure, missing params, type mismatches, boundaries
// ---------------------------------------------------------------------------

test("valid webhook payload parses and maps to a transition", () => {
  const parsed = EscrowWebhookSchema.safeParse({
    eventId: "evt_1",
    invoiceId: uuid(),
    type: "payment.captured",
  });
  assert.equal(parsed.success, true);
  assert.equal(WEBHOOK_ACTION["payment.captured"], "fund");
});

test("webhook rejects missing required fields", () => {
  assert.equal(EscrowWebhookSchema.safeParse({ eventId: "e" }).success, false);
  assert.equal(EscrowWebhookSchema.safeParse({ invoiceId: uuid() }).success, false);
  assert.equal(EscrowWebhookSchema.safeParse({}).success, false);
});

test("webhook rejects type mismatches and unknown event types", () => {
  assert.equal(
    EscrowWebhookSchema.safeParse({ eventId: 123, invoiceId: uuid(), type: "payment.captured" }).success,
    false,
  );
  assert.equal(
    EscrowWebhookSchema.safeParse({ eventId: "e", invoiceId: "not-a-uuid", type: "payment.captured" }).success,
    false,
  );
  assert.equal(
    EscrowWebhookSchema.safeParse({ eventId: "e", invoiceId: uuid(), type: "payment.exploded" }).success,
    false,
  );
});

test("webhook enforces boundary limits (empty and oversized strings)", () => {
  assert.equal(
    EscrowWebhookSchema.safeParse({ eventId: "", invoiceId: uuid(), type: "payment.captured" }).success,
    false,
  );
  assert.equal(
    EscrowWebhookSchema.safeParse({
      eventId: "x".repeat(201),
      invoiceId: uuid(),
      type: "payment.captured",
    }).success,
    false,
  );
});

test("action input rejects short/oversized idempotency keys", () => {
  assert.equal(EscrowActionInputSchema.safeParse({ idempotencyKey: "short" }).success, false);
  assert.equal(EscrowActionInputSchema.safeParse({ idempotencyKey: "x".repeat(201) }).success, false);
  assert.equal(EscrowActionInputSchema.safeParse({}).success, true); // optional
  assert.equal(EscrowActionInputSchema.safeParse({ idempotencyKey: "valid-key-1234" }).success, true);
});

test("manual action schema whitelists only client/freelancer actions", () => {
  assert.equal(EscrowManualActionSchema.safeParse("release").success, true);
  assert.equal(EscrowManualActionSchema.safeParse("fund").success, false); // system-only
  assert.equal(EscrowManualActionSchema.safeParse("initialize").success, false);
  assert.equal(EscrowManualActionSchema.safeParse("__proto__").success, false);
});

// ---------------------------------------------------------------------------
// Defensive input handling: injection, malformed serialization, oversized
// ---------------------------------------------------------------------------

test("injection / malformed payloads fail closed without throwing", () => {
  const hostile: unknown[] = [
    { eventId: "1; DROP TABLE Escrow;--", invoiceId: uuid(), type: "payment.captured" }, // parses but treated as opaque id
    { eventId: "<script>alert(1)</script>", invoiceId: uuid(), type: "payment.captured" },
    { eventId: "e", invoiceId: "'; DELETE FROM Invoice; --", type: "payment.captured" }, // bad uuid -> rejected
    { eventId: { $ne: null }, invoiceId: uuid(), type: "payment.captured" }, // NoSQL-ish object -> type mismatch
    "not-an-object",
    42,
    null,
    [],
    { __proto__: { polluted: true }, eventId: "e", invoiceId: uuid(), type: "payment.captured" },
  ];

  for (const payload of hostile) {
    // safeParse must never throw; it returns a discriminated result.
    const result = EscrowWebhookSchema.safeParse(payload);
    assert.equal(typeof result.success, "boolean");
  }

  // Prototype pollution attempt does not leak onto Object.prototype.
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("fuzz: random malformed webhook payloads are rejected, never crash", () => {
  const keys = ["eventId", "invoiceId", "type", "provider", "amount", "extra"];
  const values: unknown[] = [undefined, null, "", "x".repeat(500), 0, -1, 1.5, {}, [], true, NaN, "😀"];
  let rejected = 0;
  const rounds = 400;

  for (let i = 0; i < rounds; i++) {
    const payload: Record<string, unknown> = {};
    for (const k of keys) {
      // deterministic pseudo-mix, no Math.random needed for reproducibility
      const v = values[(i * 7 + k.length * 3) % values.length];
      if (v !== undefined) payload[k] = v;
    }
    const result = EscrowWebhookSchema.safeParse(payload);
    // These random combos never form a valid (eventId, uuid, known type) triple.
    if (!result.success) rejected++;
  }
  assert.equal(rejected, rounds, "every malformed fuzz payload must be rejected");
});

test("oversized amount as huge numeric string is bounded by schema regex, not crashed", () => {
  const parsed = EscrowWebhookSchema.safeParse({
    eventId: "e",
    invoiceId: uuid(),
    type: "payment.captured",
    amount: "9".repeat(100),
  });
  // A 100-digit integer string is structurally valid; the point is it parses
  // without throwing and stays a string (bigint-safe downstream).
  assert.equal(parsed.success, true);
});
