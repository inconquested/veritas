import prisma from "@/lib/prisma";
import { mediaService, type MediaService } from "./vendor/media/media-service";

export const ATTACHMENT_MISSING_PARENT = "errors.attachment.missing_parent";
export const ATTACHMENT_MISSING_URL = "errors.attachment.missing_url";
export const ATTACHMENT_VERSION_NOT_FOUND = "errors.attachment.version_not_found";

export type AddAttachmentInput = {
  parentType: string;
  parentId: string;
  url: string;
  uploader?: string | null;
  note?: string | null;
  hash?: string | null;
};

/**
 * F9 file versioning di atas model Attachment existing (parent polimorfik
 * parentType+parentId). Tiap add = version max+1; revert = baris BARU berisi
 * URL versi lama (riwayat tidak pernah dihapus). Upload file mentah reuse
 * media-service (Cloudinary) read-only — file ini TIDAK mengubahnya.
 */
export class AttachmentService {
  constructor(
    private readonly db: any = prisma as any,
    private readonly media: MediaService = mediaService,
  ) {}

  /** Upload mentah via Cloudinary → kembalikan URL (dipakai sebelum addAttachment). */
  uploadFiles(files: File[]) {
    return this.media.uploadMediaMultiple(files);
  }

  async addAttachment(input: AddAttachmentInput) {
    if (!input.parentType || !input.parentId) throw new Error(ATTACHMENT_MISSING_PARENT);
    if (!input.url?.trim()) throw new Error(ATTACHMENT_MISSING_URL);
    const latest: any[] = await this.db.attachment
      .findMany({
        where: { parentType: input.parentType, parentId: input.parentId },
        orderBy: { version: "desc" },
        take: 1,
      })
      .catch(() => []);
    const version = latest.length ? Number(latest[0].version) + 1 : 1;
    const row = await this.db.attachment.create({
      data: {
        parentType: input.parentType,
        parentId: input.parentId,
        version,
        hash: input.hash ?? null,
        uploader: input.uploader ?? null,
        note: input.note ?? null,
        url: input.url,
      },
    });
    try {
      await this.db.activityEvent?.create?.({
        data: {
          // project_id diisi bila parent-nya task/handsout milik project;
          // pemanggil boleh override via metadata. Default: parentId (server
          // section me-resolve ke project sungguhan).
          project_id: input.parentId,
          actorId: input.uploader ?? null,
          action: "attachment.added",
          metadata: {
            parentType: input.parentType,
            parentId: input.parentId,
            version,
            note: input.note ?? null,
          },
        },
      });
    } catch {
      // Pre-migrate skip.
    }
    return row;
  }

  getVersions(parentType: string, parentId: string) {
    return this.db.attachment
      .findMany({
        where: { parentType, parentId },
        orderBy: { version: "asc" },
      })
      .catch(() => []);
  }

  /**
   * Kembalikan ke versi N: tulis baris baru berisi URL versi N.
   * Mengembalikan baris baru (bukan menimpa).
   */
  async revertTo(
    parentType: string,
    parentId: string,
    version: number,
    opts: { uploader?: string | null; note?: string | null } = {},
  ) {
    const versions: any[] = await this.getVersions(parentType, parentId);
    const target = versions.find((v) => Number(v.version) === Number(version));
    if (!target) throw new Error(ATTACHMENT_VERSION_NOT_FOUND);
    return this.addAttachment({
      parentType,
      parentId,
      url: String(target.url),
      hash: target.hash ?? null,
      uploader: opts.uploader ?? null,
      note: opts.note ?? `revert to v${version}`,
    });
  }
}

export const attachmentService = new AttachmentService();
