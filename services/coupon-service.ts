import prisma from "@/lib/prisma";

/**
 * F11 — Growth: kupon diskon klien baru. `maxUses` = batas klaim;
 * `usedCount` = klaim terpakai. Lewat batas = throw
 * `errors.coupon.exhausted`.
 *
 * Bentuk `db` struktural agar bisa diuji dengan mock tanpa DB.
 */

// ponytail: check-then-set di useCoupon (bukan atomic increment bersyarat).
// Upgrade ke `updateMany({ where: { code, usedCount: { lt: maxUses } } })`
// jika klaim konkuren jadi masalah.
export const COUPON_NOT_FOUND = "errors.coupon.not_found";
export const COUPON_EXHAUSTED = "errors.coupon.exhausted";
export const COUPON_BAD_INPUT = "errors.coupon.bad_input";
export const COUPON_DUPLICATE = "errors.coupon.duplicate_code";

export type CouponRow = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOff: bigint | null;
  maxUses: number | null;
  usedCount: number;
};

export type CreateCouponInput = {
  code: string;
  percentOff?: number | null;
  amountOff?: bigint | number | string | null;
  maxUses?: number | null;
};

type CouponDb = {
  coupon: {
    findUnique(args: unknown): Promise<CouponRow | null>;
    create(args: unknown): Promise<CouponRow>;
    update(args: unknown): Promise<CouponRow>;
  };
};

function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value.trim());
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** Diskon (IDR) untuk subtotal tsb. Tanpa subtotal → persen = 0n. */
export function calcCouponDiscount(
  coupon: Pick<CouponRow, "percentOff" | "amountOff">,
  subtotal?: bigint | number | null,
): bigint {
  const sub = subtotal == null ? null : toBigInt(subtotal);
  if (coupon.percentOff != null) {
    if (sub == null || sub <= 0n) return 0n;
    return (sub * BigInt(coupon.percentOff)) / 100n;
  }
  if (coupon.amountOff != null) {
    const off = toBigInt(coupon.amountOff);
    if (sub == null) return off;
    return off > sub ? sub : off;
  }
  return 0n;
}

export class CouponService {
  constructor(private readonly db: CouponDb = prisma as never) {}

  async createCoupon(input: CreateCouponInput) {
    const code = normalizeCouponCode(input.code ?? "");
    if (!code) throw new Error(COUPON_BAD_INPUT);
    const percentOff = input.percentOff ?? null;
    if (percentOff != null && (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100)) {
      throw new Error(COUPON_BAD_INPUT);
    }
    let amountOff: bigint | null = null;
    if (input.amountOff != null) {
      try {
        amountOff = toBigInt(input.amountOff);
      } catch {
        throw new Error(COUPON_BAD_INPUT);
      }
      if (amountOff <= 0n) throw new Error(COUPON_BAD_INPUT);
    }
    if (percentOff == null && amountOff == null) throw new Error(COUPON_BAD_INPUT);
    const maxUses = input.maxUses ?? null;
    if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1)) {
      throw new Error(COUPON_BAD_INPUT);
    }
    const existing = await this.db.coupon.findUnique({ where: { code } });
    if (existing) throw new Error(COUPON_DUPLICATE);
    return this.db.coupon.create({
      data: { code, percentOff, amountOff, maxUses, usedCount: 0 },
    });
  }

  async validateCoupon(code: string, subtotal?: bigint | number | null) {
    const row = await this.db.coupon.findUnique({ where: { code: normalizeCouponCode(code) } });
    if (!row) throw new Error(COUPON_NOT_FOUND);
    if (row.maxUses != null && row.usedCount >= row.maxUses) throw new Error(COUPON_EXHAUSTED);
    const remaining = row.maxUses == null ? null : row.maxUses - row.usedCount;
    return { coupon: row, discount: calcCouponDiscount(row, subtotal), remaining };
  }

  /** Validasi + catat 1x pakai. Gagal validasi = usedCount tidak berubah. */
  async useCoupon(code: string, subtotal?: bigint | number | null) {
    const checked = await this.validateCoupon(code, subtotal);
    const updated = await this.db.coupon.update({
      where: { id: checked.coupon.id },
      data: { usedCount: checked.coupon.usedCount + 1 },
    });
    return { ...checked, coupon: updated };
  }
}

export const couponService = new CouponService();
