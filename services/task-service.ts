import prisma from "@/lib/prisma";
import { recordMentions } from "./inbox-service";

export type TaskStatus = "TODO" | "DOING" | "REVIEW" | "DONE";

export const TASK_ORDER: Record<TaskStatus, number> = {
  TODO: 0,
  DOING: 1,
  REVIEW: 2,
  DONE: 3,
};

export const TASK_BAD_TRANSITION = "errors.task.bad_transition";
export const TASK_NOT_FOUND = "errors.task.not_found";
export const TASK_EMPTY_TITLE = "errors.task.empty_title";
export const TASK_MISSING_PROJECT = "errors.task.missing_project";

/**
 * F9 task board state machine: maju 1 langkah (TODO→DOING→REVIEW→DONE),
 * kecuali REVIEW→DOING (rework) yang diizinkan. Sama-status = no-op.
 */
export function isTaskTransitionAllowed(
  from: TaskStatus | string,
  to: TaskStatus | string,
): boolean {
  if (from === to) return true;
  if (from === "REVIEW" && to === "DOING") return true;
  const a = TASK_ORDER[from as TaskStatus];
  const b = TASK_ORDER[to as TaskStatus];
  if (a === undefined || b === undefined) return false;
  return b === a + 1;
}

export function validateTaskTransition(
  from: TaskStatus | string,
  to: TaskStatus | string,
): void {
  if (isTaskTransitionAllowed(from, to)) return;
  throw new Error(TASK_BAD_TRANSITION);
}

async function logActivity(
  db: any,
  data: { project_id: string; actorId?: string | null; action: string; metadata?: unknown },
) {
  try {
    await db.activityEvent?.create?.({ data });
  } catch {
    // Tabel belum migrate (prisma migrate deploy pending) = skip, task tetap jalan.
  }
}

export type CreateTaskInput = {
  projectId: string;
  milestoneId?: string | null;
  title: string;
  assignee?: string | null;
  due?: Date | string | null;
  actorId?: string | null;
};

export type ListTaskFilter = {
  status?: TaskStatus | string;
  milestoneId?: string | null;
  assignee?: string | null;
  search?: string;
};

/**
 * F9 TaskService. `db` loose agar compile sebelum `prisma generate`
 * (pola sama seperti CommentService F2). Model Task SUDAH ADA di schema.
 */
export class TaskService {
  constructor(private readonly db: any = prisma as any) {}

  async createTask(input: CreateTaskInput) {
    const title = input.title?.trim() ?? "";
    if (!title) throw new Error(TASK_EMPTY_TITLE);
    if (!input.projectId) throw new Error(TASK_MISSING_PROJECT);
    const row = await this.db.task.create({
      data: {
        project_id: input.projectId,
        milestone_id: input.milestoneId ?? null,
        title,
        status: "TODO",
        assignee: input.assignee ?? null,
        due: input.due ? new Date(input.due) : null,
      },
    });
    await logActivity(this.db, {
      project_id: input.projectId,
      actorId: input.actorId ?? null,
      action: "task.created",
      metadata: { taskId: String(row.id), title },
    });
    // Mention di judul/body task → ActivityEvent (tanpa tabel baru).
    await recordMentions(this.db, {
      projectId: input.projectId,
      actorId: input.actorId ?? null,
      body: title,
      source: { kind: "task", id: String(row.id) },
    });
    return row;
  }

  async updateTask(
    id: string,
    patch: { title?: string; due?: Date | string | null; milestoneId?: string | null },
    opts: { actorId?: string | null } = {},
  ) {
    const existing = await this.require(id);
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) {
      const title = patch.title.trim();
      if (!title) throw new Error(TASK_EMPTY_TITLE);
      data.title = title;
    }
    if (patch.due !== undefined) data.due = patch.due ? new Date(patch.due) : null;
    if (patch.milestoneId !== undefined) data.milestone_id = patch.milestoneId;
    const row = await this.db.task.update({ where: { id }, data });
    await logActivity(this.db, {
      project_id: String(existing.project_id),
      actorId: opts.actorId ?? null,
      action: "task.updated",
      metadata: { taskId: id, patch: Object.keys(data) },
    });
    return row;
  }

  async deleteTask(id: string, opts: { actorId?: string | null } = {}) {
    const existing = await this.require(id);
    await this.db.task.delete({ where: { id } });
    await logActivity(this.db, {
      project_id: String(existing.project_id),
      actorId: opts.actorId ?? null,
      action: "task.deleted",
      metadata: { taskId: id, title: existing.title },
    });
    return { id };
  }

  /** Pindah status sesuai state machine; mundur ilegal = throw. */
  async moveStatus(id: string, to: TaskStatus, opts: { actorId?: string | null } = {}) {
    const existing = await this.require(id);
    validateTaskTransition(String(existing.status), to);
    if (existing.status === to) return existing;
    const row = await this.db.task.update({ where: { id }, data: { status: to } });
    await logActivity(this.db, {
      project_id: String(existing.project_id),
      actorId: opts.actorId ?? null,
      action: "task.moved",
      metadata: { taskId: id, from: existing.status, to },
    });
    return row;
  }

  /** Assign ke user; juga tercatat di feed + mention ter-parse bila pakai @nama. */
  async assign(id: string, assignee: string | null, opts: { actorId?: string | null } = {}) {
    const existing = await this.require(id);
    const row = await this.db.task.update({ where: { id }, data: { assignee } });
    await logActivity(this.db, {
      project_id: String(existing.project_id),
      actorId: opts.actorId ?? null,
      action: "task.assigned",
      metadata: { taskId: id, assignee },
    });
    if (assignee) {
      await recordMentions(this.db, {
        projectId: String(existing.project_id),
        actorId: opts.actorId ?? null,
        body: `@${assignee}`,
        source: { kind: "task.assign", id },
      });
    }
    return row;
  }

  async listByProject(projectId: string, filter: ListTaskFilter = {}) {
    if (!projectId) throw new Error(TASK_MISSING_PROJECT);
    const where: Record<string, unknown> = { project_id: projectId };
    if (filter.status) where.status = filter.status;
    if (filter.milestoneId !== undefined) where.milestone_id = filter.milestoneId;
    if (filter.assignee !== undefined) where.assignee = filter.assignee;
    const rows: any[] = await this.db.task
      .findMany({ where, orderBy: { due: "asc" } })
      .catch(() => []);
    const q = filter.search?.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.title ?? "").toLowerCase().includes(q));
  }

  listByMilestone(milestoneId: string) {
    return this.db.task
      .findMany({ where: { milestone_id: milestoneId }, orderBy: { due: "asc" } })
      .catch(() => []);
  }

  private async require(id: string) {
    const row = await this.db.task.findUnique({ where: { id } });
    if (!row) throw new Error(TASK_NOT_FOUND);
    return row as { id: string; project_id: string; status: string; title?: string };
  }
}

export const taskService = new TaskService();
