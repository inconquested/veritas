import prisma from "@/lib/prisma";

/**
 * F6 — Review terverifikasi. Satu review per project (`project_id` unique).
 *
 * Gate (read-only ke model existing, tanpa ubah schema/service lain):
 *  1. minimal 1 invoice `PAID` untuk project ini, dan
 *  2. escrow salah satu invoice PAID tersebut sudah `RELEASED`.
 * Lolos → `verifiedAt = now`. Gagal → throw `errors.review.*`.
 *
 * Bentuk `db` struktural agar bisa diuji dengan mock tanpa DB.
 */

export type SubmitReviewInput = {
  project_id: string;
  rating: number;
  text?: string;
};

type ReviewDb = {
  review: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<unknown>;
  };
  invoice: {
    findMany(args: unknown): Promise<{ id: string }[]>;
  };
  escrow: {
    findMany(args: unknown): Promise<{ status: string }[]>;
  };
};

export class ReviewService {
  constructor(private readonly db: ReviewDb = prisma as never) {}

  async submitReview(input: SubmitReviewInput) {
    if (!input.project_id) throw new Error("errors.review.missing_project");
    if (
      !Number.isInteger(input.rating) ||
      input.rating < 1 ||
      input.rating > 5
    ) {
      throw new Error("errors.review.invalid_rating");
    }

    // Gate 1: ada invoice PAID untuk project ini?
    const paid = await this.db.invoice.findMany({
      where: { project_id: input.project_id, status: "PAID" },
      select: { id: true },
    });
    if (paid.length === 0) throw new Error("errors.review.unpaid");

    // Gate 2: escrow salah satunya sudah RELEASED?
    const escrows = await this.db.escrow.findMany({
      where: { invoiceId: { in: paid.map((i) => i.id) } },
      select: { status: true },
    });
    if (!escrows.some((e) => e.status === "RELEASED")) {
      throw new Error("errors.review.escrow_not_released");
    }

    const existing = await this.db.review.findUnique({
      where: { project_id: input.project_id },
    });
    if (existing) throw new Error("errors.review.already_exists");

    return this.db.review.create({
      data: {
        project_id: input.project_id,
        rating: input.rating,
        text: input.text?.trim() || null,
        verifiedAt: new Date(),
      },
    });
  }
}

export const reviewService = new ReviewService();
