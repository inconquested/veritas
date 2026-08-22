import { listProjects } from "@/actions/projects";
import {
  ProjectCard,
  type ProjectWithRelations,
} from "@/components/projects/project-card";
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
import { FolderKanban, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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
  const projects = result.success
    ? toArray<ProjectWithRelations>(result.projects)
    : [];
  const hasPreviousPage = page > 1;
  const hasNextPage = projects.length === limit;

  return (
    <div className="flex min-h-full flex-col gap-6 p-6 lg:p-8">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              href={`/client/projects/${project.id}`}
            />
          ))}
        </div>
      )}

      <div className="mt-auto flex h-12 shrink-0 items-center justify-end">
        <Pagination>
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
    </div>
  );
}
