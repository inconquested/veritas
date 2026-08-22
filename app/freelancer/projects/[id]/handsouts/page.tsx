import { getProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, FileImage, FileText, PackageOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

type Handsout = {
  id: string;
  title: string;
  description?: string | null;
  content_url?: string | null;
  thumb_url?: string | null;
  createdAt?: string | Date | null;
  created_at?: string | Date | null;
};

type Project = { handsouts?: Handsout[] };

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function date(value: string | Date | null | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? fallback
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function HandsoutsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("freelancer");
  const result = await getProject(id);

  if (!result.success) notFound();

  const project = result.project as Project;
  const handsouts = toArray<Handsout>(project.handsouts).sort(
    (first, second) =>
      new Date(second.createdAt ?? second.created_at ?? 0).getTime() -
      new Date(first.createdAt ?? first.created_at ?? 0).getTime(),
  );

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          {t("handsouts.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("handsouts.subtitle")}
        </p>
      </div>

      {handsouts.length === 0 ? (
        <Card className="border border-dashed border-border/70 bg-muted/20 shadow-none">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <PackageOpen className="h-5 w-5" aria-hidden="true" />
            {t("handsouts.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {handsouts.map((handsout) => {
            const Icon = handsout.thumb_url ? FileImage : FileText;
            return (
              <Card
                key={handsout.id}
                className="group border border-border/60 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-32 items-center justify-center overflow-hidden rounded-t-xl border-b border-border/40 bg-muted/50">
                  {handsout.thumb_url ? (
                    // ponytail: plain <img> — next/image would need Cloudinary domain config
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={handsout.thumb_url}
                      alt={handsout.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <Icon
                      className="h-10 w-10 text-muted-foreground/40"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {handsout.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {handsout.description ??
                          t("handsouts.asset-fallback")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-xs text-muted-foreground">
                      {date(
                        handsout.createdAt ?? handsout.created_at,
                        t("handsouts.recently-added"),
                      )}
                    </span>
                    {handsout.content_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-7 px-2 text-xs"
                      >
                        <a
                          href={handsout.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink
                            className="mr-1 h-3 w-3"
                            aria-hidden="true"
                          />
                          {t("handsouts.open")}
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
