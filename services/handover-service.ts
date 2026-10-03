import prisma from "@/lib/prisma";

export const HANDOVER_EMPTY = "errors.handover.empty";
export const HANDOVER_NOT_FOUND = "errors.handover.not_found";
export const HANDOVER_MISSING_PROJECT = "errors.handover.missing_project";

export type HandoverNoteLike = {
  id: string;
  project_id: string;
  title: string;
  body: string;
  role: string;
};

/** role "ALL" boleh dibaca semua peran; selain itu harus sama persis. */
export function canViewNote(note: Pick<HandoverNoteLike, "role">, role: string): boolean {
  if (!note) return false;
  if (note.role === "ALL") return true;
  return note.role === role;
}

async function logActivity(
  db: any,
  data: { project_id: string; actorId?: string | null; action: string; metadata?: unknown },
) {
  // ActivityEvent milik F9 — tulis langsung via Prisma, tanpa edit file F9.
  try {
    await db.activityEvent?.create?.({ data });
  } catch {
    // Tabel belum migrate = skip, handover tetap jalan.
  }
}

/** F12 HandoverService: knowledge base serah terima per project. */
export class HandoverService {
  constructor(private readonly db: any = prisma as any) {}

  async createNote(input: {
    projectId: string;
    title: string;
    body: string;
    role?: string;
    actorId?: string | null;
  }) {
    if (!input.projectId) throw new Error(HANDOVER_MISSING_PROJECT);
    const title = input.title?.trim() ?? "";
    const body = input.body?.trim() ?? "";
    if (!title || !body) throw new Error(HANDOVER_EMPTY);
    const row = await this.db.handoverNote.create({
      data: {
        project_id: input.projectId,
        title,
        body,
        role: input.role ?? "ALL",
      },
    });
    await logActivity(this.db, {
      project_id: input.projectId,
      actorId: input.actorId ?? null,
      action: "handover.created",
      metadata: { noteId: String(row.id), title },
    });
    return row;
  }

  async updateNote(
    id: string,
    patch: { title?: string; body?: string; role?: string },
    opts: { actorId?: string | null } = {},
  ) {
    const existing = await this.require(id);
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) {
      const title = patch.title.trim();
      if (!title) throw new Error(HANDOVER_EMPTY);
      data.title = title;
    }
    if (patch.body !== undefined) {
      const body = patch.body.trim();
      if (!body) throw new Error(HANDOVER_EMPTY);
      data.body = body;
    }
    if (patch.role !== undefined) data.role = patch.role;
    const row = await this.db.handoverNote.update({ where: { id }, data });
    await logActivity(this.db, {
      project_id: String(existing.project_id),
      actorId: opts.actorId ?? null,
      action: "handover.updated",
      metadata: { noteId: id, patch: Object.keys(data) },
    });
    return row;
  }

  async listByProject(projectId: string, role?: string) {
    const rows = (await this.db.handoverNote
      .findMany({ where: { project_id: projectId } })
      .catch(() => [])) as HandoverNoteLike[];
    if (!role) return rows;
    return rows.filter((n) => canViewNote(n, role));
  }

  /**
   * Revoke akses 1-klik: hapus note + catat ActivityEvent (audit offboarding).
   */
  async revokeAccess(id: string, opts: { actorId?: string | null } = {}) {
    const existing = await this.require(id);
    await this.db.handoverNote.delete({ where: { id } });
    await logActivity(this.db, {
      project_id: String(existing.project_id),
      actorId: opts.actorId ?? null,
      action: "handover.revoked",
      metadata: { noteId: id, title: (existing as HandoverNoteLike).title },
    });
    return { id };
  }

  private async require(id: string) {
    const row = await this.db.handoverNote.findUnique({ where: { id } });
    if (!row) throw new Error(HANDOVER_NOT_FOUND);
    return row;
  }
}

export const handoverService = new HandoverService();
