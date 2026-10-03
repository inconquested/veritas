/**
 * F7 peran studio (in-memory, tanpa schema).
 * TODO(wave integrasi): persist ke DB (WorkspaceMember { workspaceId, userId,
 * role }) + enforcement di requireProjectAccess; saat ini untuk gating UI +
 * dokumentasi matriks.
 */

export type StudioRole = "Owner" | "Admin" | "Finance" | "Viewer";

export type StudioAction =
  | "project.read"
  | "project.write"
  | "invoice.read"
  | "invoice.write"
  | "payout.request"
  | "payout.approve"
  | "member.invite"
  | "member.remove"
  | "settings.write"
  | "dispute.resolve";

export const STUDIO_ROLES: StudioRole[] = ["Owner", "Admin", "Finance", "Viewer"];

const MATRIX: Record<StudioAction, StudioRole[]> = {
  "project.read": ["Owner", "Admin", "Finance", "Viewer"],
  "project.write": ["Owner", "Admin"],
  "invoice.read": ["Owner", "Admin", "Finance"],
  "invoice.write": ["Owner", "Admin", "Finance"],
  "payout.request": ["Owner", "Admin", "Finance"],
  "payout.approve": ["Owner", "Admin"],
  "member.invite": ["Owner", "Admin"],
  "member.remove": ["Owner"],
  "settings.write": ["Owner", "Admin"],
  "dispute.resolve": ["Owner", "Admin"],
};

/** True when `role` may perform `action`. Unknown action -> false. */
export function can(action: StudioAction, role: StudioRole): boolean {
  return MATRIX[action]?.includes(role) ?? false;
}
