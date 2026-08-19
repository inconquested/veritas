import { getProject } from "@/actions/projects";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

type Milestone = {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | Date | null;
  completed_at?: string | Date | null;
  done?: boolean;
};

type Project = { milestones?: Milestone[] };

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isDone(milestone: Milestone) {
  return Boolean(milestone.done || milestone.completed_at);
}

function date(value: string | Date | null | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? fallback
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function MilestonesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("freelancer");
  const result = await getProject(id);

  if (!result.success) notFound();

  const project = result.project as Project;
  const milestones = toArray<Milestone>(project.milestones);
  const done = milestones.filter(isDone).length;
  const percent = milestones.length
    ? Math.round((done / milestones.length) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {t("milestones.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("milestones.progress", {
              done,
              total: milestones.length,
            })}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {t("milestones.percent-complete", { percent })}
        </Badge>
      </div>

      {milestones.length === 0 ? (
        <Card className="border border-dashed border-border/70 bg-muted/20 shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t("milestones.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="relative pl-6">
          <div className="absolute bottom-0 left-2 top-0 w-px bg-border" />
          <div className="space-y-6">
            {milestones.map((milestone) => {
              const completed = isDone(milestone);
              return (
                <div key={milestone.id} className="relative">
                  <div
                    className={`absolute -left-4 top-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background ${completed ? "bg-primary" : "border-2 border-border bg-background"}`}
                  >
                    {completed ? (
                      <CheckCircle2
                        className="h-3.5 w-3.5 text-primary-foreground"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <Card
                    className={`ml-2 border shadow-sm ${completed ? "border-border/40 bg-muted/20" : "border-border/60"}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-semibold ${completed ? "line-through text-muted-foreground" : ""}`}
                          >
                            {milestone.title}
                          </p>
                          {milestone.description ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {milestone.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {date(milestone.due_date, t("milestones.tbd"))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
