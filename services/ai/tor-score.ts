/**
 * TOR completeness checker F8 — skor 0–100 + gate escrow funding.
 * Murni, tanpa I/O. Blokir funding escrow jika skor < 70.
 */

export const TOR_FUNDING_THRESHOLD = 70;

/** Bobot per komponen (total 100). */
export const TOR_WEIGHTS = {
  scope: 25,
  deliverables: 25,
  deadline: 20,
  price: 20,
  revisions: 10,
} as const;

export interface TorInput {
  /** Deskripsi ruang lingkup (butuh >= 20 karakter bermakna). */
  scope?: string | null;
  /** Daftar deliverable/output yang disepakati. */
  deliverables?: string[] | null;
  /** Deadline serah terima (ISO string / Date). */
  deadline?: string | Date | null;
  /** Nilai kontrak dalam rupiah (> 0). */
  price?: number | null;
  /** Jumlah revisi yang disepakati (>= 0; 0 = tanpa revisi, tetap valid). */
  revisions?: number | null;
}

export interface TorScore {
  score: number;
  breakdown: Record<keyof typeof TOR_WEIGHTS, number>;
  missing: string[];
}

function hasScope(scope?: string | null): boolean {
  return !!scope && scope.trim().length >= 20;
}

function hasDeliverables(d?: string[] | null): boolean {
  return !!d && d.some((x) => !!x && x.trim().length > 0);
}

function hasDeadline(deadline?: string | Date | null): boolean {
  if (!deadline) return false;
  const t = deadline instanceof Date ? deadline.getTime() : Date.parse(deadline);
  return Number.isFinite(t);
}

function hasPrice(price?: number | null): boolean {
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

function hasRevisions(revisions?: number | null): boolean {
  return (
    typeof revisions === "number" &&
    Number.isInteger(revisions) &&
    revisions >= 0
  );
}

/** Skor 0–100 + rincian per komponen + daftar yang kurang. */
export function scoreTor(input: TorInput): TorScore {
  const src = input ?? {};
  const breakdown: TorScore["breakdown"] = {
    scope: hasScope(src.scope) ? TOR_WEIGHTS.scope : 0,
    deliverables: hasDeliverables(src.deliverables)
      ? TOR_WEIGHTS.deliverables
      : 0,
    deadline: hasDeadline(src.deadline) ? TOR_WEIGHTS.deadline : 0,
    price: hasPrice(src.price) ? TOR_WEIGHTS.price : 0,
    revisions: hasRevisions(src.revisions) ? TOR_WEIGHTS.revisions : 0,
  };
  const missing: string[] = [];
  if (!breakdown.scope) missing.push("scope");
  if (!breakdown.deliverables) missing.push("deliverables");
  if (!breakdown.deadline) missing.push("deadline");
  if (!breakdown.price) missing.push("price");
  if (!breakdown.revisions) missing.push("revisions");
  const score =
    breakdown.scope +
    breakdown.deliverables +
    breakdown.deadline +
    breakdown.price +
    breakdown.revisions;
  return { score, breakdown, missing };
}

/**
 * Gate escrow funding: blokir jika skor < 70.
 * Terima angka mentah atau hasil `scoreTor` agar fleksibel di call-site.
 */
export function shouldBlockFunding(score: number | TorScore): boolean {
  const n = typeof score === "number" ? score : score.score;
  return n < TOR_FUNDING_THRESHOLD;
}
