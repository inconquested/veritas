import prisma from "@/lib/prisma";

/**
 * F10 — Expense: bon difoto (receiptUrl WAJIB) + link project.
 *
 * - Tanpa foto = tolak (`errors.expense.missing_receipt`) — DoD F10.
 * - Schema Expense F6 tidak punya kolom kategori → `category` opsional
 *   di-encode sebagai prefix label `[KATEGORI] label` (tanpa migrasi),
 *   bisa dibaca balik via `splitExpenseLabel`.
 * - OCR v1 = input manual + `assertExpenseTotal` (jumlah baris = total).
 *   OCR AI beneran = TODO iterasi berikut reuse `services/ai/ai-service`.
 */

// TODO(F10-iterasi): OCR bon otomatis via ai-service (foto → label+amount),
// fallback tetap input manual + assertExpenseTotal di bawah.

export type ExpenseRow = {
  id: string;
  freelancerId: string;
  label: string;
  amount: bigint;
  date: Date;
  receiptUrl: string | null;
  project_id: string | null;
};

export type AddExpenseInput = {
  freelancerId: string;
  label: string;
  amount: bigint | number | string;
  date?: Date | string;
  /** URL foto bon (Cloudinary). WAJIB — kosong = tolak. */
  receiptUrl?: string | null;
  project_id?: string | null;
  /** Opsional, di-encode ke prefix label (tanpa kolom baru). */
  category?: string | null;
};

type ExpenseDb = {
  expense: {
    findMany(args: unknown): Promise<ExpenseRow[]>;
    create(args: unknown): Promise<ExpenseRow>;
  };
};

export function splitExpenseLabel(stored: string): {
  category: string | null;
  label: string;
} {
  const m = /^\[([^\]]{1,32})\]\s*(.*)$/.exec(stored.trim());
  if (!m) return { category: null, label: stored };
  return { category: m[1], label: m[2] || stored };
}

function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value.trim());
}

/**
 * Validasi manual pengganti OCR v1: jumlah rincian baris harus = total bon.
 * @throws errors.expense.total_mismatch
 */
export function assertExpenseTotal(
  lines: (bigint | number | string)[],
  total: bigint | number | string,
): void {
  const sum = lines.reduce<bigint>((s, l) => s + toBigInt(l), 0n);
  if (sum !== toBigInt(total)) throw new Error("errors.expense.total_mismatch");
}

export class ExpenseService {
  constructor(private readonly db: ExpenseDb = prisma as never) {}

  /** @throws errors.expense.* bila label/amount/receipt tak valid. */
  async addExpense(input: AddExpenseInput): Promise<ExpenseRow> {
    if (!input.freelancerId) throw new Error("errors.expense.missing_freelancer");
    const label = input.label?.trim();
    if (!label) throw new Error("errors.expense.missing_label");
    let amount: bigint;
    try {
      amount = toBigInt(input.amount);
    } catch {
      throw new Error("errors.expense.invalid_amount");
    }
    if (amount <= 0n) throw new Error("errors.expense.invalid_amount");
    if (!input.receiptUrl?.trim()) {
      throw new Error("errors.expense.missing_receipt");
    }
    const date = input.date == null ? new Date() : new Date(input.date);
    if (Number.isNaN(date.getTime())) throw new Error("errors.expense.invalid_date");
    const cat = input.category?.trim().toUpperCase().replace(/[[\]]/g, "");
    return this.db.expense.create({
      data: {
        freelancerId: input.freelancerId,
        label: cat ? `[${cat}] ${label}` : label,
        amount,
        date,
        receiptUrl: input.receiptUrl.trim(),
        project_id: input.project_id ?? null,
      },
    });
  }

  async listExpenses(
    freelancerId: string,
    project_id?: string | null,
  ): Promise<ExpenseRow[]> {
    return this.db.expense.findMany({
      where: { freelancerId, ...(project_id ? { project_id } : {}) },
      orderBy: { date: "desc" },
    });
  }

  /** Total bon per project (untuk P&L / reimburse). */
  async totalPerProject(project_id: string): Promise<bigint> {
    const rows = await this.db.expense.findMany({
      where: { project_id },
      select: { amount: true },
    });
    // ponytail: sum di JS (bukan aggregate) agar mock-test tanpa DB bisa jalan.
    return (rows as { amount: bigint }[]).reduce<bigint>(
      (s, r) => s + BigInt(r.amount),
      0n,
    );
  }
}

export const expenseService = new ExpenseService();
