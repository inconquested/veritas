/**
 * F12 mapping project ↔ workspace (in-memory).
 *
 * TODO: ganti dengan kolom `Project.workspaceId` + `prisma migrate deploy`.
 * Model Project TIDAK punya kolom workspaceId/Json, dan meminjam kolom model
 * lain (mis. HandoverNote/metadata) sebagai tempat simpan = hack yang
 * mengotori data — jadi v1 jujur in-memory: mapping hilang saat restart,
 * cukup untuk alur UI tanpa tabrakan dengan eksekutor paralel.
 */

const store = new Map<string, string>();

export function moveProjectToWorkspace(projectId: string, workspaceId: string): void {
  if (!projectId || !workspaceId) throw new Error("errors.workspace.missing_scope");
  store.set(projectId, workspaceId);
}

export function getProjectWorkspace(projectId: string): string | null {
  return store.get(projectId) ?? null;
}

export function listWorkspaceProjects(workspaceId: string): string[] {
  return [...store.entries()]
    .filter(([, ws]) => ws === workspaceId)
    .map(([projectId]) => projectId);
}

export function removeProjectFromWorkspace(projectId: string): void {
  store.delete(projectId);
}

/** Hanya untuk test (reset antar kasus). */
export function __clearWorkspaceProjects(): void {
  store.clear();
}
