import assert from "node:assert/strict";
import test from "node:test";

import { InvoiceService } from "../services/invoice-service";
import { xenditDurationFor } from "../services/vendor/payment/xendit-strategy";
import { stripeExpiresAtFor } from "../services/vendor/payment/stripe-strategy";
import { XenditStrategy } from "../services/vendor/payment/xendit-strategy";
import { StripeStrategy } from "../services/vendor/payment/stripe-strategy";

process.env.STRIPE_SECRET_KEY ??= "sk_test_x";
process.env.XENDIT_SECRET_KEY ??= "xendit_test";
process.env.MIDTRANS_SERVER_KEY ??= "server-key";
process.env.MIDTRANS_CLIENT_KEY ??= "client-key";

const ID = "11111111-1111-1111-1111-111111111111";
const PROJECT = "22222222-2222-2222-2222-222222222222";

function mockService(stored: unknown, gateway: { calls: number }) {
  const mockDb = {
    invoice: {
      findUnique: async () => stored,
      update: async () => ({}),
    },
  };
  const service = new InvoiceService("STRIPE", mockDb as never);
  const orig = InvoiceService.getStrategyByPaymentMethod;
  (InvoiceService as unknown as Record<string, unknown>).getStrategyByPaymentMethod =
    () => ({
      chargeInvoice: async () => {
        gateway.calls++;
        return { success: true, providerTxId: "tx_1" };
      },
    });
  return { service, restore: () => {
    (InvoiceService as unknown as Record<string, unknown>).getStrategyByPaymentMethod = orig;
  } };
}

// ---------------------------------------------------------------------------
// chargeInvoice past-due guard: rejected before hitting the gateway
// ---------------------------------------------------------------------------

test("chargeInvoice rejects past-due input.due_date without hitting gateway", async () => {
  const gateway = { calls: 0 };
  const { service, restore } = mockService(
    { project_id: PROJECT, payment_method: "STRIPE", due_date: new Date("2027-01-01"), status: "SENT" },
    gateway,
  );
  try {
    const result = await service.chargeInvoice({
      id: ID,
      project_id: PROJECT,
      payment_method: "STRIPE",
      due_date: new Date(Date.now() - 3600_000),
    } as never);
    assert.equal(result.success, false);
    assert.equal(
      (result as { errorKey?: string }).errorKey,
      "errors.invoice.past_due",
    );
    assert.equal(gateway.calls, 0, "gateway must not be hit for expired invoices");
  } finally {
    restore();
  }
});

test("chargeInvoice rejects when stored invoice is past-due (no due_date in input)", async () => {
  const gateway = { calls: 0 };
  const { service, restore } = mockService(
    { project_id: PROJECT, payment_method: "STRIPE", due_date: new Date(Date.now() - 86_400_000), status: "SENT" },
    gateway,
  );
  try {
    const result = await service.chargeInvoice({
      id: ID,
      project_id: PROJECT,
      payment_method: "STRIPE",
    } as never);
    assert.equal(result.success, false);
    assert.equal(
      (result as { errorKey?: string }).errorKey,
      "errors.invoice.past_due",
    );
    assert.equal(gateway.calls, 0);
  } finally {
    restore();
  }
});

test("chargeInvoice with future due_date hits the gateway", async () => {
  const gateway = { calls: 0 };
  const { service, restore } = mockService(
    { project_id: PROJECT, payment_method: "STRIPE", due_date: new Date(Date.now() + 86_400_000), status: "SENT" },
    gateway,
  );
  try {
    const result = await service.chargeInvoice({
      id: ID,
      project_id: PROJECT,
      payment_method: "STRIPE",
      due_date: new Date(Date.now() + 86_400_000),
    } as never);
    assert.equal(result.success, true);
    assert.equal(gateway.calls, 1);
  } finally {
    restore();
  }
});

test("chargeInvoice blocks illegal status (PAID -> SENT) before gateway", async () => {
  const gateway = { calls: 0 };
  const { service, restore } = mockService(
    { project_id: PROJECT, payment_method: "STRIPE", due_date: new Date(Date.now() + 86_400_000), status: "PAID" },
    gateway,
  );
  try {
    const result = await service.chargeInvoice({
      id: ID,
      project_id: PROJECT,
      payment_method: "STRIPE",
      due_date: new Date(Date.now() + 86_400_000),
    } as never);
    assert.equal(result.success, false);
    assert.equal(
      (result as { errorKey?: string }).errorKey,
      "errors.invoice.bad_transition",
    );
    assert.equal(gateway.calls, 0);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Xendit invoiceDuration derived from due_date
// ---------------------------------------------------------------------------

test("xenditDurationFor: ~2h window yields ~7200s", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const due = new Date(now.getTime() + 2 * 3600_000);
  assert.equal(xenditDurationFor(due, now), 7200);
});

test("xenditDurationFor: past-due clamps to minimum (>0)", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const past = new Date(now.getTime() - 3600_000);
  const d = xenditDurationFor(past, now);
  assert.ok(d > 0, `expected clamp > 0, got ${d}`);
  assert.equal(d, 60);
});

test("XenditStrategy forwards computed duration (not hardcoded 600)", async () => {
  const strategy = new XenditStrategy();
  let captured: { invoiceDuration?: number } | undefined;
  (strategy as unknown as Record<string, { createInvoice: (args: unknown) => Promise<unknown> }>).xenditInvoiceClient = {
    createInvoice: async (args: unknown) => {
      captured = (args as { data: { invoiceDuration?: number } }).data;
      return { id: "x_1", invoiceUrl: "https://x.test/1" };
    },
  } as never;
  const now = Date.now();
  await strategy.chargeInvoice({
    id: ID,
    project_id: PROJECT,
    title: "T",
    currency: "IDR",
    amount: 100000n,
    payment_method: "XENDIT",
    due_date: new Date(now + 3 * 3600_000),
  } as never);
  assert.ok(captured?.invoiceDuration != null);
  assert.ok(
    Math.abs((captured?.invoiceDuration ?? 0) - 3 * 3600) <= 60,
    `expected ~10800, got ${captured?.invoiceDuration}`,
  );
  assert.notEqual(captured?.invoiceDuration, 600);
});

// ---------------------------------------------------------------------------
// Stripe expires_at derived from due_date with clamp
// ---------------------------------------------------------------------------

test("stripeExpiresAtFor: future due maps to its epoch seconds", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const due = new Date(now.getTime() + 5 * 3600_000);
  assert.equal(stripeExpiresAtFor(due, now), Math.floor(due.getTime() / 1000));
});

test("stripeExpiresAtFor: past-due clamps to future (> now)", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const past = new Date(now.getTime() - 3600_000);
  const exp = stripeExpiresAtFor(past, now);
  assert.ok(exp > Math.floor(now.getTime() / 1000), `expected future clamp, got ${exp}`);
});

test("StripeStrategy forwards due_date-based expires_at (not a raw diff)", async () => {
  const strategy = new StripeStrategy();
  let captured: { expires_at?: number } | undefined;
  (strategy as unknown as Record<string, { checkout: { sessions: { create: (args: unknown) => Promise<unknown> } } }>).stripe = {
    checkout: {
      sessions: {
        create: async (args: unknown) => {
          captured = args as { expires_at?: number };
          return { id: "cs_1", url: "https://s.test/1" };
        },
      },
    },
  } as never;
  const due = new Date(Date.now() + 6 * 3600_000);
  await strategy.chargeInvoice({
    id: ID,
    project_id: PROJECT,
    title: "T",
    currency: "USD",
    amount: 5000n,
    payment_method: "STRIPE",
    due_date: due,
  } as never);
  assert.ok(captured?.expires_at != null);
  assert.ok(captured!.expires_at! > 0);
  // Must be an absolute epoch (~due), not a small diff like 21600.
  assert.ok(
    Math.abs(captured!.expires_at! - Math.floor(due.getTime() / 1000)) <= 60,
    `expected epoch ~${Math.floor(due.getTime() / 1000)}, got ${captured?.expires_at}`,
  );
});
