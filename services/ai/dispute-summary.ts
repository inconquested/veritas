/**
 * Dispute summarizer F8 — thread komentar + escrow events (plain arrays,
 * BUKAN Prisma model) → ringkasan 1 halaman mediasi: siapa klaim apa + bukti.
 * Murni, tanpa I/O.
 */

export interface SummaryComment {
  authorRole?: string | null;
  authorName?: string | null;
  body: string;
  createdAt?: string | Date | null;
}

export interface SummaryEscrowEvent {
  /** Mis. INITIALIZED, FUNDS_HELD, DISPUTED, RELEASED, REFUNDED. */
  status: string;
  actor?: string | null;
  createdAt?: string | Date | null;
  txId?: string | null;
}

export interface SummaryDispute {
  reason?: string | null;
  requestedAmount?: number | null;
  status?: string | null;
  deadlineAt?: string | Date | null;
}

function fmtDate(v?: string | Date | null): string {
  if (!v) return "-";
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("id-ID");
}

function fmtIdr(n?: number | null): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "-";
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

function roleLabel(role?: string | null): string {
  const r = (role ?? "").toUpperCase();
  if (r === "CLIENT") return "Klien";
  if (r === "FREELANCER") return "Freelancer";
  if (r === "SYSTEM") return "Sistem";
  return role ? String(role) : "Pihak terkait";
}

/** Ringkasan mediasi 1 halaman (markdown) untuk mediator. */
export function summarizeDispute(
  comments: SummaryComment[],
  events: SummaryEscrowEvent[],
  dispute?: SummaryDispute | null,
): string {
  const list = (comments ?? []).filter((c) => c && c.body?.trim());
  const trail = (events ?? []).filter((e) => e && e.status);

  const byRole = new Map<string, SummaryComment[]>();
  for (const c of list) {
    const key = roleLabel(c.authorRole);
    if (!byRole.has(key)) byRole.set(key, []);
    byRole.get(key)!.push(c);
  }

  const claims: string[] = [];
  for (const [role, items] of byRole) {
    const names = new Set(
      items.map((i) => i.authorName).filter((n): n is string => !!n),
    );
    const who = names.size > 0 ? [...names].join(", ") : role;
    const latest = items[items.length - 1];
    claims.push(
      `- ${role} (${who}): ${items.length}x berkomentar; klaim terakhir — "${latest.body.trim().slice(0, 200)}${latest.body.trim().length > 200 ? "…" : ""}"`,
    );
  }

  const evidence = trail
    .map(
      (e) =>
        `- ${e.status}${e.actor ? ` oleh ${e.actor}` : ""} — ${fmtDate(e.createdAt)}${e.txId ? ` (ref: ${e.txId})` : ""}`,
    )
    .join("\n");

  return [
    "# Ringkasan Mediasi Sengketa",
    "",
    "## Status sengketa",
    `- Alasan: ${dispute?.reason?.trim() || "-"}`,
    `- Nominal diminta: ${fmtIdr(dispute?.requestedAmount ?? undefined)}`,
    `- Status: ${dispute?.status ?? "OPEN"}`,
    `- Batas mediasi: ${fmtDate(dispute?.deadlineAt ?? undefined)}`,
    "",
    "## Siapa klaim apa",
    claims.length > 0 ? claims.join("\n") : "- Belum ada komentar tercatat.",
    "",
    "## Bukti (timeline escrow + komentar)",
    evidence || "- Belum ada event escrow tercatat.",
    `- Total komentar sebagai bukti: ${list.length}`,
    "",
    "## Saran langkah mediasi",
    "1. Verifikasi klaim terakhir tiap pihak terhadap bukti di atas.",
    "2. Tawarkan opsi: revisi terjadwal, refund sebagian, atau release sebagian.",
    "3. Catat kesepakatan tertulis sebelum resolve refund/release.",
  ].join("\n");
}
