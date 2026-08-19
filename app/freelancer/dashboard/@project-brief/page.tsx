import { listProjects } from "@/actions/projects";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

type Project = {
  id: string;
  title: string;
  status?: string | null;
  updatedAt?: string | Date | null;
  milestones?: { due_date?: string | Date | null }[];
  client?: {
    firstName?: string | null;
    lastName?: string | null;
    instanceName?: string | null;
    email?: string | null;
  };
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

function name(project: Project, fallback: string) {
  const client = project.client;
  return (
    [client?.firstName, client?.lastName].filter(Boolean).join(" ") ||
    client?.instanceName ||
    client?.email ||
    fallback
  );
}

function date(value: string | Date | null | undefined, notScheduled: string) {
  if (!value) return notScheduled;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? notScheduled
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ProjectBriefSlot() {
  const t = await getTranslations("freelancer");
  const result = await listProjects({
    limit: 1,
    page: 1,
    sort: "desc",
    sortBy: "updated_at",
  });
  const project = result.success
    ? ((result.projects as Project[] | undefined) ?? [])[0]
    : undefined;
  const due = project?.milestones
    ?.map((milestone) => milestone.due_date)
    .filter(Boolean)
    .at(-1);
  const progress = project ? (progressByStatus[project.status ?? ""] ?? 0) : 0;

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          {t("projectBrief.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("projectBrief.subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result.success ? (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
            role="alert"
          >
            {t("projectBrief.loadError")}
          </div>
        ) : !project ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            {t("projectBrief.empty")}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold leading-tight">
                  {project.title}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {name(project, t("projectBrief.clientFallback"))}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`shrink-0 text-xs ${statusColors[project.status ?? ""] ?? statusColors.CANCELLED}`}
              >
                {project.status ?? "ONBOARDING"}
              </Badge>
            </div>

            <div>
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{t("projectBrief.overallProgress")}</span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t("projectBrief.due", { date: date(due ?? project.updatedAt, t("projectBrief.notScheduled")) })}</span>
              </div>
              <span className="text-muted-foreground">
                {t("projectBrief.milestones", { count: project.milestones?.length ?? 0 })}
              </span>
            </div>

            <Link
              href={`/freelancer/projects/${project.id}`}
              className="block w-full rounded-md border border-border/60 py-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("projectBrief.viewProject")} →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
