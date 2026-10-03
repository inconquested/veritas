import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {
  EscrowError,
  InMemoryEscrowStore,
  VirtualEscrow,
  invoiceStatusFor,
  planTransition,
  type EscrowApplyResult,
  type EscrowCommand,
  type EscrowRecord,
  type EscrowRole,
  type EscrowStore,
  type EscrowStrategy,
} from "./vendor/payment/escrow-core";
import { validateInvoiceTransition } from "./invoice-transition";

function toRecord(row: {
  invoiceId: string;
  provider: string;
  providerTxId: string | null;
  amount: bigint;
  currency: string;
  status: string;
  updatedAt?: Date;
}): EscrowRecord {
  return {
    invoiceId: row.invoiceId,
    provider: row.provider,
    providerTxId: row.providerTxId,
    amount: row.amount,
    currency: row.currency,
    state: row.status as EscrowRecord["state"],
    updatedAt: row.updatedAt,
  };
}

/**
 * Prisma-backed store. Every mutation runs in a single $transaction so the
 * escrow row, the audit event, and the mirrored invoice status either all
 * commit or none do. The unique idempotencyKey on EscrowEvent is the atomic
 * dedupe backstop: a duplicate request either short-circuits on the pre-read or
 * loses the P2002 race and is re-read as a replay.
 */
export class PrismaEscrowStore implements EscrowStore {
  constructor(private readonly db: typeof prisma = prisma) {}

  async get(invoiceId: string): Promise<EscrowRecord | null> {
    const row = await this.db.escrow.findUnique({ where: { invoiceId } });
    return row ? toRecord(row) : null;
  }

  async apply(cmd: EscrowCommand): Promise<EscrowApplyResult> {
    try {
      return await this.db.$transaction(async (tx) => {
        const existingEvent = await tx.escrowEvent.findUnique({
          where: { idempotencyKey: cmd.idempotencyKey },
          include: { escrow: true },
        });
        if (existingEvent) {
          return {
            record: toRecord(existingEvent.escrow),
            from: existingEvent.fromStatus as EscrowRecord["state"] | null,
            to: existingEvent.toStatus as EscrowRecord["state"],
            replayed: true,
          };
        }

        const currentRow = await tx.escrow.findUnique({
          where: { invoiceId: cmd.invoiceId },
        });
        const current = currentRow ? toRecord(currentRow) : null;
        const { from, to, record } = planTransition(current, cmd);

        const escrow =
          cmd.action === "initialize"
            ? await tx.escrow.create({
                data: {
                  invoiceId: record.invoiceId,
                  provider: record.provider,
                  providerTxId: record.providerTxId,
                  amount: record.amount,
                  currency: record.currency as never,
                  status: to as never,
                },
              })
            : await tx.escrow.update({
                where: { invoiceId: cmd.invoiceId },
                data: { status: to as never },
              });

        await tx.escrowEvent.create({
          data: {
            escrowId: escrow.id,
            idempotencyKey: cmd.idempotencyKey,
            action: cmd.action,
            actorRole: cmd.role,
            fromStatus: from as never,
            toStatus: to as never,
            metadata: (cmd.metadata ?? undefined) as never,
          },
        });

        const invoiceStatus = invoiceStatusFor(to);
        if (invoiceStatus) {
          const currentInvoice = await tx.invoice.findUnique({
            where: { id: cmd.invoiceId },
            select: { status: true },
          });
          if (currentInvoice && currentInvoice.status !== invoiceStatus) {
            validateInvoiceTransition(
              currentInvoice.status as string,
              invoiceStatus,
            );
          }
          await tx.invoice.update({
            where: { id: cmd.invoiceId },
            data: { status: invoiceStatus as never },
          });
        }

        return { record: toRecord(escrow), from, to, replayed: false };
      });
    } catch (error) {
      // Lost the idempotencyKey race: another concurrent request applied it
      // first. Re-read and report it as a replay instead of a failure.
      if (isUniqueViolation(error)) {
        const event = await this.db.escrowEvent.findUnique({
          where: { idempotencyKey: cmd.idempotencyKey },
          include: { escrow: true },
        });
        if (event) {
          return {
            record: toRecord(event.escrow),
            from: event.fromStatus as EscrowRecord["state"] | null,
            to: event.toStatus as EscrowRecord["state"],
            replayed: true,
          };
        }
      }
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

export class EscrowService {
  private readonly escrow: EscrowStrategy;

  constructor(
    store: EscrowStore = new PrismaEscrowStore(),
    private readonly db: typeof prisma = prisma,
  ) {
    this.escrow = new VirtualEscrow(store);
  }

  getState(invoiceId: string) {
    return this.escrow.getState(invoiceId);
  }

  /** Whitelisted audit events for timelines (portal publik + dashboard). */
  async getEvents(invoiceId: string) {
    const escrow = await this.db.escrow.findUnique({
      where: { invoiceId },
      select: {
        events: {
          select: {
            id: true,
            action: true,
            actorRole: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
            metadata: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return escrow?.events ?? [];
  }

  /** Opens escrow from the invoice's own amount/currency/provider. */
  async initialize(invoiceId: string, role: EscrowRole, idempotencyKey: string) {
    const invoice = await this.db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new EscrowError("Invoice not found", "NOT_FOUND");
    return this.escrow.initialize({
      invoiceId,
      role,
      idempotencyKey,
      init: {
        provider: invoice.payment_method,
        providerTxId: invoice.providerTxId,
        amount: invoice.amount,
        currency: invoice.currency,
      },
    });
  }

  transition(
    action: "fund" | "release" | "dispute" | "refund",
    invoiceId: string,
    role: EscrowRole,
    idempotencyKey: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.escrow[action]({ invoiceId, role, idempotencyKey, metadata });
  }

  /**
   * Resolve the acting role from the Clerk session against THIS invoice's
   * project. Returns null when the caller is neither the invoice's client nor
   * its freelancer — the authorization boundary for release/dispute/refund.
   */
  async resolveActor(invoiceId: string): Promise<EscrowRole | null> {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const user = await this.db.user.findUnique({
      where: { clerkUserId: clerkUser.id },
      select: { id: true },
    });
    if (!user) return null;

    const invoice = await this.db.invoice.findUnique({
      where: { id: invoiceId },
      select: { project: { select: { clientId: true, freelancerId: true } } },
    });
    if (!invoice) return null;

    if (invoice.project.clientId === user.id) return "CLIENT";
    if (invoice.project.freelancerId === user.id) return "FREELANCER";
    return null;
  }
}

export const escrowService = new EscrowService();
