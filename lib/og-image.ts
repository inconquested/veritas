/**
 * F11 — Growth: helper URL OG image untuk share WA (preview cantik).
 * Konvensi: `/api/og?title=..&subtitle=..` (PNG dinamis).
 */

// TODO(F11-wave-integrasi): buat route `app/api/og/route.tsx` (ImageResponse,
// font latin + badge Veritas) agar URL ini jadi PNG beneran. Sampai ada,
// halaman profil fallback ke thumb_url project / tanpa image (tidak crash).
export function ogImageUrl(
  baseUrl: string,
  opts: { title: string; subtitle?: string },
): string {
  const base = baseUrl.replace(/\/+$/, "");
  const q = new URLSearchParams({ title: opts.title.slice(0, 120) });
  if (opts.subtitle?.trim()) q.set("subtitle", opts.subtitle.trim().slice(0, 120));
  return `${base}/api/og?${q.toString()}`;
}

/** OG image untuk profil talenta `/u/[username]`. */
export function profileOgImageUrl(
  baseUrl: string,
  opts: { name: string; headline?: string },
): string {
  return ogImageUrl(baseUrl, { title: opts.name, subtitle: opts.headline });
}
