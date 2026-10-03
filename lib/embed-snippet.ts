/**
 * F11 — Growth: lead form embeddable. Freelancer tanam form brief di
 * web/portofolio pribadi via `<iframe>` atau bagikan sebagai link.
 * Murni (tanpa DB) agar gampang diuji.
 */

export type EmbedSize = { width?: number | string; height?: number | string };

/** URL absolut form brief publik untuk 1 freelancer. */
export function leadEmbedUrl(baseUrl: string, freelancerId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/l/${encodeURIComponent(freelancerId)}`;
}

/**
 * Snippet `<iframe>` siap tempel. Contoh:
 * `<iframe src="https://veritas.id/l/abc123" width="100%" height="640"
 *   style="border:0;border-radius:12px" loading="lazy"
 *   title="Form brief — Veritas"></iframe>`
 */
export function leadEmbedSnippet(
  baseUrl: string,
  freelancerId: string,
  size: EmbedSize = {},
): string {
  const url = leadEmbedUrl(baseUrl, freelancerId);
  const width = size.width ?? "100%";
  const height = size.height ?? 640;
  return (
    `<iframe src="${url}" width="${width}" height="${height}" ` +
    `style="border:0;border-radius:12px" loading="lazy" ` +
    `title="Form brief — Veritas"></iframe>`
  );
}
