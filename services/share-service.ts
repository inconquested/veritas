import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const SHARE_NOT_FOUND = "errors.share.not_found";
const DEFAULT_EXPIRES_DAYS = 30;

// Whitelist select: project progress + billing only. No User / FreelancerProfile
// tables are ever selected here, so a magic link cannot leak other users' data.
const portalProjectSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  milestones: {
    select: { id: true, title: true, description: true, due_date: true },
    orderBy: { due_date: "asc" },
  },
  handsouts: {
    select: {
      id: true,
      title: true,
      description: true,
      content_url: true,
      thumb_url: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  },
  invoices: {
    select: {
      id: true,
      title: true,
      currency: true,
      amount: true,
      status: true,
      due_date: true,
      payment_method: true,
      providerTxId: true,
      escrow: {
        select: {
          status: true,
          providerTxId: true,
          events: {
            select: {
              id: true,
              action: true,
              actorRole: true,
              fromStatus: true,
              toStatus: true,
              createdAt: true,
              metadata: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.ProjectSelect;

export type PortalProject = Prisma.ProjectGetPayload<{
  select: typeof portalProjectSelect;
}>;

export class ShareService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async createShareLink(
    projectId: string,
    opts: { expiresInDays?: number; scope?: string } = {},
  ) {
    if (!projectId) throw new Error("errors.project.missing_user");
    const project = await this.db.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new Error(SHARE_NOT_FOUND);
    const expiresInDays = opts.expiresInDays ?? DEFAULT_EXPIRES_DAYS;
    return this.db.projectShareToken.create({
      data: {
        project_id: projectId,
        token: randomUUID(),
        scope: opts.scope ?? "view",
        expiresAt:
          expiresInDays > 0
            ? new Date(Date.now() + expiresInDays * 86_400_000)
            : null,
      },
    });
  }

  listShareLinks(projectId: string) {
    return this.db.projectShareToken.findMany({
      where: { project_id: projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeShareLink(token: string) {
    if (!token) throw new Error(SHARE_NOT_FOUND);
    const deleted = await this.db.projectShareToken.deleteMany({
      where: { token },
    });
    if (deleted.count === 0) throw new Error(SHARE_NOT_FOUND);
    return true;
  }

  async getProjectByToken(token: string) {
    if (!token) throw new Error(SHARE_NOT_FOUND);
    const share = await this.db.projectShareToken.findUnique({
      where: { token },
    });
    // Expired and revoked (row gone) both 404 — no signal about which it was.
    if (!share) throw new Error(SHARE_NOT_FOUND);
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
      throw new Error(SHARE_NOT_FOUND);
    }
    const project = await this.db.project.findUnique({
      where: { id: share.project_id },
      select: portalProjectSelect,
    });
    if (!project) throw new Error(SHARE_NOT_FOUND);
    return { project: project as PortalProject, scope: share.scope };
  }
}

export const shareService = new ShareService();
