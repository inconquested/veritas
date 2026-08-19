/**
 * Virtual escrow core — a provider-agnostic hold/release/dispute/refund state
 * machine. None of the wired gateways (Stripe/PayPal/Xendit/Midtrans hosted
 * checkout) expose a programmable escrow, so we model one identically for all
 * of them in our own ledger. This module is pure: no Prisma, no gateway SDKs,
 * no I/O — which keeps the transition rules and idempotency logic unit-testable
 * without a database. Atomicity lives in the EscrowStore implementations.
 */

export type EscrowState =
  | "INITIALIZED"
  | "FUNDS_HELD"
  | "DISPUTED"
  | "RELEASED"
  | "REFUNDED";

export type EscrowAction =
  | "initialize"
  | "fund"
  | "release"
  | "dispute"
  | "refund";

export type EscrowRole = "CLIENT" | "FREELANCER" | "SYSTEM";

export const TERMINAL_STATES: readonly EscrowState[] = ["RELEASED", "REFUNDED"];

// The whole policy in one table: which action moves which states where, and
// who is allowed to trigger it. `from: null` means "no escrow row yet".
const TRANSITIONS: Record<
  EscrowAction,
  { from: EscrowState[] | null; to: EscrowState; roles: EscrowRole[] }
> = {
  // Client (or system on charge) opens the escrow once a checkout is created.
  initialize: {
    from: null,
    to: "INITIALIZED",
    roles: ["CLIENT", "FREELANCER", "SYSTEM"],
  },
  // Gateway webhook confirms the buyer actually paid -> funds are now held.
  fund: { from: ["INITIALIZED"], to: "FUNDS_HELD", roles: ["SYSTEM"] },
  // Client releases held funds to the freelancer (also resolves a dispute).
  release: { from: ["FUNDS_HELD", "DISPUTED"], to: "RELEASED", roles: ["CLIENT", "SYSTEM"] },
  // Either party can raise a dispute while funds are held.
  dispute: { from: ["FUNDS_HELD"], to: "DISPUTED", roles: ["CLIENT", "FREELANCER"] },
  // Freelancer (or system on a resolved dispute) refunds the client.
  refund: { from: ["FUNDS_HELD", "DISPUTED"], to: "REFUNDED", roles: ["FREELANCER", "SYSTEM"] },
};

export class EscrowError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_TRANSITION"
      | "FORBIDDEN"
      | "MISSING_INIT"
      | "NOT_FOUND" = "INVALID_TRANSITION",
  ) {
    super(message);
    this.name = "EscrowError";
  }
}

export type Decision =
  | { ok: true; to: EscrowState }
  | { ok: false; code: EscrowError["code"]; reason: string };

/**
 * Pure decision: given the current state (or null if no escrow yet), can `role`
 * perform `action`, and if so what is the next state? Role is checked before
 * state so an unauthorized caller never learns the escrow's status.
 */
export function decide(
  current: EscrowState | null,
  action: EscrowAction,
  role: EscrowRole,
): Decision {
  const rule = TRANSITIONS[action];
  if (!rule) {
    return { ok: false, code: "INVALID_TRANSITION", reason: `Unknown action: ${action}` };
  }
  if (!rule.roles.includes(role)) {
    return { ok: false, code: "FORBIDDEN", reason: `Role ${role} may not ${action}` };
  }
  if (rule.from === null) {
    if (current !== null) {
      return { ok: false, code: "INVALID_TRANSITION", reason: "Escrow already initialized" };
    }
    return { ok: true, to: rule.to };
  }
  if (current === null) {
    return { ok: false, code: "NOT_FOUND", reason: "Escrow not initialized" };
  }
  if (!rule.from.includes(current)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      reason: `Cannot ${action} from ${current}`,
    };
  }
  return { ok: true, to: rule.to };
}

/** Invoice.status to sync when escrow reaches a terminal state, else null. */
export function invoiceStatusFor(to: EscrowState): "PAID" | "REFUNDED" | null {
  if (to === "RELEASED") return "PAID";
  if (to === "REFUNDED") return "REFUNDED";
  return null;
}

export interface EscrowRecord {
  invoiceId: string;
  provider: string;
  providerTxId: string | null;
  amount: bigint;
  currency: string;
  state: EscrowState;
  updatedAt?: Date;
}

export interface EscrowCommand {
  invoiceId: string;
  action: EscrowAction;
  role: EscrowRole;
  /** Dedupe key. A repeated key returns the prior result without re-applying. */
  idempotencyKey: string;
  /** Required on `initialize`; ignored otherwise. */
  init?: {
    provider: string;
    providerTxId?: string | null;
    amount: bigint;
    currency: string;
  };
  metadata?: Record<string, unknown>;
}

export interface EscrowApplyResult {
  record: EscrowRecord;
  from: EscrowState | null;
  to: EscrowState;
  /** true when the idempotencyKey had already been applied (no-op replay). */
  replayed: boolean;
}

/**
 * Pure planner shared by every store: validates the transition and produces the
 * next record. Throws EscrowError on an illegal move. Stores call this *inside*
 * their atomic boundary, after reading current state and checking the key.
 */
export function planTransition(
  current: EscrowRecord | null,
  cmd: EscrowCommand,
): { from: EscrowState | null; to: EscrowState; record: EscrowRecord } {
  const decision = decide(current?.state ?? null, cmd.action, cmd.role);
  if (!decision.ok) {
    throw new EscrowError(decision.reason, decision.code);
  }

  if (cmd.action === "initialize") {
    if (!cmd.init) {
      throw new EscrowError("initialize requires init payload", "MISSING_INIT");
    }
    return {
      from: null,
      to: decision.to,
      record: {
        invoiceId: cmd.invoiceId,
        provider: cmd.init.provider,
        providerTxId: cmd.init.providerTxId ?? null,
        amount: cmd.init.amount,
        currency: cmd.init.currency,
        state: decision.to,
      },
    };
  }

  // Non-initialize actions require an existing record (decide already guards).
  if (!current) {
    throw new EscrowError("Escrow not initialized", "NOT_FOUND");
  }
  return {
    from: current.state,
    to: decision.to,
    record: { ...current, state: decision.to },
  };
}

/**
 * Reference in-memory EscrowStore. Not for production (no persistence, no real
 * concurrency), but it exercises the exact same planTransition + idempotency
 * path as the Prisma store, so tests can drive the full lifecycle DB-free.
 */
export class InMemoryEscrowStore implements EscrowStore {
  private records = new Map<string, EscrowRecord>();
  private applied = new Map<string, EscrowApplyResult>();

  async get(invoiceId: string): Promise<EscrowRecord | null> {
    const r = this.records.get(invoiceId);
    return r ? { ...r } : null;
  }

  async apply(cmd: EscrowCommand): Promise<EscrowApplyResult> {
    const prior = this.applied.get(cmd.idempotencyKey);
    if (prior) {
      return { ...prior, replayed: true };
    }
    const current = this.records.get(cmd.invoiceId) ?? null;
    const { from, to, record } = planTransition(current, cmd);
    this.records.set(cmd.invoiceId, record);
    const result: EscrowApplyResult = { record: { ...record }, from, to, replayed: false };
    this.applied.set(cmd.idempotencyKey, result);
    return result;
  }
}

export interface EscrowStore {
  get(invoiceId: string): Promise<EscrowRecord | null>;
  /** Atomic + idempotent: read, validate, persist record + audit event. */
  apply(cmd: EscrowCommand): Promise<EscrowApplyResult>;
}

/**
 * The standardized escrow interface, identical for every payment strategy. Each
 * method maps 1:1 to a state transition. Any gateway that later grows native
 * escrow support just needs its own class implementing this same interface.
 */
export interface EscrowStrategy {
  initialize(
    args: {
      invoiceId: string;
      role: EscrowRole;
      idempotencyKey: string;
      init: NonNullable<EscrowCommand["init"]>;
      metadata?: Record<string, unknown>;
    },
  ): Promise<EscrowApplyResult>;
  fund(a: TransitionArgs): Promise<EscrowApplyResult>;
  release(a: TransitionArgs): Promise<EscrowApplyResult>;
  dispute(a: TransitionArgs): Promise<EscrowApplyResult>;
  refund(a: TransitionArgs): Promise<EscrowApplyResult>;
  getState(invoiceId: string): Promise<EscrowRecord | null>;
}

export interface TransitionArgs {
  invoiceId: string;
  role: EscrowRole;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

/**
 * Virtual escrow: the single implementation shared by all gateways here. It
 * holds no gateway credentials — the state lives entirely in our EscrowStore.
 */
export class VirtualEscrow implements EscrowStrategy {
  constructor(private readonly store: EscrowStore) {}

  initialize(args: {
    invoiceId: string;
    role: EscrowRole;
    idempotencyKey: string;
    init: NonNullable<EscrowCommand["init"]>;
    metadata?: Record<string, unknown>;
  }) {
    return this.store.apply({ ...args, action: "initialize" });
  }

  fund(a: TransitionArgs) {
    return this.store.apply({ ...a, action: "fund" });
  }
  release(a: TransitionArgs) {
    return this.store.apply({ ...a, action: "release" });
  }
  dispute(a: TransitionArgs) {
    return this.store.apply({ ...a, action: "dispute" });
  }
  refund(a: TransitionArgs) {
    return this.store.apply({ ...a, action: "refund" });
  }
  getState(invoiceId: string) {
    return this.store.get(invoiceId);
  }
}
