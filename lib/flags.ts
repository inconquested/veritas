/**
 * F13 feature flags (tanpa-schema version).
 *
 * Sumber: env VERITAS_FLAGS=csv, mis. "public-api,white-label,semantic-search".
 * Token "nama" / "nama=1|true|on" => on; "nama=0|false|off" => off.
 * Case-insensitive, spasi diabaikan, duplikat = terakhir menang.
 *
 * TODO(DB, opsional): flag per-workspace di DB bila butuh rollout bertahap
 * per studio. v1 env-only sengaja agar tanpa migrasi.
 */

const FALSE_SET = new Set(["0", "false", "off", "no", "disabled"]);
const TRUE_SET = new Set(["1", "true", "on", "yes", "enabled", ""]);

export function parseFlags(raw: string | undefined | null): Map<string, boolean> {
  const out = new Map<string, boolean>();
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const eq = token.indexOf("=");
    if (eq === -1) {
      out.set(token.toLowerCase(), true);
      continue;
    }
    const name = token.slice(0, eq).trim().toLowerCase();
    const val = token.slice(eq + 1).trim().toLowerCase();
    if (!name) continue;
    if (FALSE_SET.has(val)) out.set(name, false);
    else if (TRUE_SET.has(val)) out.set(name, true);
    else out.set(name, true);
  }
  return out;
}

/** Daftar flag yang dikenal F13 (dokumentasi; flag lain tetap diizinkan). */
export const KNOWN_FLAGS = [
  "public-api",
  "white-label",
  "offline-queue",
  "semantic-search",
  "push",
  "sentry",
] as const;

export type KnownFlag = (typeof KNOWN_FLAGS)[number];

/** true bila flag aktif di env VERITAS_FLAGS (atau env eksplisit utk test). */
export function isEnabled(flag: string, explicitEnv?: string): boolean {
  const raw = explicitEnv ?? process.env.VERITAS_FLAGS ?? "";
  return parseFlags(raw).get(flag.trim().toLowerCase()) === true;
}

/** Helper terbalik untuk early-return dingin. */
export function isDisabled(flag: string, explicitEnv?: string): boolean {
  return !isEnabled(flag, explicitEnv);
}
