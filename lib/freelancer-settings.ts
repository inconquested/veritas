/**
 * F3 setting per freelancer — wave integrasi: override dari tabel DB
 * `FreelancerSetting` (fail-open ke env bila baris tak ada / DB down).
 *
 * Jalur sync (`autoReleaseDays()` / `reminderChannel()` / `getSettings()`)
 * tetap untuk hot path cron; jalur async `*For()` dipakai bila freelancerId
 * diketahui (auto-release per escrow, reminder per invoice).
 */

export type ReminderChannel = "wa" | "email" | "both";

export interface FreelancerSettings {
  /** Hari diam sebelum escrow auto-release. Default 14. */
  autoReleaseDays: number;
  /** Kanal reminder invoice. Default "both". */
  reminderChannel: ReminderChannel;
}

export const DEFAULT_AUTO_RELEASE_DAYS = 14;
export const DEFAULT_REMINDER_CHANNEL: ReminderChannel = "both";

export function autoReleaseDays(): number {
  const n = Number.parseInt(process.env.AUTO_RELEASE_DAYS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_AUTO_RELEASE_DAYS;
}

export function reminderChannel(): ReminderChannel {
  const raw = (process.env.REMINDER_CHANNEL ?? "").toLowerCase().trim();
  return raw === "wa" || raw === "email" || raw === "both"
    ? raw
    : DEFAULT_REMINDER_CHANNEL;
}

export function getSettings(_freelancerId?: string): FreelancerSettings {
  return { autoReleaseDays: autoReleaseDays(), reminderChannel: reminderChannel() };
}

function normalizeChannel(raw: unknown): ReminderChannel {
  const v = String(raw ?? "").toLowerCase().trim();
  return v === "wa" || v === "email" || v === "both" ? v : DEFAULT_REMINDER_CHANNEL;
}

function normalizeDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : DEFAULT_AUTO_RELEASE_DAYS;
}

/**
 * Override per-freelancer dari DB; fallback env bila: id kosong, baris tak
 * ada, tabel belum migrate, atau DB down. Tidak pernah throw.
 */
export async function getSettingsFor(freelancerId?: string | null): Promise<FreelancerSettings> {
  const fallback = getSettings(freelancerId ?? undefined);
  if (!freelancerId || !process.env.DATABASE_URL) return fallback;
  try {
    const { default: prisma } = await import("./prisma");
    const row = await (prisma as any).freelancerSetting?.findUnique?.({
      where: { freelancerId },
    });
    if (!row) return fallback;
    return {
      autoReleaseDays: normalizeDays((row as any).autoReleaseDays),
      reminderChannel: normalizeChannel((row as any).reminderChannel),
    };
  } catch {
    return fallback;
  }
}

/** Upsert override per-freelancer (dipakai halaman settings). */
export async function saveSettingsFor(
  freelancerId: string,
  patch: Partial<FreelancerSettings>,
): Promise<FreelancerSettings> {
  const { default: prisma } = await import("./prisma");
  const row = await (prisma as any).freelancerSetting.upsert({
    where: { freelancerId },
    update: {
      ...(patch.autoReleaseDays !== undefined ? { autoReleaseDays: patch.autoReleaseDays } : {}),
      ...(patch.reminderChannel !== undefined ? { reminderChannel: patch.reminderChannel } : {}),
    },
    create: {
      freelancerId,
      autoReleaseDays: patch.autoReleaseDays ?? DEFAULT_AUTO_RELEASE_DAYS,
      reminderChannel: patch.reminderChannel ?? DEFAULT_REMINDER_CHANNEL,
    },
  });
  return {
    autoReleaseDays: normalizeDays((row as any).autoReleaseDays),
    reminderChannel: normalizeChannel((row as any).reminderChannel),
  };
}
