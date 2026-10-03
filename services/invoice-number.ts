import prisma from "@/lib/prisma";

/**
 * F4 — Nomor invoice berurutan per freelancer: `INV/<tahun>/<kode>/<seq>`,
 * mis. `INV/2026/A1B2/0001`. Kode = 4 char pertama freelancerId (tanpa `-`).
 *
 * Anti-duplikat dua lapis:
 *  1. `@@unique([freelancerId, number])` di schema (backstop atomik di DB).
 *  2. Caller yang create invoice dengan nomor ini WAJIB retry: tangkap P2002
 *     lalu panggil `nextInvoiceNumber` lagi (max 3x). Lihat TODO di bawah.
 *
 * Bentuk `db` sengaja struktural (bukan `typeof prisma`) agar bisa diuji
 * dengan mock tanpa DB, dan agar tsc tetap bersih sebelum `migrate deploy`.
 */

// TODO(F4-wave-integrasi): panggil nextInvoiceNumber + retry P2002 dari
// InvoiceService.createInvoice setelah `prisma migrate deploy` jalan.
export const INVOICE_TYPES = ["DP", "TERMIN", "FINAL", "RETAINER"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

type InvoiceNumberDb = {
  invoice: {
    findMany(args: unknown): Promise<{ number: string | null }[]>;
  };
};

function freelancerCode(freelancerId: string): string {
  return freelancerId
    .replace(/-/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");
}

export function formatInvoiceNumber(
  freelancerId: string,
  seq: number,
  year: number = new Date().getFullYear(),
): string {
  return `INV/${year}/${freelancerCode(freelancerId)}/${String(seq).padStart(4, "0")}`;
}

function seqOf(number: string | null, prefix: string): number {
  if (!number || !number.startsWith(prefix)) return 0;
  const m = /(\d{4})$/.exec(number);
  return m ? parseInt(m[1], 10) : 0;
}

/** Nomor berikutnya untuk freelancer ini (1 setelah max yang ada di tahun berjalan). */
export async function nextInvoiceNumber(
  freelancerId: string,
  db: InvoiceNumberDb = prisma as never,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getFullYear();
  const prefix = `INV/${year}/${freelancerCode(freelancerId)}/`;
  const rows = await db.invoice.findMany({
    where: { freelancerId, number: { startsWith: prefix } },
    select: { number: true },
  });
  let max = 0;
  for (const row of rows) max = Math.max(max, seqOf(row.number, prefix));
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

// --- Termin: DP + pelunasan menjumlah = nilai kontrak ------------------------

function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value.trim());
}

/** Jumlahkan nominal termin (DP + TERMIN + FINAL + ...). */
export function sumTerminAmounts(
  amounts: (bigint | number | string)[],
): bigint {
  return amounts.reduce<bigint>((sum, a) => sum + toBigInt(a), 0n);
}

/** True jika total termin tepat menutup nilai kontrak (tidak kurang/lebih). */
export function isTerminSettled(
  contractTotal: bigint | number | string,
  amounts: (bigint | number | string)[],
): boolean {
  return sumTerminAmounts(amounts) === toBigInt(contractTotal);
}
