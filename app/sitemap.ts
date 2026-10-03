import type { MetadataRoute } from "next";

/**
 * F11 — Growth: sitemap statis saja (DB-free agar `next build` tidak butuh DB).
 * URL dinamis profil/portofolio dibuat via `lib/sitemap-extra.ts`.
 */

// TODO(F11-wave-integrasi): gabung profileSitemapEntries() +
// portfolioSitemapEntries() dari lib/sitemap-extra setelah query
// User/Project ringan tersedia saat build (atau via sitemap dinamis API).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://veritas.id").replace(/\/+$/, "");
  return [
    {
      url: `${base}/`,
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
