/**
 * F11 — Growth: UTM parse + simpan ke `Lead.source`.
 * Lead form publik (`/l/[freelancerId]`) baca `searchParams` utm_*,
 * ringkas jadi 1 string pendek, simpan sebagai `Lead.source`.
 * Murni (tanpa DB) agar gampang diuji.
 */

export type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function pick(sp: SearchParamsLike, key: keyof UtmParams): string | undefined {
  const raw =
    sp instanceof URLSearchParams
      ? sp.get(key)
      : Array.isArray(sp[key])
        ? (sp[key] as string[])[0]
        : (sp[key] as string | undefined);
  const v = raw?.trim();
  return v ? v.slice(0, 64) : undefined;
}

/** Ambil utm_source/medium/campaign dari query (?utm_source=..). */
export function parseUtm(sp: SearchParamsLike): UtmParams {
  const out: UtmParams = {};
  const s = pick(sp, "utm_source");
  const m = pick(sp, "utm_medium");
  const c = pick(sp, "utm_campaign");
  if (s) out.utm_source = s;
  if (m) out.utm_medium = m;
  if (c) out.utm_campaign = c;
  return out;
}

/**
 * Ringkas jadi `Lead.source`, mis. `embed:tiktok/bio/launch-q1`
 * atau fallback (`embed` / `profil`) bila tanpa UTM.
 */
export function leadSourceFromUtm(utm: UtmParams, fallback = "embed"): string {
  const parts = [utm.utm_source, utm.utm_medium, utm.utm_campaign].filter(Boolean);
  if (parts.length === 0) return fallback;
  return `${fallback}:${parts.join("/")}`.slice(0, 120);
}
