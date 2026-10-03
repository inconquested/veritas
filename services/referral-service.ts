import prisma from "@/lib/prisma";

/**
 * F11 — Growth: referral freelancer→freelancer (kredit Pro gratis).
 * Convert tepat sekali: redeem kedua dengan kode sama = throw
 * `errors.referral.already_converted` (konversi tetap 1).
 *
 * Bentuk `db` struktural agar bisa diuji dengan mock tanpa DB.
 */

// ponytail: check-then-set (bukan updateMany bersyarat). Upgrade ke
// `updateMany({ where: { code, converted: false } })` jika redeem konkuren
// jadi masalah.
export const REFERRAL_NOT_FOUND = "errors.referral.not_found";
export const REFERRAL_ALREADY_CONVERTED = "errors.referral.already_converted";
export const REFERRAL_DUPLICATE = "errors.referral.duplicate_code";

export type ReferralRow = {
  id: string;
  code: string;
  referrerId: string;
  converted: boolean;
};

type ReferralDb = {
  referral: {
    findUnique(args: unknown): Promise<ReferralRow | null>;
    findMany(args: unknown): Promise<ReferralRow[]>;
    create(args: unknown): Promise<ReferralRow>;
    update(args: unknown): Promise<ReferralRow>;
  };
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `VTS-${suffix}`;
}

export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export class ReferralService {
  constructor(private readonly db: ReferralDb = prisma as never) {}

  async createReferralCode(referrerId: string, code?: string) {
    if (!referrerId) throw new Error("errors.referral.missing_referrer");
    const normalized = code ? normalizeReferralCode(code) : generateReferralCode();
    if (!normalized) throw new Error("errors.referral.empty_code");
    const existing = await this.db.referral.findUnique({ where: { code: normalized } });
    if (existing) throw new Error(REFERRAL_DUPLICATE);
    return this.db.referral.create({
      data: { code: normalized, referrerId, converted: false },
    });
  }

  listReferrals(referrerId: string) {
    if (!referrerId) throw new Error("errors.referral.missing_referrer");
    return this.db.referral.findMany({
      where: { referrerId },
      orderBy: { code: "asc" },
    });
  }

  /** Tandai kode terpakai. Sekali convert — redeem ulang = throw. */
  async redeemReferral(code: string) {
    const normalized = normalizeReferralCode(code);
    const row = await this.db.referral.findUnique({ where: { code: normalized } });
    if (!row) throw new Error(REFERRAL_NOT_FOUND);
    if (row.converted) throw new Error(REFERRAL_ALREADY_CONVERTED);
    return this.db.referral.update({ where: { id: row.id }, data: { converted: true } });
  }
}

export const referralService = new ReferralService();
