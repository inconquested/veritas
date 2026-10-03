/**
 * F11 — Growth: entri sitemap dinamis (profil + portofolio) sebagai data,
 * bukan route — agar `app/sitemap.ts` tetap DB-free saat build.
 * Murni (tanpa DB, tanpa tipe `next`) agar gampang diuji.
 */

export type SitemapExtraEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: "daily" | "weekly" | "monthly";
  priority?: number;
};

/** `/u/[username]` untuk tiap username freelancer. */
export function profileSitemapEntries(
  baseUrl: string,
  usernames: string[],
): SitemapExtraEntry[] {
  const base = baseUrl.replace(/\/+$/, "");
  return usernames.map((u) => ({
    url: `${base}/u/${encodeURIComponent(u)}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
}

/** `/u/[freelancer]/[projectSlug]` untuk tiap portofolio publik. */
export function portfolioSitemapEntries(
  baseUrl: string,
  items: { freelancer: string; projectSlug: string; updatedAt?: Date }[],
): SitemapExtraEntry[] {
  const base = baseUrl.replace(/\/+$/, "");
  return items.map((it) => ({
    url: `${base}/u/${encodeURIComponent(it.freelancer)}/${encodeURIComponent(it.projectSlug)}`,
    lastModified: it.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}
