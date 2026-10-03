import prisma from "@/lib/prisma";
import { taskService } from "@/services/task-service";
import { moveTaskAction } from "@/actions/tasks";
import TaskBoard, { type BoardTask } from "./task-board";
import WeekCalendar, { type WeekItem } from "./week-calendar";
import ActivityFeed, { type ActivityItem } from "./activity-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const db = prisma as any;

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v ?? "");
}

/**
 * F9 section untuk halaman project detail (tambah section, tanpa rombak).
 * Semua fetch read-only + catch → [] agar halaman tetap jalan sebelum
 * `prisma migrate deploy` tabel Task/Attachment/ActivityEvent.
 */
export default async function ProjectTasksSection({ projectId }: { projectId: string }) {
  const [tasksRaw, eventsRaw, milestones, invoices, project] = await Promise.all([
    taskService.listByProject(projectId).catch(() => []),
    db.activityEvent
      .findMany({ where: { project_id: projectId }, orderBy: { createdAt: "desc" }, take: 50 })
      .catch(() => []),
    db.milestone
      .findMany({ where: { project_id: projectId }, select: { id: true, title: true, due_date: true } })
      .catch(() => []),
    db.invoice
      .findMany({ where: { project_id: projectId }, select: { id: true, title: true, due_date: true } })
      .catch(() => []),
    db.project
      .findUnique({ where: { id: projectId }, select: { title: true } })
      .catch(() => null),
  ]);

  const milestoneTitle = new Map((milestones as any[]).map((m) => [String(m.id), String(m.title ?? "")]));
  const tasks: BoardTask[] = (tasksRaw as any[]).map((t) => ({
    id: String(t.id),
    title: String(t.title ?? ""),
    status: String(t.status ?? "TODO"),
    assignee: t.assignee ?? null,
    due: t.due ? iso(t.due) : null,
    milestoneTitle: t.milestone_id ? (milestoneTitle.get(String(t.milestone_id)) ?? null) : null,
  }));

  const projectTitle = project?.title ? String(project.title) : "";
  const items: WeekItem[] = [
    ...(tasksRaw as any[])
      .filter((t) => t.due)
      .map((t) => ({
        id: String(t.id),
        title: String(t.title ?? ""),
        project: projectTitle,
        kind: "task" as const,
        due: iso(t.due),
      })),
    ...(milestones as any[])
      .filter((m) => m.due_date)
      .map((m) => ({
        id: String(m.id),
        title: String(m.title ?? ""),
        project: projectTitle,
        kind: "milestone" as const,
        due: iso(m.due_date),
      })),
    ...(invoices as any[])
      .filter((i) => i.due_date)
      .map((i) => ({
        id: String(i.id),
        title: String(i.title ?? ""),
        project: projectTitle,
        kind: "invoice" as const,
        due: iso(i.due_date),
      })),
  ];

  const events: ActivityItem[] = (eventsRaw as any[]).map((e) => ({
    id: String(e.id),
    actorId: e.actorId ?? null,
    action: String(e.action ?? ""),
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt ?? ""),
    metadata: e.metadata ?? null,
  }));

  async function onMove(id: string, to: "TODO" | "DOING" | "REVIEW" | "DONE") {
    "use server";
    return moveTaskAction(projectId, id, to);
  }

  return (
    <div className="space-y-4">
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Task board</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskBoard tasks={tasks} onMove={onMove} />
        </CardContent>
      </Card>
      <WeekCalendar items={items} projectId={projectId} />
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Aktivitas project</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed events={events} />
        </CardContent>
      </Card>
    </div>
  );
}
