import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/actions/projects";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, FolderOpen } from "lucide-react";

type Milestone = {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | Date | null;
  completed_at?: string | Date | null;
  done?: boolean;
};

type Handsout = {
  id: string;
};

type Project = {
  id: string;
  title: string;
  status?: string | null;
  description?: string | null;
  due_date?: string | Date | null;
  milestones?: Milestone[];
  handsouts?: Handsout[];
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

function isDone(milestone: Milestone) {
  return Boolean(milestone.done || milestone.completed_at);
}

function formatDate(
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return "Not scheduled";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString(
    "en-US",
    options ?? { month: "long", day: "numeric", year: "numeric" },
  );
}

const tabs = [
  { label: "Overview", href: (id: string) => `/client/projects/${id}` },
  {
    label: "Timeline",
    href: (id: string) => `/client/projects/${id}/timeline`,
  },
  {
    label: "Handsouts",
    href: (id: string) => `/client/projects/${id}/handsouts`,
  },
];

export default async function ClientProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProject(id);

  if (!result.success) {
    notFound();
  }

  const project = result.project as Project;
  const milestones = toArray<Milestone>(project.milestones);
  const handsouts = toArray<Handsout>(project.handsouts);
  const doneCount = milestones.filter(isDone).length;
  const progress = milestones.length
    ? Math.round((doneCount / milestones.length) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="space-y-2">
        {project.status ? (
          <Badge
            variant="outline"
            className={`text-xs ${statusColors[project.status] ?? "bg-muted text-muted-foreground border-border"}`}
          >
            {project.status}
          </Badge>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {project.description ??
            "This workspace tracks delivery progress, assets and billing checkpoints directly from the backend."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Due date
            </p>
            <p className="mt-1 text-sm font-semibold">
              {formatDate(project.due_date ?? milestones.at(-1)?.due_date)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Progress
              </p>
              <p className="text-xs font-semibold text-foreground">
                {doneCount}/{milestones.length || 0} milestones
              </p>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Handsouts
              </p>
            </div>
            <p className="mt-1 text-sm font-semibold">
              {handsouts.length} available
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value="overview" className="w-full">
        <TabsList className="w-full justify-start">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.label}
              value={tab.label.toLowerCase()}
              asChild
            >
              <Link href={tab.href(id)}>{tab.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {milestones.length === 0 ? (
          <Card className="border border-dashed border-border/70 bg-muted/20 shadow-none">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No milestones are attached yet. As soon as the backend sends a
              schedule, it will appear here.
            </CardContent>
          </Card>
        ) : (
          milestones.map((milestone) => {
            const done = isDone(milestone);
            return (
              <div key={milestone.id} className="flex items-center gap-3 py-2">
                <div
                  className={`h-3 w-3 shrink-0 rounded-full ${done ? "bg-primary" : "bg-border"}`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${done ? "line-through text-muted-foreground" : "font-medium"}`}
                  >
                    {milestone.title}
                  </p>
                  {milestone.description ? (
                    <p className="text-xs text-muted-foreground">
                      {milestone.description}
                    </p>
                  ) : null}
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(milestone.due_date, {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
