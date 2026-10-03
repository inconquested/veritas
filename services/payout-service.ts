import prisma from "@/lib/prisma";
import { send as sendNotify } from "./vendor/notify/notify-service";

/**
 * F4 — Payout manual v1. Alur: freelancer klik Tarik Dana → baris `QUEUED`
 * → admin transfer via m-banking → `markDone` (catat extRef/referensi bank).
 * Tanpa disbursement API dulu (ala Projects.co.id manual settlement).
 *
 * Batas minimal (ala Projects.co.id): Rp10.000 untuk BCA/Mandiri/BNI,
 * Rp57.500 untuk bank lain (biaya transfer + buffer di bawahnya tekor).
 *
 * Anti double-submit: `idempotencyKey` unik per request. Request ganda
 * (double-click, retry) dengan key sama kembali ke baris yang sudah ada —
 * tidak pernah create baris kedua. Balapan konkuren yang lolos pre-read
 * ditangkap via P2002 lalu di-re-read sebagai replay.
 *
 * Bentuk `db` sengaja struktural agar bisa diuji dengan mock tanpa DB.
 */

export const PAYOUT_MIN_BIG_BANK = 10_000;
export const PAYOUT_MIN_OTHER_BANK = 57_500;
const BIG_BANKS = new Set(["BCA", "MANDIRI", "BNI"]);

export const PAYOUT_STATUS = ["QUEUED", "PROCESSING", "DONE", "FAILED"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUS)[number];

export type RequestPayoutInput = {
  freelancerId: string;
  amount: bigint | number | string;
  bank: string;
  accountNo: string;
  /** Kunci stabil per klik tombol — client wajib kirim UUID baru per request. */
  idempotencyKey: string;
  /** Alamat notif eksplisit (email/WA). Kosong = tanpa notif. */
  notifyTo?: string | null;
};

export type PayoutRow = {
  id: string;
  freelancerId: string;
  amount: bigint;
  bank: string;
  accountNo: string;
  status: string;
  extRef: string | null;
  idempotencyKey: string | null;
  createdAt?: Date;
};

type PayoutDb = {
  payout: {
    findUnique(args: unknown): Promise<PayoutRow | null>;
    findMany(args: unknown): Promise<PayoutRow[]>;
    create(args: unknown): Promise<PayoutRow>;
    update(args: unknown): Promise<PayoutRow>;
  };
};

export function normalizeBank(bank: string): string {
  return bank.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Minimal penarikan untuk bank tsb (IDR). */
export function payoutMinimumForBank(bank: string): number {
  return BIG_BANKS.has(normalizeBank(bank))
    ? PAYOUT_MIN_BIG_BANK
    : PAYOUT_MIN_OTHER_BANK;
}

function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value.trim());
}

/** @throws Error `errors.payout.below_minimum` jika di bawah batas bank. */
export function validatePayoutAmount(
  bank: string,
  amount: bigint | number | string,
): void {
  let value: bigint;
  try {
    value = toBigInt(amount);
  } catch {
    throw new Error("errors.payout.invalid_amount");
  }
  if (value <= 0n) throw new Error("errors.payout.invalid_amount");
  if (value < BigInt(payoutMinimumForBank(bank))) {
    throw new Error("errors.payout.below_minimum");
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Fire-and-forget notify: gagal kirim tidak boleh merusak transaksi utama. */
async function notifySafely(
  to: string | null | undefined,
  template: Parameters<typeof sendNotify>[1],
  payload: Parameters<typeof sendNotify>[2],
): Promise<void> {
  if (!to) return;
  try {
    await sendNotify(to, template, payload);
  } catch {
    // Best-effort; idempotency via NotifyLog saat retry.
  }
}

export class PayoutService {
  constructor(private readonly db: PayoutDb = prisma as never) {}

  async requestPayout(input: RequestPayoutInput): Promise<PayoutRow> {
    if (!input.freelancerId) throw new Error("errors.payout.missing_freelancer");
    if (!input.idempotencyKey || input.idempotencyKey.trim().length < 8) {
      throw new Error("errors.payout.invalid_key");
    }
    const bank = normalizeBank(input.bank);
    if (!bank) throw new Error("errors.payout.invalid_bank");
    const accountNo = input.accountNo.trim();
    if (accountNo.replace(/\D/g, "").length < 4) {
      throw new Error("errors.payout.invalid_account");
    }
    validatePayoutAmount(bank, input.amount);

    const key = input.idempotencyKey.trim();
    const existing = await this.db.payout.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) return existing; // replay: double-submit = 1 baris

    let row: PayoutRow;
    try {
      row = await this.db.payout.create({
        data: {
          freelancerId: input.freelancerId,
          amount: toBigInt(input.amount),
          bank,
          accountNo,
          status: "QUEUED",
          idempotencyKey: key,
        },
      });
    } catch (error) {
      // Kalah balapan konkuren: pemenang sudah menulis key ini.
      if (isUniqueViolation(error)) {
        const winner = await this.db.payout.findUnique({
          where: { idempotencyKey: key },
        });
        if (winner) return winner;
      }
      throw error;
    }
    // Wave integrasi: payout.requested best-effort (di luar transaksi inti).
    await notifySafely(input.notifyTo, "payout.requested", {
      entityId: row.id,
      amount: row.amount,
      currency: "IDR",
      projectTitle: bank,
      invoiceTitle: `Penarikan ${bank} ${accountNo}`,
    });
    return row;
  }

  /** Admin: transfer bank selesai → DONE (idempoten, catat extRef sekali). */
  async markDone(id: string, extRef?: string, notifyTo?: string | null): Promise<PayoutRow> {
    const row = await this.db.payout.findUnique({ where: { id } });
    if (!row) throw new Error("errors.payout.not_found");
    if (row.status === "DONE") return row;
    if (row.status !== "QUEUED" && row.status !== "PROCESSING") {
      throw new Error("errors.payout.bad_status");
    }
    const updated = await this.db.payout.update({
      where: { id },
      data: { status: "DONE", ...(extRef ? { extRef } : {}) },
    });
    // Wave integrasi: payout.done best-effort.
    await notifySafely(notifyTo, "payout.done", {
      entityId: updated.id,
      amount: updated.amount,
      currency: "IDR",
      projectTitle: updated.bank,
      invoiceTitle: `Penarikan ${updated.bank}`,
    });
    return updated;
  }

  /** Admin: transfer gagal (no. rekening salah, dsb.) → FAILED. */
  async markFailed(id: string, extRef?: string): Promise<PayoutRow> {
    const row = await this.db.payout.findUnique({ where: { id } });
    if (!row) throw new Error("errors.payout.not_found");
    if (row.status === "FAILED") return row;
    if (row.status === "DONE") throw new Error("errors.payout.bad_status");
    return this.db.payout.update({
      where: { id },
      data: { status: "FAILED", ...(extRef ? { extRef } : {}) },
    });
  }

  async listPayouts(freelancerId: string): Promise<PayoutRow[]> {
    return this.db.payout.findMany({
      where: { freelancerId },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const payoutService = new PayoutService();
