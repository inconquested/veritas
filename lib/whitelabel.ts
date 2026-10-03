/**
 * F13 white-label: resolve brand dari Host header + WHITELABEL_JSON env.
 *
 * Format WHITELABEL_JSON: object datar host->brand + opsional "default":
 * { "default": {...}, "portal.studio.com": {"name":"Studio","primaryColor":"#…"} }
 * Host dinormalisasi (lowercase, tanpa port). Cocok exact dulu, lalu strip
 * subdomain "www.". Tanpa config/cocok => DEFAULT_BRAND.
 *
 * TODO(infra, custom domain): CNAME portal.studio.com -> app + verifikasi DNS
 * + sertifikat wildcard + mapping domain->workspace di DB. v1 hanya brand
 * by-host; lihat docs/PLATFORM.md.
 */
import { isEnabled } from "@/lib/flags";

export type Brand = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  fromEmail: string | null;
  hideVeritasBadge: boolean;
};

export const DEFAULT_BRAND: Brand = {
  name: "Veritas",
  logoUrl: "/icon.svg",
  primaryColor: "#0f766e",
  accentColor: "#f59e0b",
  fromEmail: null,
  hideVeritasBadge: false,
};

function isHexColor(s: unknown): s is string {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
}

export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.trim().toLowerCase().split(",")[0].trim().split(":")[0].replace(/\.$/, "");
}

/** Normalisasi satu brand parsial -> Brand penuh (fallback default). */
export function toBrand(partial: Partial<Brand> | null | undefined): Brand {
  if (!partial) return { ...DEFAULT_BRAND };
  return {
    name: typeof partial.name === "string" && partial.name.trim() ? partial.name.trim().slice(0, 60) : DEFAULT_BRAND.name,
    logoUrl: typeof partial.logoUrl === "string" && partial.logoUrl ? partial.logoUrl.slice(0, 500) : DEFAULT_BRAND.logoUrl,
    primaryColor: isHexColor(partial.primaryColor) ? partial.primaryColor : DEFAULT_BRAND.primaryColor,
    accentColor: isHexColor(partial.accentColor) ? partial.accentColor : DEFAULT_BRAND.accentColor,
    fromEmail: typeof partial.fromEmail === "string" && partial.fromEmail.includes("@") ? partial.fromEmail : null,
    hideVeritasBadge: partial.hideVeritasBadge === true,
  };
}

/** Parse WHITELABEL_JSON -> { default, domains }. Gagal parse => default saja. */
export function parseWhiteLabelConfig(raw: string | undefined | null): { def: Brand; domains: Record<string, Brand> } {
  const def = { ...DEFAULT_BRAND };
  const domains: Record<string, Brand> = {};
  if (!raw || !raw.trim()) return { def, domains };
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    if (typeof json !== "object" || json === null || Array.isArray(json)) return { def, domains };
    if (json.default && typeof json.default === "object") {
      Object.assign(def, toBrand(json.default as Partial<Brand>));
    }
    for (const [k, v] of Object.entries(json)) {
      if (k === "default" || k === "domains") continue;
      if (v && typeof v === "object") domains[normalizeHost(k)] = toBrand(v as Partial<Brand>);
    }
    const nested = json.domains;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      for (const [k, v] of Object.entries(nested as Record<string, unknown>)) {
        if (v && typeof v === "object") domains[normalizeHost(k)] = toBrand(v as Partial<Brand>);
      }
    }
  } catch {
    return { def: { ...DEFAULT_BRAND }, domains: {} };
  }
  return { def, domains };
}

/** Resolve brand untuk host tertentu. */
export function resolveBrand(host: string | null | undefined, explicitEnv?: string): Brand {
  const raw = explicitEnv ?? process.env.WHITELABEL_JSON ?? "";
  const { def, domains } = parseWhiteLabelConfig(raw);
  const h = normalizeHost(host);
  if (!h) return def;
  if (domains[h]) return domains[h];
  if (h.startsWith("www.")) {
    const bare = h.slice(4);
    if (domains[bare]) return domains[bare];
  }
  return def;
}

/** Resolve dari Request (header x-forwarded-host > host). */
export function resolveBrandFromRequest(req: Request, explicitEnv?: string): Brand {
  const forwarded = req.headers.get("x-forwarded-host");
  const host = forwarded ?? req.headers.get("host");
  return resolveBrand(host, explicitEnv);
}

/**
 * Apakah badge Veritas boleh disembunyikan untuk brand ini.
 * Contoh pemakaian feature flag (F13): flag "white-label" off => badge tetap tampil.
 */
export function canHideBadge(brand: Brand, explicitEnv?: string): boolean {
  if (!brand.hideVeritasBadge) return false;
  return isEnabled("white-label", explicitEnv);
}
