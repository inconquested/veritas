/**
 * F13 observability: log terstruktur + redaksi PII + error-rate in-memory.
 *
 * - Redaksi via lib/redact.ts (reuse, bukan duplikat regex).
 * - Error rate: counter per menit (sliding 10 menit) in-memory; cukup untuk
 *   dashboard mini + alert ambang. Reset tiap deploy/isolate = trade-off
 *   yang diterima v1.
 *
 * TODO(Sentry): kirim ke Sentry bila SENTRY_DSN terisi (lihat docs/PLATFORM.md);
 * v1 hanya console JSON agar tanpa dependensi baru.
 */
import { redactPII } from "@/lib/redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactPII(value).text;
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/password|secret|token|api[_-]?key|authorization/i.test(k)) out[k] = "[disensor]";
      else out[k] = redactValue(v);
    }
    return out;
  }
  return value;
}

export type LogLine = {
  ts: string;
  level: LogLevel;
  msg: string;
  fields?: LogFields;
};

/** Satu baris JSON ke stdout (gampang di-scrape Vercel/LogDrain). */
export function logEvent(level: LogLevel, msg: string, fields: LogFields = {}): LogLine {
  const line: LogLine = {
    ts: new Date().toISOString(),
    level,
    msg: redactPII(msg).text,
    ...(Object.keys(fields).length > 0 ? { fields: redactValue(fields) as LogFields } : {}),
  };
  const out = JSON.stringify(line);
  if (level === "error" || level === "warn") console.error(out);
  else console.log(out);
  if (level === "error") recordError("all");
  return line;
}

// ── error rate in-memory (per 60s bucket, jendela 10 mnt) ──

const BUCKETS = new Map<string, Map<number, number>>();
const WINDOW_BUCKETS = 10;

function minuteBucket(now = Date.now()): number {
  return Math.floor(now / 60_000);
}

export function recordError(key = "all", nowMs?: number): void {
  const b = minuteBucket(nowMs ?? Date.now());
  let series = BUCKETS.get(key);
  if (!series) {
    series = new Map();
    BUCKETS.set(key, series);
  }
  series.set(b, (series.get(b) ?? 0) + 1);
  for (const k of [...series.keys()]) {
    if (k < b - WINDOW_BUCKETS) series.delete(k);
  }
  if (BUCKETS.size > 100) {
    const first = BUCKETS.keys().next().value;
    if (first) BUCKETS.delete(first);
  }
}

/** Jumlah error dalam N menit terakhir (default 5). */
export function errorCount(key = "all", lastMinutes = 5, nowMs?: number): number {
  const b = minuteBucket(nowMs ?? Date.now());
  const series = BUCKETS.get(key);
  if (!series) return 0;
  let total = 0;
  for (let i = 0; i < lastMinutes; i++) total += series.get(b - i) ?? 0;
  return total;
}

/** Ringkasan untuk dashboard mini / health check. */
export function errorSummary(nowMs?: number): { last1m: number; last5m: number; last10m: number } {
  return {
    last1m: errorCount("all", 1, nowMs),
    last5m: errorCount("all", 5, nowMs),
    last10m: errorCount("all", 10, nowMs),
  };
}

/** Test-only. */
export function __resetObsForTests(): void {
  BUCKETS.clear();
}
