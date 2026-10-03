/**
 * F10 — Laporan ID (murni, tanpa DB): P&L per bulan, arus kas escrow,
 * rekap PPh 23 yang dipotong klien. Input = baris polos agar bisa dipakai
 * page server maupun test tanpa Prisma. Nominal bigint aman (tanpa float).
 */

export type LedgerRow = {
  amount: bigint | number | string;
  date: Date | string;
};

export type InvoiceLedgerRow = LedgerRow & {
  status?: string;
  clientName?: string;
};

export type EscrowLedgerRow = {
  status: string;
  amount: bigint | number | string;
};

function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(String(value).trim());
}

export function monthKeyOf(d: Date | string): string {
  const t = d instanceof Date ? d : new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

export type MonthlyPnL = {
  month: string;
  revenue: bigint;
  expense: bigint;
  profit: bigint;
};

/**
 * P&L per bulan: revenue = invoice PAID (by date), expense = bon (by date).
 * `months` = daftar "YYYY-MM" berurutan; di luar daftar diabaikan.
 */
export function monthlyPnL(
  invoices: InvoiceLedgerRow[],
  expenses: LedgerRow[],
  months: string[],
): MonthlyPnL[] {
  const rev = new Map<string, bigint>();
  const exp = new Map<string, bigint>();
  for (const inv of invoices) {
    if (inv.status != null && inv.status !== "PAID") continue;
    const k = monthKeyOf(inv.date);
    rev.set(k, (rev.get(k) ?? 0n) + toBigInt(inv.amount));
  }
  for (const e of expenses) {
    const k = monthKeyOf(e.date);
    exp.set(k, (exp.get(k) ?? 0n) + toBigInt(e.amount));
  }
  return months.map((month) => {
    const revenue = rev.get(month) ?? 0n;
    const expense = exp.get(month) ?? 0n;
    return { month, revenue, expense, profit: revenue - expense };
  });
}

export type EscrowCashflow = {
  held: bigint;
  released: bigint;
  refunded: bigint;
  disputed: bigint;
  count: number;
};

/** Arus kas escrow dari status escrow per invoice. */
export function escrowCashflow(rows: EscrowLedgerRow[]): EscrowCashflow {
  const out: EscrowCashflow = {
    held: 0n,
    released: 0n,
    refunded: 0n,
    disputed: 0n,
    count: rows.length,
  };
  for (const r of rows) {
    const amt = toBigInt(r.amount);
    if (r.status === "RELEASED") out.released += amt;
    else if (r.status === "REFUNDED") out.refunded += amt;
    else if (r.status === "DISPUTED") out.disputed += amt;
    else out.held += amt; // INITIALIZED / FUNDS_HELD
  }
  return out;
}

export type Pph23Recap = {
  base: bigint;
  withheld: bigint;
  net: bigint;
  count: number;
};

/**
 * Rekap PPh 23 dipotong klien: default tarif jasa 2% × DPP invoice PAID.
 * Integer math (basis poin) — tanpa float drift.
 */
export function pph23Recap(
  invoices: InvoiceLedgerRow[],
  percent = 2,
): Pph23Recap {
  const bp = Math.round(percent * 100);
  let base = 0n;
  let count = 0;
  for (const inv of invoices) {
    if (inv.status != null && inv.status !== "PAID") continue;
    base += toBigInt(inv.amount);
    count++;
  }
  const withheld = (base * BigInt(bp)) / 10_000n;
  return { base, withheld, net: base - withheld, count };
}
