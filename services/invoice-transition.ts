/**
 * Invoice status state machine — pure, no I/O.
 * Mirrors the `planTransition` pattern in `vendor/payment/escrow-core.ts`:
 * a single table of allowed moves, everything else throws.
 */

export type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "PAID"
  | "OVERDUE"
  | "REFUNDED"
  | "CANCELLED";

const ALLOWED: ReadonlySet<string> = new Set([
  "DRAFT->SENT",
  "DRAFT->CANCELLED",
  "SENT->PAID",
  "SENT->OVERDUE",
  "SENT->CANCELLED",
  "SENT->REFUNDED",
  "OVERDUE->PAID",
  "OVERDUE->REFUNDED",
]);

export function isInvoiceTransitionAllowed(
  from: InvoiceStatus | string,
  to: InvoiceStatus | string,
): boolean {
  if (from === to) return true;
  return ALLOWED.has(`${from}->${to}`);
}

/**
 * Validate an invoice status move. No-op when `from === to`.
 * @throws Error with message `errors.invoice.bad_transition` on illegal moves.
 */
export function validateInvoiceTransition(
  from: InvoiceStatus | string,
  to: InvoiceStatus | string,
): void {
  if (isInvoiceTransitionAllowed(from, to)) return;
  throw new Error("errors.invoice.bad_transition");
}
