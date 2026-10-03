import prisma from "@/lib/prisma";

export const HANDSOUT_NOT_FOUND = "errors.handsout.not_found";
export const HANDSOUT_BAD_STATUS = "errors.handsout.bad_status";
export const HANDSOUT_ALREADY_APPROVED = "errors.handsout.already_approved";

/**
 * F5 handsout approval. Pakai model Handsout existing (status + version SUDAH
 * ADA di schema — jangan duplikat service). Alur: DRAFT → SUBMITTED →
 * APPROVED | REJECTED (reject: version +1, idempoten tanpa bump ganda).
 */
export class HandsoutApprovalService {
  constructor(private readonly db: any = prisma as any) {}

  private async require(id: string) {
    const h = await this.db.handsout.findUnique({ where: { id } });
    if (!h) throw new Error(HANDSOUT_NOT_FOUND);
    return h as { id: string; status: string; version: number };
  }

  /** Freelancer menyerahkan → SUBMITTED. Idempoten. */
  async submitHandsout(id: string) {
    const h = await this.require(id);
    if (h.status === "SUBMITTED") return h;
    if (h.status === "APPROVED") throw new Error(HANDSOUT_ALREADY_APPROVED);
    return this.db.handsout.update({ where: { id }, data: { status: "SUBMITTED" } });
  }

  /** Klien setuju → APPROVED. Idempoten. */
  async approveHandsout(id: string) {
    const h = await this.require(id);
    if (h.status === "APPROVED") return h;
    if (h.status !== "SUBMITTED") throw new Error(HANDSOUT_BAD_STATUS);
    return this.db.handsout.update({ where: { id }, data: { status: "APPROVED" } });
  }

  /** Klien minta revisi → REJECTED + version +1. Idempoten (bump sekali). */
  async rejectHandsout(id: string) {
    const h = await this.require(id);
    if (h.status === "REJECTED") return h;
    if (h.status !== "SUBMITTED") throw new Error(HANDSOUT_BAD_STATUS);
    return this.db.handsout.update({
      where: { id },
      data: { status: "REJECTED", version: h.version + 1 },
    });
  }
}

export const handsoutApproval = new HandsoutApprovalService();
