/**
 * F13 Public API key guard (tanpa-schema version).
 *
 * TODO(DB): model ApiKey { id, workspaceId, name, keyHash, scope, revokedAt,
 *   createdAt } + HMAC-hash per key + halaman kelola di dashboard. Saat ini
 *   kunci dibaca dari env VERITAS_API_KEY (csv) agar tanpa migrasi — agen
 *   integrasi yang memegang schema.prisma yang akan mem-persist-kan.
 *
 * Skema scope via prefix (terdokumentasi di docs/PLATFORM.md):
 * - key memuat "write" (case-insensitive, mis. vr_live_write_xxx) => "write"
 * - selain itu => "read" (mis. vr_live_read_xxx)
 * "write" mencakup "read".
 *
 * Sumber key dari request: `Authorization: Bearer <key>` (utama) atau
 * header `x-api-key: <key>` (fallback Zapier/Make).
 */
import { timingSafeEqual } from "node:crypto";

export type ApiScope = "read" | "write";

export const API_KEY_ERRORS = {
  missing: "errors.api_key.missing",
  invalid: "errors.api_key.invalid",
  forbidden: "errors.api_key.forbidden",
} as const;

function csvList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Daftar key yang diizinkan (env VERITAS_API_KEY csv). Pure untuk test. */
export function getConfiguredKeys(explicitEnv?: string): string[] {
  const raw = explicitEnv ?? process.env.VERITAS_API_KEY ?? "";
  return csvList(raw);
}

/**
 * Scope dari prefix key. Aturan: mengandung "write" (case-insensitive)
 * => write, selain itu read. Sengaja longgar agar skema
 * vr_live_read_* / vr_live_write_* dan varian custom tetap jalan.
 */
export function inferScope(key: string): ApiScope {
  return key.toLowerCase().includes("write") ? "write" : "read";
}

/** true jika scope `have` mencukupi kebutuhan `need`. */
export function hasScope(have: ApiScope, need: ApiScope): boolean {
  if (need === "read") return true;
  return have === "write";
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Key mentah dari header request (Bearer utama, x-api-key fallback). */
export function extractApiKey(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (m) return m[1].trim() || null;
  const fallback = req.headers.get("x-api-key")?.trim();
  return fallback || null;
}

export type ValidateResult =
  | { ok: true; key: string; scope: ApiScope }
  | { ok: false; error: keyof typeof API_KEY_ERRORS; status: 401 | 403 };

/** Validasi key terhadap allowlist. Fails closed bila env kosong. */
export function validateApiKey(
  rawKey: string | null | undefined,
  allowlist?: string[],
): ValidateResult {
  if (!rawKey) return { ok: false, error: "missing", status: 401 };
  const keys = allowlist ?? getConfiguredKeys();
  if (keys.length === 0) return { ok: false, error: "invalid", status: 401 };
  const match = keys.find((k) => safeEqual(k, rawKey));
  if (!match) return { ok: false, error: "invalid", status: 401 };
  return { ok: true, key: match, scope: inferScope(match) };
}

export type GuardResult =
  | { ok: true; key: string; scope: ApiScope; response: null }
  | { ok: false; response: Response };

/**
 * Guard untuk route handler. Kembalikan non-null Response bila request
 * harus ditolak (401 tanpa key/salah, 403 scope kurang).
 */
export function guardApiKey(req: Request, need: ApiScope = "read"): GuardResult {
  const raw = extractApiKey(req);
  const v = validateApiKey(raw);
  if (!v.ok) {
    return {
      ok: false,
      response: Response.json(
        { success: false, errorKey: API_KEY_ERRORS[v.error] },
        { status: v.status },
      ),
    };
  }
  if (!hasScope(v.scope, need)) {
    return {
      ok: false,
      response: Response.json(
        { success: false, errorKey: API_KEY_ERRORS.forbidden, scope: v.scope },
        { status: 403 },
      ),
    };
  }
  return { ok: true, key: v.key, scope: v.scope, response: null };
}
