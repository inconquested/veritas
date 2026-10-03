import prisma from "@/lib/prisma";
import { nextInvoiceNumber } from "./invoice-number";

/**
 * F6 — Retainer: tagihan bulanan otomatis per project.
 *
 * - `createRetainer` / `cancelRetainer`: CRUD minimal (active flag).
 * - `runRetainerCycle(now)`: untuk tiap retainer aktif yang `nextRunAt <= now`,
 *   buat 1 invoice `type: "RETAINER"` untuk periode berjalan lalu majukan
 *   `nextRunAt` +1 bulan. Dipanggil dari cron `/api/cron/retainer`
 *   (jadwal di vercel.json — wave integrasi).
 *
 * Idempoten per bulan via query (tanpa kolom/schema baru): sebelum create,
 * cek `invoice.findFirst({ project_id, type: RETAINER, createdAt in bulan })`.
 * Sudah ada → skip create, tetap majukan `nextRunAt`.
 *
 * Penomoran reuse `nextInvoiceNumber` existing (read-only import, file itu
 * tidak diubah). `InvoiceService.createInvoice` TIDAK dipakai langsung karena
 * butuh sesi Clerk (tak ada di cron) — create via `db.invoice.create` dengan
 * field yang sama. Creator bisa di-inject untuk test.
 */

export const RETAINER_TYPE = "RETAINER";

export type RetainerRow = {
  id: string;
  project_id: string;
  monthlyFee: bigint;
  nextRunAt: Date;
  active: boolean;
};

export type CreateRetainerInput = {
  project_id: string;
  monthlyFee: bigint | number | string;
  startAt?: Date;
};

export type RetainerCycleOptions = {
  now?: Date;
  currency?: string;
  paymentMethod?: string;
  dueInDays?: number;
};

export type RetainerInvoiceData = {
  project_id: string;
  freelancerProfileId: string;
  clientName: string;
  title: string;
  amount: bigint;
  currency: string;
  paymentMethod: string;
  dueDate: Date;
  number: string;
};

export type RetainerInvoiceCreator = (
  data: RetainerInvoiceData,
) => Promise<{ id: string }>;

type RetainerDb = {
  retainer: {
    findMany(args: unknown): Promise<RetainerRow[]>;
    findUnique(args: unknown): Promise<RetainerRow | null>;
    create(args: unknown): Promise<RetainerRow>;
    update(args: unknown): Promise<RetainerRow>;
  };
  invoice: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    findMany(args: unknown): Promise<{ number: string | null }[]>;
    create(args: unknown): Promise<{ id: string }>;
  };
  project: {
    findUnique(args: unknown): Promise<{
      freelancerId: string;
      client: {
        email?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        instanceName?: string | null;
      } | null;
    } | null>;
  };
  freelancerProfile: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
};

function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value.trim());
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfNextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function addOneMonth(d: Date): Date {
  const next = new Date(d);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function monthLabel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export class RetainerService {
  constructor(
    private readonly db: RetainerDb = prisma as never,
    private readonly createInvoice?: RetainerInvoiceCreator,
  ) {}

  async createRetainer(input: CreateRetainerInput): Promise<RetainerRow> {
    if (!input.project_id) throw new Error("errors.retainer.missing_project");
    let fee: bigint;
    try {
      fee = toBigInt(input.monthlyFee);
    } catch {
      throw new Error("errors.retainer.invalid_fee");
    }
    if (fee <= 0n) throw new Error("errors.retainer.invalid_fee");
    return this.db.retainer.create({
      data: {
        project_id: input.project_id,
        monthlyFee: fee,
        nextRunAt: input.startAt ?? new Date(),
        active: true,
      },
    });
  }

  /** Idempoten: retainer yang sudah nonaktif dikembalikan apa adanya. */
  async cancelRetainer(id: string): Promise<RetainerRow> {
    const row = await this.db.retainer.findUnique({ where: { id } });
    if (!row) throw new Error("errors.retainer.not_found");
    if (!row.active) return row;
    return this.db.retainer.update({ where: { id }, data: { active: false } });
  }

  /**
   * Satu putaran penagihan. Mengembalikan daftar `{ retainerId, invoiceId }`
   * — `invoiceId` null saat periode sudah punya invoice (skip idempoten).
   */
  async runRetainerCycle(opts: RetainerCycleOptions = {}): Promise<
    { retainerId: string; invoiceId: string | null }[]
  > {
    const now = opts.now ?? new Date();
    const due = await this.db.retainer.findMany({
      where: { active: true, nextRunAt: { lte: now } },
    });
    const out: { retainerId: string; invoiceId: string | null }[] = [];
    for (const r of due) {
      const period = r.nextRunAt <= now ? r.nextRunAt : now;
      const from = startOfMonth(period);
      const to = startOfNextMonth(period);
      const existing = await this.db.invoice.findFirst({
        where: {
          project_id: r.project_id,
          type: RETAINER_TYPE,
          createdAt: { gte: from, lt: to },
        },
      });
      let invoiceId: string | null = existing?.id ?? null;
      if (!existing) {
        const created = await this.createRetainerInvoice(r, period, opts);
        invoiceId = created.id;
      }
      await this.db.retainer.update({
        where: { id: r.id },
        data: { nextRunAt: addOneMonth(r.nextRunAt) },
      });
      out.push({ retainerId: r.id, invoiceId });
    }
    return out;
  }

  private async createRetainerInvoice(
    r: RetainerRow,
    period: Date,
    opts: RetainerCycleOptions,
  ): Promise<{ id: string }> {
    if (this.createInvoice) {
      // Jalur test/sandbox: caller inject creator (termasuk penomoran sendiri).
      return this.createInvoice({
        project_id: r.project_id,
        freelancerProfileId: "",
        clientName: "",
        title: `Retainer ${monthLabel(period)}`,
        amount: r.monthlyFee,
        currency: opts.currency ?? "IDR",
        paymentMethod: opts.paymentMethod ?? "XENDIT",
        dueDate: new Date(Date.now() + (opts.dueInDays ?? 14) * 86_400_000),
        number: "",
      });
    }
    const project = await this.db.project.findUnique({
      where: { id: r.project_id },
      select: {
        freelancerId: true,
        client: {
          select: { email: true, firstName: true, lastName: true, instanceName: true },
        },
      },
    });
    if (!project) throw new Error("errors.retainer.project_not_found");
    const profile = await this.db.freelancerProfile.findFirst({
      where: { userId: project.freelancerId },
      select: { id: true },
    });
    if (!profile) throw new Error("errors.retainer.profile_not_found");
    const c = project.client;
    const clientName =
      [c?.firstName, c?.lastName].filter(Boolean).join(" ") ||
      c?.instanceName ||
      c?.email ||
      "Client";
    const number = await nextInvoiceNumber(
      profile.id,
      this.db as never,
      period,
    );
    return this.db.invoice.create({
      data: {
        project_id: r.project_id,
        freelancerId: profile.id,
        clientName,
        title: `Retainer ${monthLabel(period)}`,
        currency: (opts.currency ?? "IDR") as never,
        amount: r.monthlyFee,
        payment_method: (opts.paymentMethod ?? "XENDIT") as never,
        status: "DRAFT" as never,
        due_date: new Date(Date.now() + (opts.dueInDays ?? 14) * 86_400_000),
        type: RETAINER_TYPE,
        number,
      },
    });
  }
}

export const retainerService = new RetainerService();
