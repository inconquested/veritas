import type { Brand } from "@/lib/whitelabel";
import { canHideBadge } from "@/lib/whitelabel";

/**
 * F13 BrandHeader (white-label). Server-safe (tanpa "use client").
 * Contoh pemakaian feature flag: badge Veritas hanya hilang bila
 * brand mengizinkan DAN flag "white-label" aktif.
 */
export function BrandHeader({ brand, portalUrl }: { brand: Brand; portalUrl?: string }) {
  const hideBadge = canHideBadge(brand);
  return (
    <header
      style={{ borderBottom: `3px solid ${brand.primaryColor}` }}
      className="flex items-center gap-3 px-4 py-3"
    >
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoUrl} alt={brand.name} width={32} height={32} style={{ borderRadius: 8 }} />
      ) : null}
      <span className="text-base font-semibold" style={{ color: brand.primaryColor }}>
        {brand.name}
      </span>
      {portalUrl ? (
        <a href={portalUrl} className="ml-auto text-sm underline">
          Portal klien
        </a>
      ) : null}
      {!hideBadge ? (
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[11px]"
          style={{ background: brand.accentColor, color: "#111" }}
        >
          Powered by Veritas
        </span>
      ) : null}
    </header>
  );
}
