"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { listProjects } from "@/actions/projects";
import {
  ProjectCard,
  type ProjectWithRelations,
} from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { FileQuestion, Plus, Search } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getErrorStateMessage } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

function buildPageHref(page: number, search?: string) {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/freelancer/projects?${query}` : "/freelancer/projects";
}

export default function ProjectsPage() {
  const t = useTranslations("freelancer");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ProjectWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const search = searchParams.get("search")?.trim() ?? "";
  const pageParam = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = 12;

  const hasPreviousPage = page > 1;
  const hasNextPage = projects.length === limit;

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setLoading(true);
      setError(null);

      const result = await listProjects({
        limit,
        page,
        search: search || undefined,
        sort: "desc",
        sortBy: "updated_at",
      });

      if (cancelled) return;

      if (!result.success) {
        setProjects([]);
        setError(result.errorKey ?? null);
      } else {
        setProjects(((result.projects as ProjectWithRelations[]) ?? []) as ProjectWithRelations[]);
      }
      setLoading(false);
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [limit, page, search]);

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value.trim()) {
      params.set("search", value.trim());
    } else {
      params.delete("search");
    }

    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("projects.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("projects.subtitle")}
          </p>
        </div>
        <Button asChild>
          <Link href="/freelancer/projects/create">
            <Plus className="mr-1.5 h-4 w-4" />
            {t("projects.new-project")}
          </Link>
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="project-search"
            defaultValue={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("projects.search-placeholder")}
            className="pl-9"
          />
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="h-40 border-border/60 shadow-sm">
              <CardContent className="h-full animate-pulse p-5">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="mt-4 h-6 w-3/4 rounded bg-muted" />
                <div className="mt-3 h-4 w-full rounded bg-muted" />
                <div className="mt-2 h-4 w-2/3 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none" role="alert">
          <CardContent className="p-5 text-sm">
            {getErrorStateMessage(error)}
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant={"icon"}>
              <FileQuestion />
            </EmptyMedia>
            <EmptyTitle>{t("projects.empty-title")}</EmptyTitle>
            <EmptyDescription>
              {t("projects.empty-description")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center gap-2">
            <Button asChild>
              <Link href="/freelancer/projects/create">
                <Plus />
                {t("projects.new-project")}
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
      <Pagination className="justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href={buildPageHref(page - 1, search || undefined)}
              aria-disabled={!hasPreviousPage}
              className={
                !hasPreviousPage ? "pointer-events-none opacity-50" : undefined
              }
            />
          </PaginationItem>
          <PaginationItem>
            <span className="px-3 text-sm text-muted-foreground">
              {loading ? t("projects.loading") : t("projects.page", { page })}
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
  );
}
