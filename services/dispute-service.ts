import prisma from "@/lib/prisma";
import { escrowService } from "./escrow-service";
import { send as sendNotify } from "./vendor/notify/notify-service";

/** Fire-and-forget notify: gagal kirim tidak boleh merusak transaksi utama. */
async function notifySafely(
  to: string | null | undefined,
  template: Parameters<typeof sendNotify>[1],
  payload: Parameters<typeof sendNotify>[2],
): Promise<void> {
  if (!to) return;
  try {
    await sendNotify(to, template, payload);
  } catch {
    // Notif best-effort; idempotency dijamin via NotifyLog saat retry.
  }
}

export const DISPUTE_ALREADY_OPEN = "errors.dispute.already_open";
export const DISPUTE_DEADLINE_PASSED = "errors.dispute.deadline_passed";
export const DISPUTE_NOT_FOUND = "errors.dispute.not_found";
export const DISPUTE_EMPTY_REASON = "errors.dispute.empty_reason";
export const DISPUTE_ALREADY_RESOLVED = "errors.dispute.already_resolved";

/** Default auto-deadline ala Projects.co.id: 7×24 jam, configurable per project. */
export const DEFAULT_DISPUTE_DEADLINE_DAYS = 7;

const OPEN_STATES = ["OPEN", "NEGOTIATING"];
const RESOLVED_STATES = ["RESOLVED_REFUND", "RESOLVED_RELEASE", "ESCALATED"];

export type DisputeOutcome = "REFUND" | "RELEASE";

export type OpenDisputeOpts = {
  invoiceId?: string;
  role?: "CLIENT" | "FREELANCER";
  /** Override deadline (hari). Default 7; config per project bisa masuk sini. */
  deadlineDays?: number;
  requestedAmount?: bigint | number | null;
  /** Alamat notif eksplisit (email/WA). Kosong = lookup DB best-effort. */
  notifyTo?: string | null;
};

/** Injectable escrow transition — default-nya fungsi yang SUDAH ADA di escrow-service. */
export type EscrowTransitionFn = (
  action: "dispute" | "release" | "refund",
  invoiceId: string,
  role: "CLIENT" | "FREELANCER" | "SYSTEM",
  idempotencyKey: string,
  metadata?: Record<string, unknown>,
) => Promise<unknown>;

/**
 * F2 dispute lifecycle. Double-open dicegah via status OPEN/NEGOTIATING +
 * unique escrowId; resolve HARUS lewat transisi escrow yang sudah ada
 * (EscrowService.transition) supaya EscrowEvent tercatat; resolve lewat
 * deadline ditolak. `db` loose-typed sampai `prisma generate` jalan
 * (TODO: tighten post-migrate).
 */
export class DisputeService {
  constructor(
    private readonly db: {
      dispute: any;
      escrow?: any;
    } = prisma as any,
    private readonly transition: EscrowTransitionFn = (
      action,
      invoiceId,
      role,
      key,
      metadata,
    ) =>
      escrowService.transition(action, invoiceId, role, key, metadata),
  ) {}

  private deadlineFrom(days: number): Date {
    return new Date(Date.now() + days * 86_400_000);
  }

  private async resolveInvoiceId(
    escrowId: string,
    hint?: string,
  ): Promise<string> {
    if (hint) return hint;
    const escrow = await this.db.escrow?.findUnique({
      where: { id: escrowId },
      select: { invoiceId: true },
    });
    if (!escrow?.invoiceId) throw new Error(DISPUTE_NOT_FOUND);
    return escrow.invoiceId as string;
  }

  private async resolveNotifyTo(
    escrowId: string,
    invoiceId?: string,
    explicit?: string | null,
  ): Promise<string | null> {
    if (explicit) return explicit;
    try {
      const inv = await (this.db as any).invoice?.findUnique?.({
        where: { id: invoiceId ?? undefined },
        select: {
          title: true,
          amount: true,
          currency: true,
          project: {
            select: {
              title: true,
              client: { select: { email: true, phone: true } },
            },
          },
        },
      });
      void escrowId;
      const client = (inv?.project as any)?.client;
      return (client?.phone as string | null) ?? (client?.email as string | null) ?? null;
    } catch {
      return null;
    }
  }

  async openDispute(
    escrowId: string,
    reason: string,
    requestedAmount?: bigint | number | null,
    opts: OpenDisputeOpts = {},
  ) {
    if (!reason?.trim()) throw new Error(DISPUTE_EMPTY_REASON);
    const existing = await this.db.dispute.findFirst({
      where: { escrowId, status: { in: OPEN_STATES } },
    });
    if (existing) throw new Error(DISPUTE_ALREADY_OPEN);

    const deadlineAt = this.deadlineFrom(
      opts.deadlineDays ?? DEFAULT_DISPUTE_DEADLINE_DAYS,
    );
    const row = await this.db.dispute.create({
      data: {
        escrowId,
        reason: reason.trim(),
        requestedAmount:
          requestedAmount == null ? null : BigInt(requestedAmount),
        status: "OPEN",
        deadlineAt,
      },
    });

    const invoiceId = await this.resolveInvoiceId(escrowId, opts.invoiceId);
    await this.transition(
      "dispute",
      invoiceId,
      opts.role ?? "CLIENT",
      `dispute:${escrowId}:open`,
      { disputeId: row.id },
    );
    // Wave integrasi: emit dispute.opened (best-effort, try/catch di dalam).
    await notifySafely(await this.resolveNotifyTo(escrowId, invoiceId, opts.notifyTo), "dispute.opened", {
      entityId: row.id,
      deadline: deadlineAt,
      projectTitle: null,
      invoiceTitle: String(requestedAmount ?? row.id),
      amount: requestedAmount ?? null,
      currency: "IDR",
    });
    return row;
  }

  /** Freelancer/klien merespons → status NEGOTIATING. Isi respons = komentar (evidence). */
  async respondDispute(disputeId: string) {
    const dispute = await this.db.dispute.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) throw new Error(DISPUTE_NOT_FOUND);
    if (dispute.status !== "OPEN") throw new Error(DISPUTE_ALREADY_RESOLVED);
    return this.db.dispute.update({
      where: { id: disputeId },
      data: { status: "NEGOTIATING" },
    });
  }

  async resolveDispute(
    disputeId: string,
    outcome: DisputeOutcome,
    opts: { invoiceId?: string; notifyTo?: string | null } = {},
  ) {
    const dispute = await this.db.dispute.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) throw new Error(DISPUTE_NOT_FOUND);
    if (RESOLVED_STATES.includes(dispute.status))
      throw new Error(DISPUTE_ALREADY_RESOLVED);
    if (new Date(dispute.deadlineAt).getTime() < Date.now())
      throw new Error(DISPUTE_DEADLINE_PASSED);

    const invoiceId = await this.resolveInvoiceId(dispute.escrowId, opts.invoiceId);
    let status: string;
    if (outcome === "REFUND") {
      await this.transition(
        "refund",
        invoiceId,
        "SYSTEM",
        `dispute:${disputeId}:refund`,
        { disputeId },
      );
      status = "RESOLVED_REFUND";
    } else {
      await this.transition(
        "release",
        invoiceId,
        "SYSTEM",
        `dispute:${disputeId}:release`,
        { disputeId },
      );
      status = "RESOLVED_RELEASE";
    }
    const updated = await this.db.dispute.update({
      where: { id: disputeId },
      data: { status },
    });
    // Wave integrasi: emit dispute.resolved (best-effort).
    await notifySafely(await this.resolveNotifyTo(dispute.escrowId, invoiceId, opts.notifyTo), "dispute.resolved", {
      entityId: disputeId,
      deadline: (dispute as any).deadlineAt ?? null,
      projectTitle: null,
      invoiceTitle: disputeId,
      amount: (dispute as any).requestedAmount ?? null,
      currency: "IDR",
    });
    return updated;
  }

  getDispute(disputeId: string) {
    return this.db.dispute.findUnique({ where: { id: disputeId } });
  }

  /** Semua dispute untuk escrow-escrow tertentu (dipakai portal + dashboard). */
  listForEscrows(escrowIds: string[]) {
    if (escrowIds.length === 0) return Promise.resolve([]);
    return this.db.dispute.findMany({
      where: { escrowId: { in: escrowIds } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Dispute per project: via invoice → escrow (Dispute hanya simpan escrowId). */
  async listForProject(projectId: string) {
    const invoices = await (this.db as any).invoice?.findMany({
      where: { project_id: projectId },
      select: { escrow: { select: { id: true } } },
    });
    const escrowIds = (invoices ?? [])
      .map((inv: any) => inv?.escrow?.id)
      .filter(Boolean);
    return this.listForEscrows(escrowIds);
  }
}

export const disputeService = new DisputeService();
