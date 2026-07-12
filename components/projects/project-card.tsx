import { Badge } from "@/components/ui/badge";
import type { Project, Milestone, Invoice } from "@/generated/prisma/client";
import {
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  FileText,
} from "lucide-react";
import Link from "next/link";
import {
  Expandable,
  ExpandableCard,
  ExpandableContent,
  ExpandableTrigger,
} from "../ui/expandable";

export type ProjectWithRelations = Project & {
  milestones: Milestone[];
  invoices: Invoice[];
};

const statusColors: Record<string, string> = {
  ONBOARDING: "bg-sky-500/10 text-sky-600 border-sky-200",
  RESEARCH: "bg-violet-500/10 text-violet-600 border-violet-200",
  MODELLING: "bg-amber-500/10 text-amber-600 border-amber-200",
  DEPLOYMENT: "bg-orange-500/10 text-orange-600 border-orange-200",
  MAINTENANCE: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  COMPLETED: "bg-green-500/10 text-green-600 border-green-200",
  CANCELLED: "bg-red-500/10 text-red-600 border-red-200",
};

const formatDate = (value: Date | string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

interface ProjectCardProps {
  project: ProjectWithRelations;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const dueDate =
    project.milestones.length > 0
      ? new Date(
          Math.max(
            ...project.milestones.map((milestone) =>
              new Date(milestone.due_date).getTime(),
            ),
          ),
        )
      : project.createdAt;

  const nextMilestone =
    project.milestones.length > 0
      ? [...project.milestones].sort(
          (first, second) =>
            new Date(first.due_date).getTime() -
            new Date(second.due_date).getTime(),
        )[0]
      : null;

  const statusLabel = project.status.replace(/_/g, " ");

  return (
    <Expandable
      transitionDuration={0.28}
      easeType="easeOut"
      expandDirection="vertical"
      expandBehavior="replace"
    >
      <ExpandableCard className="group h-full w-full cursor-pointer border border-border/70 bg-background/95 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
        <div className="flex h-full flex-col">
          <ExpandableTrigger className="flex-1">
            <div className="flex h-full flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground/80">
                    Project
                  </p>
                  <h2 className="text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                    {project.title}
                  </h2>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs ${statusColors[project.status] || ""}`}
                >
                  {statusLabel}
                </Badge>
              </div>

              <p className="line-clamp-2 text-sm text-muted-foreground">
                {project.description?.trim() || "A fresh project ready for the next milestone."}
              </p>

              <div className="mt-auto grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>Due {formatDate(dueDate)}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{project.milestones.length} milestones</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <CircleDollarSign className="h-4 w-4" />
                  <span>{project.invoices.length} invoices</span>
                </div>
                {nextMilestone ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    <span>Next {formatDate(nextMilestone.due_date)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </ExpandableTrigger>

          <ExpandableContent
            preset="slide-up"
            className="px-5 pb-5 sm:px-6 sm:pb-6"
          >
            <div className="border-t border-border/70 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Project snapshot
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project.description?.trim()
                      ? project.description
                      : "No additional details were provided for this project yet."}
                  </p>
                </div>
                <Link
                  href={`/freelancer/projects/${project.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  View project
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </ExpandableContent>
        </div>
      </ExpandableCard>
    </Expandable>
  );
}
