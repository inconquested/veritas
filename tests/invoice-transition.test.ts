import assert from "node:assert/strict";
import test from "node:test";

import {
  isInvoiceTransitionAllowed,
  validateInvoiceTransition,
} from "../services/invoice-transition";

// ---------------------------------------------------------------------------
// Legal transitions (TASK F0: 8 allowed moves)
// ---------------------------------------------------------------------------

test("DRAFT -> SENT is allowed", () => {
  validateInvoiceTransition("DRAFT", "SENT");
  assert.equal(isInvoiceTransitionAllowed("DRAFT", "SENT"), true);
});

test("DRAFT -> CANCELLED is allowed", () => {
  validateInvoiceTransition("DRAFT", "CANCELLED");
});

test("SENT -> PAID is allowed", () => {
  validateInvoiceTransition("SENT", "PAID");
});

test("SENT -> OVERDUE is allowed", () => {
  validateInvoiceTransition("SENT", "OVERDUE");
});

test("SENT -> CANCELLED is allowed", () => {
  validateInvoiceTransition("SENT", "CANCELLED");
});

test("SENT -> REFUNDED is allowed", () => {
  validateInvoiceTransition("SENT", "REFUNDED");
});

test("OVERDUE -> PAID is allowed", () => {
  validateInvoiceTransition("OVERDUE", "PAID");
});

test("OVERDUE -> REFUNDED is allowed", () => {
  validateInvoiceTransition("OVERDUE", "REFUNDED");
});

test("same-status is a no-op (no throw)", () => {
  for (const s of ["DRAFT", "SENT", "PAID", "OVERDUE", "REFUNDED", "CANCELLED"]) {
    validateInvoiceTransition(s, s);
    assert.equal(isInvoiceTransitionAllowed(s, s), true);
  }
});

// ---------------------------------------------------------------------------
// Illegal transitions -> throw errors.invoice.bad_transition
// ---------------------------------------------------------------------------

function assertBadTransition(from: string, to: string) {
  assert.throws(
    () => validateInvoiceTransition(from, to),
    (e: unknown) =>
      e instanceof Error && e.message === "errors.invoice.bad_transition",
    `${from} -> ${to} must throw errors.invoice.bad_transition`,
  );
  assert.equal(isInvoiceTransitionAllowed(from, to), false);
}

test("DRAFT -> PAID directly is rejected (must go via SENT)", () => {
  assertBadTransition("DRAFT", "PAID");
});

test("DRAFT -> OVERDUE and DRAFT -> REFUNDED are rejected", () => {
  assertBadTransition("DRAFT", "OVERDUE");
  assertBadTransition("DRAFT", "REFUNDED");
});

test("SENT -> DRAFT (backwards) is rejected", () => {
  assertBadTransition("SENT", "DRAFT");
});

test("PAID is terminal: any move out is rejected", () => {
  assertBadTransition("PAID", "REFUNDED");
  assertBadTransition("PAID", "SENT");
  assertBadTransition("PAID", "OVERDUE");
});

test("REFUNDED is terminal: any move out is rejected", () => {
  assertBadTransition("REFUNDED", "PAID");
  assertBadTransition("REFUNDED", "SENT");
});

test("OVERDUE -> CANCELLED and OVERDUE -> SENT are rejected (not in allow-list)", () => {
  assertBadTransition("OVERDUE", "CANCELLED");
  assertBadTransition("OVERDUE", "SENT");
});

test("CANCELLED is terminal: any move out is rejected", () => {
  assertBadTransition("CANCELLED", "SENT");
  assertBadTransition("CANCELLED", "DRAFT");
});
