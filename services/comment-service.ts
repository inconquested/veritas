import prisma from "@/lib/prisma";
import { mediaService, type MediaService } from "./vendor/media/media-service";

export const COMMENT_EMPTY_BODY = "errors.comment.empty_body";

export type CommentInput = {
  projectId: string;
  milestoneId?: string | null;
  handsoutId?: string | null;
  authorId: string;
  authorRole: string;
  body: string;
  attachments?: string[];
};

export type CommentThreadFilter = {
  milestoneId?: string | null;
  handsoutId?: string | null;
};

/**
 * F2 evidence thread. Row shape mirrors the Prisma Comment model; `db` is
 * typed loose on purpose so this compiles before `prisma generate` runs
 * against a reachable DB (TODO: tighten to generated types post-migrate).
 */
export class CommentService {
  constructor(
    private readonly db: { comment: any } = prisma as any,
    private readonly media: MediaService = mediaService,
  ) {}

  async addComment(input: CommentInput) {
    const body = input.body?.trim() ?? "";
    if (!body) throw new Error(COMMENT_EMPTY_BODY);
    if (!input.projectId) throw new Error("errors.comment.missing_project");
    if (!input.authorId) throw new Error("errors.comment.missing_author");
    const row = await this.db.comment.create({
      data: {
        project_id: input.projectId,
        milestone_id: input.milestoneId ?? null,
        handsout_id: input.handsoutId ?? null,
        authorId: input.authorId,
        authorRole: input.authorRole,
        body,
        attachments: input.attachments ?? [],
      },
    });
    // Wave integrasi: notify comment.created dikirim dari actions/comments.ts
    // (punya konteks auth + alamat penerima); service ini tetap murni tulis.
    return row;
  }

  /** Upload bukti via Cloudinary (reuse media-service yang ada). */
  uploadAttachments(files: File[]) {
    return this.media.uploadMediaMultiple(files);
  }

  async getComments(projectId: string, filter: CommentThreadFilter = {}) {
    if (!projectId) throw new Error("errors.comment.missing_project");
    const where: Record<string, unknown> = { project_id: projectId };
    if (filter.milestoneId !== undefined)
      where.milestone_id = filter.milestoneId;
    if (filter.handsoutId !== undefined) where.handsout_id = filter.handsoutId;
    return this.db.comment.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });
  }
}

export const commentService = new CommentService();
