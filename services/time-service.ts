import prisma from "@/lib/prisma";
import { nextInvoiceNumber } from "./invoice-number";

/**
 * F10 — Waktu: timer → timesheet → approval klien → invoice draft.
 *
 * Status TimeEntry (kolom String bebas, tanpa kolom/migrasi baru):
 *  RUNNING = timer jalan (minutes masih 0, diisi saat stop)
 *  DRAFT = selesai dicatat, menunggu approval klien
 *  APPROVED / REJECTED = hasil approval klien
 *  INVOICED = sudah masuk invoice (anti double-billing saat convert ulang)
 *
 * Satu timer aktif per freelancer: `startTimer` menolak bila masih ada
 * RUNNING untuk freelancerId yang sama (`errors.time.already_running`).
 *
 * Waktu mulai TIDAK disimpan di DB (schema F10 tidak punya kolom timestamp)
 * — client (`timer-button`) memegang start-ts di browser dan mengirim
 * `minutes` saat stop. `startHints` di bawah hanya petunjuk in-process
 * (dipakai test + stop tanpa minutes di proses yang sama); jika tidak ada
 * petunjuk dan `minutes` tidak dikirim → `errors.time.unknown_start`.
 *
 * Bentuk `db` struktural agar bisa diuji dengan mock tanpa DB.
 */

export const TIME_STATUSES = [
  "RUNNING",
  "DRAFT",
  "APPROVED",
  "REJECTED",
  "INVOICED",
] as const;

/** Batas satu entri: 1 menit – 24 jam (cegah timer lupa dimatikan). */
export const TIME_MAX_MINUTES = 1440;

export type TimeEntryRow = {
  id: string;
  project_id: string;
  taskId: string | null;
  freelancerId: string;
  minutes: number;
  status: string;
  rate: bigint | null;
};

export type StartTimerInput = {
  project_id: string;
  freelancerId: string;
  taskId?: string | null;
  /** Tarif per jam (IDR). Opsional saat start, wajib saat convert. */
  rate?: bigint | number | string | null;
};

export type StopTimerInput = {
  freelancerId: string;
  entryId?: string;
  /** Durasi menit (dari client). Jika kosong, pakai petunjuk in-process. */
  minutes?: number;
};

export type ManualEntryInput = {
  project_id: string;
  freelancerId: string;
  minutes: number;
  taskId?: string | null;
  rate?: bigint | number | string | null;
};

export type ConvertToInvoiceInput = {
  freelancerId: string;
  /** Kosong = semua project asal satu project; beda project = tolak. */
  project_id?: string;
  title?: string;
  currency?: string;
  paymentMethod?: string;
  dueInDays?: number;
  now?: Date;
};

export type TimeInvoiceData = {
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

export type TimeInvoiceCreator = (
  data: TimeInvoiceData,
) => Promise<{ id: string }>;

type TimeDb = {
  timeEntry: {
    findFirst(args: unknown): Promise<TimeEntryRow | null>;
    findUnique?(args: unknown): Promise<TimeEntryRow | null>;
    findMany(args: unknown): Promise<TimeEntryRow[]>;
    create(args: unknown): Promise<TimeEntryRow>;
    update(args: unknown): Promise<TimeEntryRow>;
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
  invoice: {
    findMany(args: unknown): Promise<{ number: string | null }[]>;
    create(args: unknown): Promise<{ id: string }>;
  };
};

/** Petunjuk waktu mulai in-process (key = entry id). Bukan sumber utama. */
const startHints = new Map<string, number>();

export function __clearTimeHintsForTest(): void {
  startHints.clear();
}

function toRate(value: bigint | number | string | null | undefined): bigint | null {
  if (value == null) return null;
  const rate = typeof value === "bigint" ? value : BigInt(String(value).trim());
  if (rate <= 0n) throw new Error("errors.time.invalid_rate");
  return rate;
}

function checkMinutes(minutes: number): void {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > TIME_MAX_MINUTES) {
    throw new Error("errors.time.invalid_minutes");
  }
}

export class TimeService {
  constructor(
    private readonly db: TimeDb = prisma as never,
    private readonly createInvoice?: TimeInvoiceCreator,
    private readonly clock: () => number = Date.now,
  ) {}

  /** Timer aktif freelancer ini (null bila tidak ada). */
  async activeTimer(freelancerId: string): Promise<TimeEntryRow | null> {
    return this.db.timeEntry.findFirst({
      where: { freelancerId, status: "RUNNING" },
      orderBy: { id: "asc" },
    });
  }

  /**
   * Mulai timer. Double-start (masih ada RUNNING) = tolak.
   * @throws errors.time.missing_project | errors.time.already_running
   */
  async startTimer(input: StartTimerInput): Promise<TimeEntryRow> {
    if (!input.project_id) throw new Error("errors.time.missing_project");
    if (!input.freelancerId) throw new Error("errors.time.missing_freelancer");
    const active = await this.activeTimer(input.freelancerId);
    if (active) throw new Error("errors.time.already_running");
    const row = await this.db.timeEntry.create({
      data: {
        project_id: input.project_id,
        taskId: input.taskId ?? null,
        freelancerId: input.freelancerId,
        minutes: 0,
        status: "RUNNING",
        rate: toRate(input.rate),
      },
    });
    startHints.set(row.id, this.clock());
    return row;
  }

  /**
   * Hentikan timer → isi minutes, status RUNNING→DRAFT.
   * @throws errors.time.no_active_timer (stop tanpa start)
   */
  async stopTimer(input: StopTimerInput): Promise<TimeEntryRow> {
    if (!input.freelancerId) throw new Error("errors.time.missing_freelancer");
    const active = input.entryId
      ? await this.findById(input.entryId)
      : await this.activeTimer(input.freelancerId);
    if (!active || active.status !== "RUNNING") {
      throw new Error("errors.time.no_active_timer");
    }
    let minutes = input.minutes;
    if (minutes == null) {
      const started = startHints.get(active.id);
      if (started == null) throw new Error("errors.time.unknown_start");
      minutes = Math.max(1, Math.round((this.clock() - started) / 60_000));
    }
    checkMinutes(minutes);
    startHints.delete(active.id);
    return this.db.timeEntry.update({
      where: { id: active.id },
      data: { minutes, status: "DRAFT" },
    });
  }

  /** Entri manual (lupa nyalakan timer). Langsung DRAFT. */
  async manualEntry(input: ManualEntryInput): Promise<TimeEntryRow> {
    if (!input.project_id) throw new Error("errors.time.missing_project");
    if (!input.freelancerId) throw new Error("errors.time.missing_freelancer");
    checkMinutes(input.minutes);
    return this.db.timeEntry.create({
      data: {
        project_id: input.project_id,
        taskId: input.taskId ?? null,
        freelancerId: input.freelancerId,
        minutes: input.minutes,
        status: "DRAFT",
        rate: toRate(input.rate),
      },
    });
  }

  /** Approval klien: DRAFT→APPROVED. Status lain = tolak. */
  async approveTime(id: string): Promise<TimeEntryRow> {
    const row = await this.findById(id);
    if (!row) throw new Error("errors.time.not_found");
    if (row.status !== "DRAFT") throw new Error("errors.time.bad_status");
    return this.db.timeEntry.update({
      where: { id },
      data: { status: "APPROVED" },
    });
  }

  /** Penolakan klien: DRAFT→REJECTED. Status lain = tolak. */
  async rejectTime(id: string): Promise<TimeEntryRow> {
    const row = await this.findById(id);
    if (!row) throw new Error("errors.time.not_found");
    if (row.status !== "DRAFT") throw new Error("errors.time.bad_status");
    return this.db.timeEntry.update({
      where: { id },
      data: { status: "REJECTED" },
    });
  }

  async listEntries(
    freelancerId: string,
    filter: { project_id?: string; status?: string } = {},
  ): Promise<TimeEntryRow[]> {
    return this.db.timeEntry.findMany({
      where: { freelancerId, ...filter },
      orderBy: { id: "desc" },
    });
  }

  /**
   * Jam APPROVED → invoice draft. Nominal per entri =
   * `floor(minutes × rate/jam / 60)` (integer math, tanpa float drift).
   * Entri yang dipakai ditandai INVOICED agar convert ulang = `no_billable`
   * (bukan double-billing). Rate wajib ada di tiap entri.
   *
   * Pembuatan invoice reuse path create existing: default via
   * `db.invoice.create` + `nextInvoiceNumber` (read-only import, file
   * invoice-service TIDAK diubah); test/sandbox inject `createInvoice`.
   */
  async convertToInvoice(
    input: ConvertToInvoiceInput,
  ): Promise<{ invoiceId: string; entryIds: string[]; amount: bigint }> {
    if (!input.freelancerId) throw new Error("errors.time.missing_freelancer");
    const now = input.now ?? new Date();
    const billable = await this.db.timeEntry.findMany({
      where: {
        freelancerId: input.freelancerId,
        status: "APPROVED",
        ...(input.project_id ? { project_id: input.project_id } : {}),
      },
    });
    if (billable.length === 0) throw new Error("errors.time.no_billable");
    const projectIds = [...new Set(billable.map((e) => e.project_id))];
    if (projectIds.length > 1 && !input.project_id) {
      throw new Error("errors.time.multi_project");
    }
    const project_id = input.project_id ?? projectIds[0];
    const scoped = billable.filter((e) => e.project_id === project_id);
    let amount = 0n;
    let totalMinutes = 0;
    for (const e of scoped) {
      if (e.rate == null) throw new Error("errors.time.missing_rate");
      amount += (BigInt(e.minutes) * e.rate) / 60n;
      totalMinutes += e.minutes;
    }
    if (amount <= 0n) throw new Error("errors.time.no_billable");
    const hours = (totalMinutes / 60).toFixed(1).replace(/\.0$/, "");
    const created = await this.createTimeInvoice(
      {
        project_id,
        title: input.title ?? `Jasa ${hours} jam (${scoped.length} sesi tracked)`,
        amount,
        currency: input.currency ?? "IDR",
        paymentMethod: input.paymentMethod ?? "XENDIT",
        dueDate: new Date(now.getTime() + (input.dueInDays ?? 14) * 86_400_000),
      },
      input.freelancerId,
      now,
    );
    for (const e of scoped) {
      await this.db.timeEntry.update({
        where: { id: e.id },
        data: { status: "INVOICED" },
      });
    }
    return {
      invoiceId: created.id,
      entryIds: scoped.map((e) => e.id),
      amount,
    };
  }

  private async findById(id: string): Promise<TimeEntryRow | null> {
    if (this.db.timeEntry.findUnique) {
      return this.db.timeEntry.findUnique({ where: { id } });
    }
    const rows = await this.db.timeEntry.findMany({ where: {} });
    return rows.find((r) => r.id === id) ?? null;
  }

  private async createTimeInvoice(
    draft: {
      project_id: string;
      title: string;
      amount: bigint;
      currency: string;
      paymentMethod: string;
      dueDate: Date;
    },
    freelancerId: string,
    now: Date,
  ): Promise<{ id: string }> {
    if (this.createInvoice) {
      return this.createInvoice({
        project_id: draft.project_id,
        freelancerProfileId: "",
        clientName: "",
        title: draft.title,
        amount: draft.amount,
        currency: draft.currency,
        paymentMethod: draft.paymentMethod,
        dueDate: draft.dueDate,
        number: "",
      });
    }
    const profile =
      (await this.db.freelancerProfile.findFirst({
        where: { id: freelancerId },
        select: { id: true },
      })) ??
      (await this.db.freelancerProfile.findFirst({
        where: { userId: freelancerId },
        select: { id: true },
      }));
    if (!profile) throw new Error("errors.time.profile_not_found");
    const project = await this.db.project.findUnique({
      where: { id: draft.project_id },
      select: {
        freelancerId: true,
        client: {
          select: { email: true, firstName: true, lastName: true, instanceName: true },
        },
      },
    });
    if (!project) throw new Error("errors.time.project_not_found");
    const c = project.client;
    const clientName =
      [c?.firstName, c?.lastName].filter(Boolean).join(" ") ||
      c?.instanceName ||
      c?.email ||
      "Client";
    const number = await nextInvoiceNumber(profile.id, this.db as never, now);
    return this.db.invoice.create({
      data: {
        project_id: draft.project_id,
        freelancerId: profile.id,
        clientName,
        title: draft.title,
        currency: draft.currency as never,
        amount: draft.amount,
        payment_method: draft.paymentMethod as never,
        status: "DRAFT" as never,
        due_date: draft.dueDate,
        type: "FINAL",
        number,
      },
    });
  }
}

export const timeService = new TimeService();
