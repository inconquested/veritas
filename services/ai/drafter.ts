/**
 * Invoice/contract drafter F8 — dari plain object (BUKAN Prisma model,
 * karena model berubah-ubah) → draf notes + termin + klausul ID standar.
 * Murni, tanpa I/O.
 */

export interface DraftProjectInput {
  title: string;
  clientName?: string;
  freelancerName?: string;
  /** Total nilai kontrak dalam rupiah. */
  totalAmount?: number | null;
  currency?: string;
  /** Uang muka persen (default 50 ala praktik direct ID). */
  dpPercent?: number | null;
  /** Jumlah termin pelunasan (default 1). */
  termCount?: number | null;
  /** Jumlah revisi yang disepakati. */
  revisions?: number | null;
  /** Deadline serah terima (teks bebas, mis. "30 Juni 2026"). */
  deadline?: string | null;
}

export interface ProjectDraft {
  notes: string;
  terms: string[];
  clauses: string[];
}

export function formatIdr(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

function saneTotal(input: DraftProjectInput): number | null {
  const t = input.totalAmount;
  return typeof t === "number" && Number.isFinite(t) && t > 0 ? t : null;
}

function saneDp(input: DraftProjectInput): number {
  const dp = input.dpPercent;
  if (typeof dp === "number" && Number.isFinite(dp) && dp > 0 && dp < 100) {
    return dp;
  }
  return 50;
}

function saneTermCount(input: DraftProjectInput): number {
  const c = input.termCount;
  if (typeof c === "number" && Number.isInteger(c) && c >= 1 && c <= 12) {
    return c;
  }
  return 1;
}

/** Draf catatan invoice (syarat bayar + info transfer). */
export function draftInvoiceNotes(input: DraftProjectInput): string {
  const total = saneTotal(input);
  const who = input.clientName ? ` untuk ${input.clientName}` : "";
  const lines = [
    `Pembayaran ${input.title}${who}.`,
    `DP ${saneDp(input)}% wajib lunas sebelum pekerjaan dimulai; pelunasan maksimal H+3 setelah serah terima disetujui.`,
    total
      ? `Total kontrak ${formatIdr(total)}${input.currency && input.currency !== "IDR" ? ` (${input.currency})` : ""}; keterlambatan dikenakan pemberitahuan H-3, H+0, H+1.`
      : `Nominal sesuai invoice terlampir; keterlambatan dikenakan pemberitahuan H-3, H+0, H+1.`,
    "Simpan bukti transfer; dana DP ditahan aman (escrow) sampai milestone disetujui.",
  ];
  return lines.join(" ");
}

/** Draf skema termin: DP + N pelunasan yang menjumlah = total. */
export function draftTerms(input: DraftProjectInput): string[] {
  const total = saneTotal(input);
  const dpPct = saneDp(input);
  const n = saneTermCount(input);
  if (!total) {
    const rest = [`Pelunasan (${100 - dpPct}%) — setelah serah terima disetujui`];
    for (let i = 2; i <= n; i++) {
      rest.push(`Termin ${i} — sesuai progres yang disepakati`);
    }
    return [`DP (${dpPct}%) — sebelum pekerjaan dimulai`, ...rest];
  }
  const dpAmount = Math.round((total * dpPct) / 100);
  const remainder = total - dpAmount;
  const perTerm = Math.floor(remainder / n);
  const terms = [
    `DP (${dpPct}%) — ${formatIdr(dpAmount)}, sebelum pekerjaan dimulai`,
  ];
  let allocated = 0;
  for (let i = 1; i <= n; i++) {
    const amount = i === n ? remainder - allocated : perTerm;
    allocated += amount;
    const label =
      n === 1 ? "Pelunasan" : `Termin ${i + 1} dari ${n + 1}`;
    terms.push(`${label} — ${formatIdr(amount)}, setelah milestone disetujui`);
  }
  return terms;
}

/** Klausul kontrak standar Indonesia (v1, teks — e-sign di F5). */
export function draftContractClauses(input: DraftProjectInput): string[] {
  const rev =
    typeof input.revisions === "number" && input.revisions >= 0
      ? `Jumlah revisi maksimal ${input.revisions}x; selebihnya dikenakan biaya tambahan yang disepakati tertulis.`
      : "Jumlah revisi sesuai kesepakatan tertulis; revisi di luar scope awal dikenakan biaya tambahan.";
  return [
    `Ruang lingkup: ${input.title}. Pekerjaan di luar scope dituangkan dalam addendum dan ditagih terpisah.`,
    `Pembayaran: DP ${saneDp(input)}% sebelum mulai; dana ditahan aman (escrow) dan dicairkan per milestone yang disetujui${input.deadline ? `; target serah terima ${input.deadline}` : ""}.`,
    `Revisi: ${rev}`,
    "Hak cipta: hak atas hasil kerja beralih ke klien setelah pelunasan 100%; freelancer boleh memakai untuk portofolio kecuali disepakati lain secara tertulis.",
    "Keterlambatan & pembatalan: keterlambatan info maksimal H+3; pembatalan sepihak setelah DP hangus 50% DP sebagai kompensasi kerja yang berjalan, sisa dikembalikan.",
    "Pajak: PPh 23 (2% untuk jasa, bila klien pemotong) dan PPN ditanggung sesuai ketentuan perpajakan yang berlaku.",
    "Penyelesaian sengketa: musyawarah dahulu via mediasi di aplikasi (maksimal 7×24 jam); bila gagal, domisili hukum mengikuti domisili freelancer sesuai KUHPerdata.",
  ];
}

/** Satu paket draf lengkap. */
export function draftAll(input: DraftProjectInput): ProjectDraft {
  return {
    notes: draftInvoiceNotes(input),
    terms: draftTerms(input),
    clauses: draftContractClauses(input),
  };
}
