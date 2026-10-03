import { getProject } from "@/actions/projects";
import { shareService } from "@/services/share-service";
import ShareClientLink from "@/components/share-client-link";
import ProjectDiscussion from "@/components/project-discussion";
import ProjectTasksSection from "@/components/project-tasks-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CalendarDays,
  FileText,
  FolderOpen,
  Milestone,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

type Project = {
  id: string;
  title: string;
  status?: string | null;
  description?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  client?: {
    firstName?: string | null;
    lastName?: string | null;
    instanceName?: string | null;
    email?: string | null;
  };
  milestones?: { due_date?: string | Date | null }[];
  invoices?: unknown[];
  handsouts?: unknown[];
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

const progressByStatus: Record<string, number> = {
  ONBOARDING: 10,
  RESEARCH: 25,
  MODELLING: 55,
  DEPLOYMENT: 80,
  MAINTENANCE: 90,
  COMPLETED: 100,
  CANCELLED: 0,
};

const tabs = [
  {
    labelKey: "milestones.title",
    href: (id: string) => `/freelancer/projects/${id}/milestones`,
    icon: Milestone,
  },
  {
    labelKey: "invoices.title",
    href: (id: string) => `/freelancer/projects/${id}/invoices`,
    icon: FileText,
  },
  {
    labelKey: "handsouts.title",
    href: (id: string) => `/freelancer/projects/${id}/handsouts`,
    icon: FolderOpen,
  },
] as const;

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function name(project: Project, fallback: string) {
  const client = project.client;
  return (
    [client?.firstName, client?.lastName].filter(Boolean).join(" ") ||
    client?.instanceName ||
    client?.email ||
    fallback
  );
}

function date(
  value: string | Date | null | undefined,
  fallback: string,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? fallback
    : parsed.toLocaleDateString(
        "en-US",
        options ?? { month: "short", day: "numeric", year: "numeric" },
      );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("freelancer");
  const result = await getProject(id);

  if (!result.success) notFound();

  const project = result.project as Project;
  const links = await shareService.listShareLinks(id).catch(() => []);
  const milestones = toArray<{ due_date?: string | Date | null }>(
    project.milestones,
  ).sort(
    (first, second) =>
      new Date(first.due_date ?? 0).getTime() -
      new Date(second.due_date ?? 0).getTime(),
  );
  const invoices = toArray(project.invoices);
  const handsouts = toArray(project.handsouts);
  const due = milestones
    .map((milestone) => milestone.due_date)
    .filter(Boolean)
    .at(-1);
  const progress = progressByStatus[project.status ?? ""] ?? 0;
  const notScheduled = t("projects.detail.not-scheduled");

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs ${statusColors[project.status ?? ""] ?? statusColors.CANCELLED}`}
            >
              {t(`status.${project.status ?? "ONBOARDING"}`)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {name(project, t("projects.client-fallback"))}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {project.description ?? t("projects.detail.description-fallback")}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href={`/freelancer/projects/${id}/update`}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t("projects.detail.edit")}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: t("projects.detail.due-date"),
            value: date(due ?? project.updatedAt, notScheduled),
          },
          {
            label: t("projects.detail.started"),
            value: date(project.createdAt, notScheduled, {
              month: "short",
              year: "numeric",
            }),
          },
          {
            label: t("milestones.title"),
            value: t("projects.detail.count-total", {
              count: milestones.length,
            }),
          },
          {
            label: t("invoices.title"),
            value: t("projects.detail.count-total", { count: invoices.length }),
          },
        ].map((stat) => (
          <Card key={stat.label} className="border border-border/60 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 text-sm font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border/60 shadow-sm">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("projects.detail.overall-progress")}</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <ShareClientLink projectId={id} links={links} />

      <ProjectDiscussion projectId={id} />

      {/* F9 kolaborasi: kanban + kalender + feed (section tambahan, halaman utuh tak diubah). */}
      <ProjectTasksSection projectId={id} />

      <nav
        className="flex gap-1 border-b border-border"
        aria-label={t("projects.detail.sections-aria")}
      >
        {tabs.map((tab) => (
          <Link
            key={tab.labelKey}
            href={tab.href(id)}
            className="flex items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <tab.icon className="h-4 w-4" aria-hidden="true" />
            {t(tab.labelKey)}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4 text-sm">
            {t("projects.detail.milestones-planned", {
              count: milestones.length,
            })}
          </CardContent>
        </Card>
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4 text-sm">
            {t("projects.detail.invoices-attached", { count: invoices.length })}
          </CardContent>
        </Card>
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4 text-sm">
            {t("projects.detail.handsouts-delivered", {
              count: handsouts.length,
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
