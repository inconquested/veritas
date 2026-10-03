import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { profileOgImageUrl } from "@/lib/og-image";

/**
 * F11 — Growth: profil talenta publik `/u/[username]`.
 *
 * CATATAN ROUTING: segmen dinamis folder ini bernama `[freelancer]`
 * (milik F6: `/u/[freelancer]/[projectSlug]` — JANGAN disentuh). Di Next.js
 * App Router dua nama segmen dinamis sejajar = konflik, jadi halaman profil
 * tinggal di `app/u/[freelancer]/page.tsx` ini; param `freelancer` di sini
 * dibaca sebagai **username** (User.id atau instanceName).
 *
 * Sumber data (schema frozen — tanpa kolom baru):
 * - identitas: User (nama, avatar, sejak kapan)
 * - bio/skill: BELUM ada kolom di schema → fallback jujur + TODO di bawah
 * - rate card + paket: ServicePackage aktif (milik F11)
 * - review: Review verified (read-only, milik F6)
 * - availability: hitung project aktif (bukan COMPLETED/CANCELLED)
 */

// TODO(F11-wave-integrasi): bio, skill[], rate/jam, nomor WA, status
// availability manual butuh kolom baru di User/FreelancerProfile
// (schema milik wave lain — jangan tambah di sini). Sementara: bio =
// fallback, skill = judul paket jasa, WA = share-link wa.me.
type Params = { freelancer: string };

function displayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  instanceName?: string | null;
  email: string;
}): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.instanceName ||
    user.email
  );
}

function date(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function idr(value: bigint | number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function availabilityBadge(activeCount: number): { label: string; className: string } {
  if (activeCount <= 0)
    return { label: "Tersedia — siap mulai project baru", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
  if (activeCount <= 2)
    return { label: "Slot terbatas — tanya dulu sebelum kirim brief", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
  return { label: "Penuh — bisa antre atau retainer", className: "bg-red-500/10 text-red-600 border-red-500/30" };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} dari 5`} className="text-amber-500">
      {"★".repeat(rating)}
      <span className="text-muted-foreground">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

async function getProfile(username: string) {
  const key = decodeURIComponent(username);
  let user = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: key },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        instanceName: true,
        imageUrl: true,
        createdAt: true,
      },
    });
  } catch {
    user = null; // key bukan UUID → jatuh ke lookup instanceName
  }
  if (!user) {
    user = await prisma.user.findFirst({
      where: { instanceName: key },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        instanceName: true,
        imageUrl: true,
        createdAt: true,
      },
    });
  }
  if (!user) return null;

  const [packages, projects] = await Promise.all([
    prisma.servicePackage.findMany({
      where: { freelancerId: user.id, active: true },
      orderBy: { price: "asc" },
    }),
    prisma.project.findMany({
      where: { freelancerId: user.id },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        review: { select: { rating: true, text: true, verifiedAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return { user, packages, projects };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { freelancer } = await params;
  const data = await getProfile(freelancer).catch(() => null);
  if (!data) return { title: "Talenta tidak ditemukan | Veritas" };
  const name = displayName(data.user);
  const title = `${name} — Jasa Freelancer | Veritas`;
  const from = data.packages.length > 0 ? `Mulai dari ${idr(data.packages[0].price)}. ` : "";
  const description =
    `${from}Profil ${name} di Veritas: ${data.packages.length} paket jasa, ` +
    `${data.projects.length} project, review terverifikasi pembayaran escrow.`;
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://veritas.id").replace(/\/+$/, "");
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: `${base}/u/${encodeURIComponent(freelancer)}`,
      images: [{ url: profileOgImageUrl(base, { name }) }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TalentProfilePage({ params }: { params: Promise<Params> }) {
  const { freelancer } = await params;
  const data = await getProfile(freelancer);
  if (!data) notFound();
  const { user, packages, projects } = data;

  const name = displayName(user);
  const activeCount = projects.filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED").length;
  const badge = availabilityBadge(activeCount);
  const reviews = projects.flatMap((p) =>
    p.review?.verifiedAt ? [{ ...p.review, projectTitle: p.title }] : [],
  );
  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://veritas.id").replace(/\/+$/, "");
  const profileUrl = `${base}/u/${encodeURIComponent(freelancer)}`;
  // Nomor WA freelancer belum ada di schema → CTA WA = share-link wa.me
  // (bukan chat langsung). Lihat TODO di atas.
  const waHref = `https://wa.me/?text=${encodeURIComponent(`Lihat profil ${name} di Veritas: ${profileUrl}`)}`;
  const briefHref = `/l/${user.id}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          {user.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.imageUrl} alt={name} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-xl font-bold">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            <p className="text-sm text-muted-foreground">
              Freelancer Veritas · gabung {date(user.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={badge.className}>
            {badge.label}
          </Badge>
          {avgRating != null ? (
            <span className="flex items-center gap-1 text-sm">
              <Stars rating={Math.round(avgRating)} />
              <span className="text-muted-foreground">
                {avgRating.toFixed(1)} ({reviews.length} review terverifikasi)
              </span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Belum ada review terverifikasi</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={briefHref}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Isi Form Brief
          </Link>
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Bagikan via WA
          </a>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Paket jasa {packages.length > 0 ? `· mulai dari ${idr(packages[0].price)}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada paket jasa aktif.</p>
          ) : (
            <ol className="space-y-3">
              {packages.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    {p.description ? (
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    ) : null}
                  </div>
                  <p className="whitespace-nowrap font-semibold">{idr(p.price)}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {reviews.length > 0 ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="text-base">Review terverifikasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviews.slice(0, 5).map((r, i) => (
              <div key={i} className="text-sm">
                <div className="flex items-center gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-muted-foreground">{r.projectTitle}</span>
                </div>
                {r.text ? <p className="mt-1">{r.text}</p> : null}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Terverifikasi: pembayaran lunas via escrow.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project ({projects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada project tercatat.</p>
          ) : (
            <ol className="space-y-2">
              {projects.slice(0, 10).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/u/${user.id}/${p.slug}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <Badge variant="outline" className="text-xs">
                    {p.status}
                  </Badge>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
