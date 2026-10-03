/**
 * Budget AI per user — in-memory (TODO persist ke DB saat wave integrasi).
 * Dipakai `services/ai/ai-service.ts` untuk catat estimasi token/biaya
 * per pemanggilan `complete()` dan menegakkan batas harian.
 *
 * Env:
 * - AI_DAILY_LIMIT: batas token per user per hari (default 100_000; 0 = tanpa batas).
 * - AI_COST_PER_1K_IDR: estimasi biaya per 1K token dalam rupiah (default 150).
 */

export const DEFAULT_DAILY_LIMIT = 100_000;
export const DEFAULT_COST_PER_1K_IDR = 150;

interface UsageEntry {
  date: string; // YYYY-MM-DD lokal server
  tokens: number;
  costIdr: number;
  calls: number;
}

const store = new Map<string, UsageEntry>();

export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Batas token harian per user dari env. */
export function dailyLimit(): number {
  const n = Number.parseInt(process.env.AI_DAILY_LIMIT ?? "", 10);
  if (process.env.AI_DAILY_LIMIT === "0") return 0; // tanpa batas
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_LIMIT;
}

/** Estimasi biaya rupiah untuk N token. */
export function estimateCostIdr(tokens: number): number {
  const raw = Number.parseFloat(process.env.AI_COST_PER_1K_IDR ?? "");
  const per1k =
    Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_COST_PER_1K_IDR;
  return Math.ceil((tokens / 1000) * per1k);
}

/** Estimasi kasar: ~4 karakter per token (ID/EN campuran). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Catat pemakaian; entri direset otomatis tiap ganti hari. */
export function recordUsage(
  userId: string,
  tokens: number,
  now = new Date(),
): UsageEntry {
  const key = todayKey(now);
  const prev = store.get(userId);
  const base: UsageEntry =
    prev && prev.date === key
      ? prev
      : { date: key, tokens: 0, costIdr: 0, calls: 0 };
  base.tokens += tokens;
  base.costIdr += estimateCostIdr(tokens);
  base.calls += 1;
  store.set(userId, base);
  return { ...base };
}

/** Baca pemakaian hari ini (0 jika belum ada). */
export function getUsage(userId: string, now = new Date()): UsageEntry {
  const prev = store.get(userId);
  if (prev && prev.date === todayKey(now)) return { ...prev };
  return { date: todayKey(now), tokens: 0, costIdr: 0, calls: 0 };
}

/** True jika user sudah menyentuh/melewati batas harian. */
export function isOverLimit(userId: string, now = new Date()): boolean {
  const limit = dailyLimit();
  if (limit === 0) return false;
  return getUsage(userId, now).tokens >= limit;
}

/** Hanya untuk test: kosongkan store in-memory. */
export function __resetAiBudget(): void {
  store.clear();
}
