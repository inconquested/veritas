import { isSlaBreached, type TicketLike } from "@/services/ticket-service";

export type SlaReport = {
  month: string;
  total: number;
  resolved: number;
  breached: number;
  openBreached: number;
  /** 0–1; null bila tidak ada tiket. */
  breachRate: number | null;
  perSeverity: Record<string, { total: number; breached: number }>;
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Laporan SLA/bulan, murni (tanpa DB). Tiket tanpa createdAt ikut dihitung
 * (dianggap bulan berjalan) agar layak dipakai dari listOpen().
 */
export function buildSlaReport(
  tickets: (TicketLike & { createdAt?: Date | string | null })[],
  opts: { month?: string; now?: Date } = {},
): SlaReport {
  const now = opts.now ?? new Date();
  const month = opts.month ?? monthKey(now);
  const rows = (Array.isArray(tickets) ? tickets : []).filter((t) => {
    if (!t?.createdAt) return true;
    const d = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);
    return Number.isNaN(d.getTime()) || monthKey(d) === month;
  });

  const perSeverity: SlaReport["perSeverity"] = {};
  let resolved = 0;
  let breached = 0;
  let openBreached = 0;
  for (const t of rows) {
    const sev = String(t.severity ?? "NORMAL");
    perSeverity[sev] ??= { total: 0, breached: 0 };
    perSeverity[sev].total += 1;
    const isTerminal = t.status === "RESOLVED" || t.status === "CLOSED";
    if (isTerminal) resolved += 1;
    if (isSlaBreached(t, now)) {
      breached += 1;
      perSeverity[sev].breached += 1;
      if (!isTerminal) openBreached += 1;
    }
  }
  return {
    month,
    total: rows.length,
    resolved,
    breached,
    openBreached,
    breachRate: rows.length ? breached / rows.length : null,
    perSeverity,
  };
}
