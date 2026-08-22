"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type {
  Project,
  Milestone,
  Invoice,
  Handsout,
} from "@/generated/prisma/client";
import {
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  FileText,
  FolderOpen,
  Milestone as MilestoneIcon,
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
  handsouts: Handsout[];
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

// ponytail: Milestone has no done/completed_at columns — a past due_date is
// the only completion signal. Add a status column if real tracking is needed.
const isDone = (milestone: Milestone) =>
  new Date(milestone.due_date).getTime() < Date.now();

interface ProjectCardProps {
  project: ProjectWithRelations;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations("project-list");

  const sortedMilestones = [...project.milestones].sort(
    (first, second) =>
      new Date(first.due_date).getTime() - new Date(second.due_date).getTime(),
  );
  const doneCount = project.milestones.filter(isDone).length;
  const milestoneTotal = project.milestones.length;
  const milestonePercent = milestoneTotal
    ? Math.round((doneCount / milestoneTotal) * 100)
    : 0;
  const nextMilestone =
    sortedMilestones.find((milestone) => !isDone(milestone)) ?? null;
  const dueDate = sortedMilestones.length
    ? sortedMilestones[sortedMilestones.length - 1].due_date
    : project.createdAt;

  const statusLabel = project.status.replace(/_/g, " ");

  const stats = [
    {
      icon: MilestoneIcon,
      label: t("card-milestones", { count: milestoneTotal }),
    },
    {
      icon: CircleDollarSign,
      label: t("card-invoices", { count: project.invoices.length }),
    },
    {
      icon: FolderOpen,
      label: t("card-handsouts", { count: project.handsouts.length }),
    },
    {
      icon: CalendarDays,
      label: t("card-due", { date: formatDate(dueDate) }),
    },
  ];

  return (
    <Expandable
      transitionDuration={0.28}
      easeType="easeOut"
      expandDirection="vertical"
      expandBehavior="push"
      className="h-full"
    >
      <ExpandableCard className="group h-full w-full rounded-2xl border border-border/40 bg-background shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md pb-4">
        <ExpandableTrigger className="text-left focus:outline-none">
          <div className="flex flex-col gap-3 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground/80">
                {t("card-eyebrow")}
              </span>
              <Badge
                variant="outline"
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] sm:text-xs ${statusColors[project.status] || ""}`}
              >
                {statusLabel}
              </Badge>
            </div>

            <h2 className="truncate text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
              {project.title}
            </h2>
            <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
              {project.description?.trim() || t("card-empty-description")}
            </p>
          </div>
        </ExpandableTrigger>

        <ExpandableContent preset="slide-up" className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="flex flex-col gap-4 border-t border-border/40 pt-4">
            {milestoneTotal > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {t("card-progress", {
                      done: doneCount,
                      total: milestoneTotal,
                    })}
                  </span>
                  <span className="font-medium text-foreground">
                    {milestonePercent}%
                  </span>
                </div>
                <Progress value={milestonePercent} className="h-1 bg-muted" />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
              {stats.map((stat) => (
                <span
                  key={stat.label}
                  className="inline-flex items-center gap-2 text-xs text-muted-foreground mb-2"
                >
                  <stat.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{stat.label}</span>
                </span>
              ))}
              {nextMilestone && (
                <span className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
                  <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {t("card-next", {
                      date: formatDate(nextMilestone.due_date),
                    })}
                  </span>
                </span>
              )}
            </div>

            <Link
              href={`/freelancer/projects/${project.id}`}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {t("card-view")}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </ExpandableContent>
      </ExpandableCard>
    </Expandable>
  );
}
