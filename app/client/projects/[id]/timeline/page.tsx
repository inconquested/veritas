import { notFound } from "next/navigation";
import { getProject } from "@/actions/projects";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

type Milestone = {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | Date | null;
  completed_at?: string | Date | null;
  done?: boolean;
};

type Project = {
  id: string;
  title: string;
  milestones?: Milestone[];
};

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isDone(milestone: Milestone) {
  return Boolean(milestone.done || milestone.completed_at);
}

function formatShortDate(
  value: string | Date | null | undefined,
  emptyLabel: string,
) {
  if (!value) return emptyLabel;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ClientTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("client");
  const { id } = await params;
  const result = await getProject(id);

  if (!result.success) {
    notFound();
  }

  const project = result.project as Project;
  const milestones = toArray<Milestone>(project.milestones);
  const done = milestones.filter(isDone).length;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{t("timeline.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("timeline.subtitle", {
            done,
            total: milestones.length,
            title: project.title,
          })}
        </p>
      </div>

      <Tabs value="timeline" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview" asChild>
            <Link href={`/client/projects/${id}`}>{t("projectTabs.overview")}</Link>
          </TabsTrigger>
          <TabsTrigger value="timeline" asChild>
            <Link href={`/client/projects/${id}/timeline`}>{t("projectTabs.timeline")}</Link>
          </TabsTrigger>
          <TabsTrigger value="handsouts" asChild>
            <Link href={`/client/projects/${id}/handsouts`}>{t("projectTabs.handsouts")}</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative pl-6">
        <div className="absolute bottom-0 left-2 top-0 w-px bg-border" />
        <div className="space-y-6">
          {milestones.map((milestone) => {
            const done = isDone(milestone);
            return (
              <div key={milestone.id} className="relative">
                <div
                  className={`absolute -left-4 top-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background ${
                    done ? "bg-primary" : "border-2 border-border bg-background"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <Card
                  className={`ml-2 border shadow-sm ${done ? "border-border/40 bg-muted/20" : "border-border/60"}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={`text-sm font-semibold ${done ? "line-through text-muted-foreground" : ""}`}
                        >
                          {milestone.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {milestone.description ??
                            t("timeline.milestoneDescFallback")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatShortDate(milestone.due_date, t("timeline.tbd"))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}

          {milestones.length === 0 ? (
            <Card className="ml-2 border border-dashed border-border/70 bg-muted/20 shadow-none">
              <CardContent className="p-6 text-sm text-muted-foreground">
                {t("timeline.empty")}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
