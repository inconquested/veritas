import prisma from "@/lib/prisma";
// Read-only reuse peran F7: can() dipakai untuk gate invite, tanpa ubah file F7.
import { can, type StudioRole } from "@/lib/studio-roles";
import {
  getProjectWorkspace,
  moveProjectToWorkspace,
} from "./workspace-projects";

export const WORKSPACE_ROLES = ["Owner", "PM", "Finance", "Staff"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const WORKSPACE_BAD_ROLE = "errors.workspace.bad_role";
export const WORKSPACE_FORBIDDEN = "errors.workspace.forbidden";
export const WORKSPACE_EMPTY_NAME = "errors.workspace.empty_name";

/** Petakan role workspace F12 ke role studio F7 agar can() bisa dipakai. */
export function toStudioRole(role: string): StudioRole {
  if (role === "PM") return "Admin";
  if (role === "Staff") return "Viewer";
  if (role === "Owner" || role === "Admin" || role === "Finance") {
    return role as StudioRole;
  }
  throw new Error(WORKSPACE_BAD_ROLE);
}

export function validateWorkspaceRole(role: string): asserts role is WorkspaceRole {
  if (!(WORKSPACE_ROLES as readonly string[]).includes(role)) {
    throw new Error(WORKSPACE_BAD_ROLE);
  }
}

/** Boleh mengundang member? = boleh "member.invite" menurut matriks F7. */
export function canInviteMember(inviterRole: string): boolean {
  try {
    return can("member.invite", toStudioRole(inviterRole));
  } catch {
    return false;
  }
}

/**
 * F12 WorkspaceService. `db` loose (pola TaskService F9) agar compile +
 * test tanpa DB. Model Workspace/WorkspaceMember SUDAH ADA di schema.
 */
export class WorkspaceService {
  constructor(private readonly db: any = prisma as any) {}

  async createWorkspace(input: { name: string; plan?: string }) {
    const name = input.name?.trim() ?? "";
    if (!name) throw new Error(WORKSPACE_EMPTY_NAME);
    return this.db.workspace.create({
      data: { name, plan: input.plan ?? "FREE" },
    });
  }

  async inviteMember(input: {
    workspaceId: string;
    userId: string;
    role: string;
    inviterRole?: string | null;
  }) {
    validateWorkspaceRole(input.role);
    if (input.inviterRole && !canInviteMember(input.inviterRole)) {
      throw new Error(WORKSPACE_FORBIDDEN);
    }
    // Simpan role F7 ("STAFF" default schema) agar konsisten dengan DB:
    // PM→Admin, Staff→Viewer, Owner/Finance apa adanya, uppercase.
    const stored = toStudioRole(input.role).toUpperCase();
    return this.db.workspaceMember.create({
      data: { workspaceId: input.workspaceId, userId: input.userId, role: stored },
    });
  }

  async listMembers(workspaceId: string) {
    return this.db.workspaceMember
      .findMany({ where: { workspaceId } })
      .catch(() => []);
  }

  async listWorkspaces() {
    return this.db.workspace.findMany({}).catch(() => []);
  }

  /**
   * Pindahkan project antar workspace. WorkspaceId TIDAK ADA di model
   * Project, jadi v1 hanya catat di mapping in-memory (workspace-projects.ts).
   * TODO: tambah kolom Project.workspaceId + migrate, lalu ganti isi method ini.
   */
  async moveProject(projectId: string, workspaceId: string) {
    moveProjectToWorkspace(projectId, workspaceId);
    return { projectId, workspaceId };
  }

  getProjectWorkspace(projectId: string): string | null {
    return getProjectWorkspace(projectId);
  }
}

export const workspaceService = new WorkspaceService();
