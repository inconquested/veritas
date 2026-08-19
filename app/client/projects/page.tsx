import Link from "next/link";
import { listProjects } from "@/actions/projects";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, FolderKanban, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

type Project = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  milestones?: Array<{
    id?: string;
    title?: string;
    due_date?: string | Date | null;
  }>;
  due_date?: string | Date | null;
};

const statusColors: Record<string, string> = {
  ONBOARDING: "bg-sky-500/10 text-sky-600 border-sky-200",
  RESEARCH: "bg-violet-500/10 text-violet-600 border-violet-200",
  MODELLING: "bg-amber-500/10 text-amber-600 border-amber-200",
  DEPLOYMENT: "bg-orange-500/10 text-orange-600 border-orange-200",
  MAINTENANCE: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  COMPLETED: "bg-green-500/10 text-green-600 border-green-200",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatDate(
  value: string | Date | null | undefined,
  emptyLabel: string,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return emptyLabel;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return date.toLocaleDateString(
    "en-US",
    options ?? { month: "short", day: "numeric" },
  );
}

function buildPageHref(page: number, search?: string) {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/client/projects?${query}` : "/client/projects";
}

export default async function ClientProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("client");
  const params = (await searchParams) ?? {};
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const pageParam = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = 24;

  const result = await listProjects({
    limit,
    page,
    search: search || undefined,
    sort: "desc",
    sortBy: "updated_at",
  });
  const projects = result.success ? toArray<Project>(result.projects) : [];
  const hasPreviousPage = page > 1;
  const hasNextPage = projects.length === limit;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("projects.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("projects.subtitle", { count: projects.length })}
          </p>
        </div>

        <form action="/client/projects" className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="search"
            defaultValue={search}
            placeholder={t("projects.searchPlaceholder")}
            className="pl-9"
          />
        </form>
      </div>

      {!result.success || projects.length === 0 ? (
        <Empty className="border border-dashed border-border/70 bg-muted/20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanban className="h-4 w-4" />
            </EmptyMedia>
            <EmptyTitle>{t("projects.emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("projects.emptyDesc")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {!result.success ? (
              <p className="text-sm text-destructive">
                {t("projects.loadError")}
              </p>
            ) : null}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col space-y-4">
          {projects.map((project) => {
            const milestones = toArray<{
              id?: string;
              title?: string;
              due_date?: string | Date | null;
            }>(project.milestones);
            const progress = milestones.length
              ? Math.round(
                  (milestones.filter(Boolean).length / milestones.length) * 100,
                )
              : 12;
            const primaryDueDate =
              project.due_date ?? milestones.at(-1)?.due_date;

            return (
              <Link key={project.id} href={`/client/projects/${project.id}`}>
                <Card className="group cursor-pointer border border-border/60 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold transition-colors group-hover:text-primary">
                            {project.title}
                          </h2>
                          {project.status ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${statusColors[project.status] ?? "bg-muted text-muted-foreground border-border"}`}
                            >
                              {t(`projectStatus.${project.status}`)}
                            </Badge>
                          ) : null}
                        </div>

                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {project.description ?? t("projects.descFallback")}
                        </p>

                        <div>
                          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                            <span>
                              {t("projects.milestonesPlanned", {
                                count: milestones.length,
                              })}
                            </span>
                            <span className="font-medium text-foreground">
                              {t("projects.mapped", { progress })}
                            </span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {t("projects.due", {
                          date: formatDate(primaryDueDate, t("projects.noDeadline")),
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          <Pagination className="justify-end pt-2">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={buildPageHref(page - 1, search || undefined)}
                  aria-disabled={!hasPreviousPage}
                  className={
                    !hasPreviousPage
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-3 text-sm text-muted-foreground">
                  {t("projects.page", { page })}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href={buildPageHref(page + 1, search || undefined)}
                  aria-disabled={!hasNextPage}
                  className={
                    !hasNextPage ? "pointer-events-none opacity-50" : undefined
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
