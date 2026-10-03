import prisma from "@/lib/prisma";
import { send as sendNotify } from "./vendor/notify/notify-service";

export const TICKET_SEVERITIES = ["KRITIS", "TINGGI", "NORMAL"] as const;
export type TicketSeverity = (typeof TICKET_SEVERITIES)[number];

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const TERMINAL = new Set(["RESOLVED", "CLOSED"]);

const SLA_HOURS: Record<TicketSeverity, number> = {
  KRITIS: 4,
  TINGGI: 24,
  NORMAL: 72,
};

const TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "OPEN"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};

export const TICKET_BAD_SEVERITY = "errors.ticket.bad_severity";
export const TICKET_BAD_TRANSITION = "errors.ticket.bad_transition";
export const TICKET_NOT_FOUND = "errors.ticket.not_found";
export const TICKET_MISSING_PROJECT = "errors.ticket.missing_project";

export type TicketLike = {
  id: string | number;
  status: string;
  severity?: string;
  slaDue?: Date | string | null;
};

/** SLA due murni: KRITIS +4 jam, TINGGI +24 jam, NORMAL +72 jam. */
export function slaDueFor(severity: string, from: Date = new Date()): Date {
  const hours = (SLA_HOURS as Record<string, number>)[severity];
  if (hours === undefined) throw new Error(TICKET_BAD_SEVERITY);
  return new Date(from.getTime() + hours * 3_600_000);
}

/** Murni: breach = lewat slaDue dan belum terminal (RESOLVED/CLOSED aman). */
export function isSlaBreached(ticket: TicketLike, now: Date = new Date()): boolean {
  if (!ticket?.slaDue || TERMINAL.has(String(ticket.status))) return false;
  const due = ticket.slaDue instanceof Date ? ticket.slaDue : new Date(ticket.slaDue);
  if (Number.isNaN(due.getTime())) return false;
  return now.getTime() > due.getTime();
}

/** Murni: saring tiket yang breach dari daftar. */
export function checkSlaBreach(tickets: TicketLike[], now: Date = new Date()): TicketLike[] {
  if (!Array.isArray(tickets)) return [];
  return tickets.filter((t) => isSlaBreached(t, now));
}

export function validateTicketTransition(from: string, to: string): void {
  if (from === to) return;
  if (!(TRANSITIONS[from] ?? []).includes(to)) throw new Error(TICKET_BAD_TRANSITION);
}

/**
 * Link eskalasi WA (v1: link wa.me saja).
 * Wave integrasi: `notifySlaBreach` di bawah mengirim otomatis via notify
 * Fase 3 saat breach (best-effort); link ini tetap untuk fallback manual.
 */
export function ticketEscalationLink(
  ticket: { id: string | number; severity?: string; project_id?: string },
  phone?: string | null,
): string {
  const text = encodeURIComponent(
    `[ESKALASI ${ticket.severity ?? "TIKET"}] Tiket ${ticket.id} ` +
      `project ${ticket.project_id ?? "-"} lewat SLA. Mohon tindak lanjut.`,
  );
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  return `${base}?text=${text}`;
}

/** F12 TicketService. Model Ticket SUDAH ADA di schema (tanpa kolom judul). */
export class TicketService {
  constructor(private readonly db: any = prisma as any) {}

  async createTicket(input: {
    projectId: string;
    severity?: string;
    slaDue?: Date | string | null;
    now?: Date;
  }) {
    if (!input.projectId) throw new Error(TICKET_MISSING_PROJECT);
    const severity = input.severity ?? "NORMAL";
    const now = input.now ?? new Date();
    const due = input.slaDue ? new Date(input.slaDue) : slaDueFor(severity, now);
    return this.db.ticket.create({
      data: { project_id: input.projectId, severity, slaDue: due, status: "OPEN" },
    });
  }

  async changeStatus(id: string, to: string) {
    const existing = await this.require(id);
    validateTicketTransition(String(existing.status), to);
    if (existing.status === to) return existing;
    return this.db.ticket.update({ where: { id }, data: { status: to } });
  }

  async listOpen(projectId?: string) {
    const where: Record<string, unknown> = {
      status: { in: ["OPEN", "IN_PROGRESS"] },
    };
    if (projectId) where.project_id = projectId;
    return this.db.ticket.findMany({ where }).catch(() => []);
  }

  async listBreached(projectId?: string, now: Date = new Date()) {
    const rows = await this.listOpen(projectId);
    return checkSlaBreach(rows, now);
  }

  /**
   * Wave integrasi: kirim `ticket.sla_breach` untuk tiap tiket breach.
   * Best-effort per tiket (try/catch di dalam); idempotency key stabil
   * `ticket.sla_breach:<id>` sehingga retry/eskalasi ulang = replay.
   * Kembalikan daftar yang benar-benar terkirim (bukan replay/gagal).
   */
  async notifySlaBreach(
    tickets: TicketLike[],
    notifyTo: string | null | undefined,
    now: Date = new Date(),
  ): Promise<{ sent: number; ids: string[] }> {
    if (!notifyTo) return { sent: 0, ids: [] };
    const breached = checkSlaBreach(tickets, now);
    const ids: string[] = [];
    for (const t of breached) {
      try {
        const r = await sendNotify(notifyTo, "ticket.sla_breach", {
          entityId: String(t.id),
          deadline: t.slaDue ?? null,
          projectTitle: null,
          invoiceTitle: `Tiket ${String(t.id)}`,
          amount: null,
          currency: "IDR",
        });
        if (r.ok && !r.replayed) ids.push(String(t.id));
      } catch {
        // Best-effort: lanjut ke tiket berikut.
      }
    }
    return { sent: ids.length, ids };
  }

  private async require(id: string) {
    const row = await this.db.ticket.findUnique({ where: { id } });
    if (!row) throw new Error(TICKET_NOT_FOUND);
    return row as { id: string; status: string };
  }
}

export const ticketService = new TicketService();
