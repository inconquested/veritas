import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";

type Params = { freelancer: string; projectSlug: string };

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

/** Portofolio publik: project milik freelancer tsb (slug + freelancerId cocok). */
async function getPortfolio(freelancer: string, slug: string) {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      freelancer: {
        select: { id: true, email: true, firstName: true, lastName: true, instanceName: true },
      },
      milestones: { orderBy: { due_date: "asc" } },
      handsouts: { orderBy: { createdAt: "desc" } },
      review: true,
    },
  });
  if (!project || project.freelancerId !== freelancer) return null;
  return project;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { freelancer, projectSlug } = await params;
  const project = await getPortfolio(freelancer, projectSlug);
  if (!project) return { title: "Portofolio tidak ditemukan | Veritas" };
  const name = displayName(project.freelancer);
  const title = `${project.title} — ${name} | Veritas`;
  const description =
    project.description?.slice(0, 160) ??
    `Hasil kerja ${name}: ${project.title}. Review terverifikasi dari pembayaran escrow.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(project.thumb_url ? { images: [{ url: project.thumb_url }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} dari 5`} className="text-amber-500">
      {"★".repeat(rating)}
      <span className="text-muted-foreground">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default async function PortfolioPage({ params }: { params: Promise<Params> }) {
  const { freelancer, projectSlug } = await params;
  const project = await getPortfolio(freelancer, projectSlug);
  if (!project) notFound();

  const name = displayName(project.freelancer);
  const review = project.review;
  // TODO(F11): ganti mailto dengan lead form + paket jasa saat profil publik jadi.
  const ctaHref = `mailto:${project.freelancer.email}?subject=${encodeURIComponent(`Minta Penawaran: ${project.title}`)}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{project.status}</Badge>
          <span className="text-sm text-muted-foreground">oleh {name}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
        {project.description ? (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        ) : null}
      </header>

      {review?.verifiedAt ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Stars rating={review.rating} />
              <Badge variant="outline" className="text-xs">Review terverifikasi</Badge>
            </div>
            {review.text ? <p className="mt-2 text-sm">{review.text}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              Pembayaran lunas via escrow · {date(review.verifiedAt)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hasil kerja</CardTitle>
        </CardHeader>
        <CardContent>
          {project.handsouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada hasil dipublikasi.</p>
          ) : (
            <ol className="space-y-3">
              {project.handsouts.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="font-medium">{h.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {date(h.createdAt)}
                    {h.description ? ` · ${h.description}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tahapan</CardTitle>
        </CardHeader>
        <CardContent>
          {project.milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada milestone.</p>
          ) : (
            <ol className="space-y-2">
              {project.milestones.map((m) => (
                <li key={m.id} className="text-sm">
                  <span className="font-medium">{m.title}</span>{" "}
                  <span className="text-xs text-muted-foreground">· {date(m.due_date)}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-semibold">Butuh hasil seperti ini?</p>
            <p className="text-sm opacity-80">Diskusi scope & estimasi dengan {name}.</p>
          </div>
          <Link
            href={ctaHref}
            className="rounded-md bg-background px-4 py-2 text-sm font-semibold text-foreground hover:opacity-90"
          >
            Minta Penawaran
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
