/**
 * F3 notify infra: satu interface `send(to, template, payload)` + adapter
 * Resend (email) + Fonnte/Wablas (WA) + stub log saat key kosong (dev).
 *
 * Idempotency: satu key per (event, entityId[, dedupeSuffix]). L1 = Map
 * in-memory (cepat, dipakai test); L2 = tabel DB `NotifyLog`
 * (kolom idempotencyKey UNIQUE) agar dedupe bertahan lintas isolate dan
 * restart — wave integrasi. Gagal transport = tidak dicatat (boleh retry).
 */

export type NotifyEvent =
  | "invoice.sent"
  | "escrow.funded"
  | "handsout.submitted"
  | "dispute.opened"
  | "escrow.released"
  | "invoice.overdue"
  | "comment.created"
  | "mention.created"
  | "dispute.resolved"
  | "ticket.sla_breach"
  | "payout.requested"
  | "payout.done"
  | "lead.auto_reply";

export const NOTIFY_EVENTS: readonly NotifyEvent[] = [
  "invoice.sent",
  "escrow.funded",
  "handsout.submitted",
  "dispute.opened",
  "escrow.released",
  "invoice.overdue",
  "comment.created",
  "mention.created",
  "dispute.resolved",
  "ticket.sla_breach",
  "payout.requested",
  "payout.done",
  "lead.auto_reply",
];

export type NotifyLocale = "id" | "en";
export type NotifyChannel = "email" | "wa";

export interface NotifyPayload {
  /** Idempotency scope: key = `${event}:${entityId}[:${dedupeSuffix}]`. */
  entityId: string;
  locale?: NotifyLocale;
  /** Magic-link token portal; link = `${baseUrl}/p/${token}`. */
  portalToken?: string | null;
  amount?: bigint | number | string | null;
  currency?: string | null;
  deadline?: Date | string | null;
  projectTitle?: string | null;
  invoiceTitle?: string | null;
  /** Pembeduk bucket agar reminder H-3/H+0/H+1 tidak saling menelan. */
  dedupeSuffix?: string | null;
}

export interface NotifyResult {
  ok: boolean;
  channel: NotifyChannel;
  idempotencyKey: string;
  replayed: boolean;
  stubbed: boolean;
  error?: string;
}

export function idempotencyKeyFor(
  event: NotifyEvent,
  entityId: string,
  suffix?: string | null,
): string {
  return suffix ? `${event}:${entityId}:${suffix}` : `${event}:${entityId}`;
}

// ---------------------------------------------------------------------------
// Dedupe store: L1 in-memory + L2 tabel DB NotifyLog (wave integrasi)
// ---------------------------------------------------------------------------

const sentKeys = new Map<string, { stubbed: boolean }>();
const stats: { sent: number } = { sent: 0 };

/** L2: sudah pernah terkirim menurut DB? false bila DB tak reachable (fallback L1). */
export async function isNotifyLogged(key: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false; // test/hermetic: andalkan L1
  try {
    const { default: prisma } = await import("../../../lib/prisma");
    const row = await (prisma as any).notifyLog?.findUnique?.({
      where: { idempotencyKey: key },
    });
    return !!row;
  } catch {
    return false;
  }
}

/** L2: catat kiriman ke DB. P2002 (balapan) = abaikan, dianggap replay. */
export async function recordNotifyLog(key: string, template: string): Promise<void> {
  if (!process.env.DATABASE_URL) return; // test/hermetic: L1 cukup
  try {
    const { default: prisma } = await import("../../../lib/prisma");
    await (prisma as any).notifyLog?.create?.({
      data: { idempotencyKey: key, template },
    });
  } catch {
    // Pre-migrate / DB down / P2002 = skip diam-diam, L1 sudah mencatat.
  }
}

export function getNotifyStats(): { sent: number; keys: number } {
  return { sent: stats.sent, keys: sentKeys.size };
}

/** Test-only: kosongkan dedupe + counter. */
export function resetNotifyDedupe(): void {
  sentKeys.clear();
  stats.sent = 0;
}

let fetchImpl: typeof globalThis.fetch = globalThis.fetch;

/** Test-only: injeksikan fetch palsu untuk menghitung panggilan transport. */
export function __setNotifyFetch(fn: typeof globalThis.fetch): void {
  fetchImpl = fn;
}

/** Test-only: kembalikan fetch asli. */
export function __resetNotifyFetch(): void {
  fetchImpl = globalThis.fetch;
}

// ---------------------------------------------------------------------------
// Formatting + template
// ---------------------------------------------------------------------------

export function formatMoney(
  amount: bigint | number | string | null | undefined,
  currency: string | null | undefined,
  locale: NotifyLocale,
): string {
  const cur = (currency || "IDR").toUpperCase();
  if (amount == null || amount === "") return cur;
  try {
    return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `${cur} ${String(amount)}`;
  }
}

export function formatDate(
  value: Date | string | null | undefined,
  locale: NotifyLocale,
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function portalLinkFor(
  token?: string | null,
  baseUrl?: string,
): string {
  const base = (baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return token ? `${base}/p/${token}` : base;
}

interface TemplateCtx {
  portalLink: string;
  amountText: string;
  deadlineText: string;
  projectTitle: string;
  invoiceTitle: string;
}

type TemplateStrings = { subject: string; text: string };

const TEMPLATES: Record<
  NotifyEvent,
  { id: (c: TemplateCtx) => TemplateStrings; en: (c: TemplateCtx) => TemplateStrings }
> = {
  "invoice.sent": {
    id: (c) => ({
      subject: `Invoice ${c.invoiceTitle} ${c.amountText} — jatuh tempo ${c.deadlineText}`,
      text:
        `Halo,\n\nInvoice "${c.invoiceTitle}" untuk proyek "${c.projectTitle}" sebesar ${c.amountText}, jatuh tempo ${c.deadlineText}.\n\n` +
        `Lihat & bayar lewat link aman ini:\n${c.portalLink}\n\nAbaikan pesan ini jika sudah dibayar. Terima kasih!`,
    }),
    en: (c) => ({
      subject: `Invoice ${c.invoiceTitle} ${c.amountText} — due ${c.deadlineText}`,
      text:
        `Hi,\n\nInvoice "${c.invoiceTitle}" for project "${c.projectTitle}" is ${c.amountText}, due ${c.deadlineText}.\n\n` +
        `View & pay via this secure link:\n${c.portalLink}\n\nIgnore this if already paid. Thank you!`,
    }),
  },
  "escrow.funded": {
    id: (c) => ({
      subject: `Dana ${c.amountText} aman di escrow — proyek ${c.projectTitle}`,
      text:
        `Kabar baik! Pembayaran ${c.amountText} untuk "${c.invoiceTitle}" (proyek "${c.projectTitle}") sudah masuk escrow dan aman.\n\n` +
        `Pantau progres di sini:\n${c.portalLink}\n\nDana cair otomatis ke freelancer setelah klien approve (tenggat ${c.deadlineText}).`,
    }),
    en: (c) => ({
      subject: `${c.amountText} secured in escrow — ${c.projectTitle}`,
      text:
        `Good news! Payment of ${c.amountText} for "${c.invoiceTitle}" (project "${c.projectTitle}") is now held safely in escrow.\n\n` +
        `Track progress here:\n${c.portalLink}\n\nFunds auto-release to the freelancer after client approval (deadline ${c.deadlineText}).`,
    }),
  },
  "handsout.submitted": {
    id: (c) => ({
      subject: `Hasil kerja "${c.invoiceTitle}" perlu direview — ${c.projectTitle}`,
      text:
        `Freelancer mengirim hasil kerja "${c.invoiceTitle}" untuk proyek "${c.projectTitle}". Mohon direview sebelum ${c.deadlineText}.\n\n` +
        `Lihat hasilnya di sini:\n${c.portalLink}\n\nDana escrow ${c.amountText} cair setelah kamu approve.`,
    }),
    en: (c) => ({
      subject: `Deliverable "${c.invoiceTitle}" needs review — ${c.projectTitle}`,
      text:
        `The freelancer submitted "${c.invoiceTitle}" for project "${c.projectTitle}". Please review before ${c.deadlineText}.\n\n` +
        `View it here:\n${c.portalLink}\n\nEscrowed funds of ${c.amountText} release after you approve.`,
    }),
  },
  "dispute.opened": {
    id: (c) => ({
      subject: `Sengketa dibuka: "${c.invoiceTitle}" (${c.amountText})`,
      text:
        `Sengketa dibuka untuk "${c.invoiceTitle}" (proyek "${c.projectTitle}", nilai ${c.amountText}). Dana ditahan dan tidak bisa cair sepihak.\n\n` +
        `Tanggapi sebelum ${c.deadlineText} di sini:\n${c.portalLink}`,
    }),
    en: (c) => ({
      subject: `Dispute opened: "${c.invoiceTitle}" (${c.amountText})`,
      text:
        `A dispute was opened for "${c.invoiceTitle}" (project "${c.projectTitle}", value ${c.amountText}). Funds are frozen — no unilateral release.\n\n` +
        `Respond before ${c.deadlineText} here:\n${c.portalLink}`,
    }),
  },
  "escrow.released": {
    id: (c) => ({
      subject: `Dana ${c.amountText} dicairkan — ${c.projectTitle}`,
      text:
        `Dana escrow ${c.amountText} untuk "${c.invoiceTitle}" (proyek "${c.projectTitle}") sudah dicairkan ke freelancer.\n\n` +
        `Lihat buktinya di sini:\n${c.portalLink}\n\nTerima kasih sudah memakai Veritas!\n` +
        `(Arsip: invoice ini jatuh tempo pada ${c.deadlineText}.)`,
    }),
    en: (c) => ({
      subject: `${c.amountText} released — ${c.projectTitle}`,
      text:
        `Escrowed funds of ${c.amountText} for "${c.invoiceTitle}" (project "${c.projectTitle}") have been released to the freelancer.\n\n` +
        `See the receipt here:\n${c.portalLink}\n\nThanks for using Veritas!\n` +
        `(Record: this invoice was due ${c.deadlineText}.)`,
    }),
  },
  "invoice.overdue": {
    id: (c) => ({
      subject: `LEWAT JATUH TEMPO: invoice ${c.invoiceTitle} ${c.amountText}`,
      text:
        `Invoice "${c.invoiceTitle}" untuk proyek "${c.projectTitle}" sebesar ${c.amountText} sudah lewat jatuh tempo (${c.deadlineText}).\n\n` +
        `Bayar sekarang lewat link aman ini:\n${c.portalLink}\n\nHubungi freelancer jika ada kendala.`,
    }),
    en: (c) => ({
      subject: `OVERDUE: invoice ${c.invoiceTitle} ${c.amountText}`,
      text:
        `Invoice "${c.invoiceTitle}" for project "${c.projectTitle}" of ${c.amountText} is past due (${c.deadlineText}).\n\n` +
        `Pay now via this secure link:\n${c.portalLink}\n\nContact the freelancer if anything is blocking payment.`,
    }),
  },
  "comment.created": {
    id: (c) => ({
      subject: `Komentar baru di ${c.projectTitle} — ${c.invoiceTitle}`,
      text:
        `Ada komentar baru "${c.invoiceTitle}" di proyek "${c.projectTitle}" (nilai terkait ${c.amountText}).\n\n` +
        `Lihat & balas sebelum ${c.deadlineText} di sini:\n${c.portalLink}`,
    }),
    en: (c) => ({
      subject: `New comment on ${c.projectTitle} — ${c.invoiceTitle}`,
      text:
        `A new comment "${c.invoiceTitle}" was posted on project "${c.projectTitle}" (related value ${c.amountText}).\n\n` +
        `View & reply before ${c.deadlineText} here:\n${c.portalLink}`,
    }),
  },
  "mention.created": {
    id: (c) => ({
      subject: `Kamu di-mention di ${c.projectTitle} — ${c.invoiceTitle}`,
      text:
        `Kamu di-mention ("${c.invoiceTitle}") di proyek "${c.projectTitle}" (nilai terkait ${c.amountText}).\n\n` +
        `Lihat sebelum ${c.deadlineText} di sini:\n${c.portalLink}`,
    }),
    en: (c) => ({
      subject: `You were mentioned on ${c.projectTitle} — ${c.invoiceTitle}`,
      text:
        `You were mentioned ("${c.invoiceTitle}") on project "${c.projectTitle}" (related value ${c.amountText}).\n\n` +
        `See it before ${c.deadlineText} here:\n${c.portalLink}`,
    }),
  },
  "dispute.resolved": {
    id: (c) => ({
      subject: `Sengketa selesai: "${c.invoiceTitle}" (${c.amountText})`,
      text:
        `Sengketa "${c.invoiceTitle}" (proyek "${c.projectTitle}", nilai ${c.amountText}) sudah selesai.\n\n` +
        `Lihat hasilnya di sini:\n${c.portalLink}\n\n(Arsip: tenggat sengketa ${c.deadlineText}.)`,
    }),
    en: (c) => ({
      subject: `Dispute resolved: "${c.invoiceTitle}" (${c.amountText})`,
      text:
        `The dispute "${c.invoiceTitle}" (project "${c.projectTitle}", value ${c.amountText}) has been resolved.\n\n` +
        `See the outcome here:\n${c.portalLink}\n\n(Record: dispute deadline was ${c.deadlineText}.)`,
    }),
  },
  "ticket.sla_breach": {
    id: (c) => ({
      subject: `[ESKALASI] Tiket ${c.invoiceTitle} lewat SLA — ${c.projectTitle}`,
      text:
        `Tiket "${c.invoiceTitle}" untuk proyek "${c.projectTitle}" (nilai terkait ${c.amountText}) lewat SLA (${c.deadlineText}). Mohon tindak lanjut.\n\n` +
        `Lihat tiket di sini:\n${c.portalLink}`,
    }),
    en: (c) => ({
      subject: `[ESCALATION] Ticket ${c.invoiceTitle} breached SLA — ${c.projectTitle}`,
      text:
        `Ticket "${c.invoiceTitle}" for project "${c.projectTitle}" (related value ${c.amountText}) breached SLA (${c.deadlineText}). Please follow up.\n\n` +
        `View the ticket here:\n${c.portalLink}`,
    }),
  },
  "payout.requested": {
    id: (c) => ({
      subject: `Penarikan dana ${c.amountText} — ${c.projectTitle}`,
      text:
        `Permintaan penarikan "${c.invoiceTitle}" sebesar ${c.amountText} (akun "${c.projectTitle}") masuk antrean.\n\n` +
        `Pantau statusnya di sini:\n${c.portalLink}\n\n(Estimasi proses s/d ${c.deadlineText}.)`,
    }),
    en: (c) => ({
      subject: `Payout request ${c.amountText} — ${c.projectTitle}`,
      text:
        `A payout request "${c.invoiceTitle}" of ${c.amountText} (account "${c.projectTitle}") is now queued.\n\n` +
        `Track its status here:\n${c.portalLink}\n\n(Estimated processing by ${c.deadlineText}.)`,
    }),
  },
  "payout.done": {
    id: (c) => ({
      subject: `Penarikan ${c.amountText} selesai — ${c.projectTitle}`,
      text:
        `Penarikan "${c.invoiceTitle}" sebesar ${c.amountText} (akun "${c.projectTitle}") sudah DONE.\n\n` +
        `Lihat buktinya di sini:\n${c.portalLink}\n\n(Arsip: diproses pada ${c.deadlineText}.)`,
    }),
    en: (c) => ({
      subject: `Payout ${c.amountText} completed — ${c.projectTitle}`,
      text:
        `Payout "${c.invoiceTitle}" of ${c.amountText} (account "${c.projectTitle}") is DONE.\n\n` +
        `See the receipt here:\n${c.portalLink}\n\n(Record: processed on ${c.deadlineText}.)`,
    }),
  },
  "lead.auto_reply": {
    id: (c) => ({
      subject: `Brief diterima — ${c.projectTitle} (${c.amountText})`,
      text:
        `Halo! Brief "${c.invoiceTitle}" untuk ${c.projectTitle} (budget ${c.amountText}) sudah kami terima.\n\n` +
        `Freelancer menghubungimu < 1×24 jam (s/d ${c.deadlineText}). Info: ${c.portalLink}`,
    }),
    en: (c) => ({
      subject: `Brief received — ${c.projectTitle} (${c.amountText})`,
      text:
        `Hi! Your brief "${c.invoiceTitle}" for ${c.projectTitle} (budget ${c.amountText}) has been received.\n\n` +
        `The freelancer will contact you within 24h (by ${c.deadlineText}). Details: ${c.portalLink}`,
    }),
  },
};

export function renderNotify(
  event: NotifyEvent,
  payload: NotifyPayload,
  opts: { baseUrl?: string } = {},
): TemplateStrings & { locale: NotifyLocale } {
  const locale: NotifyLocale = payload.locale === "en" ? "en" : "id";
  const ctx: TemplateCtx = {
    portalLink: portalLinkFor(payload.portalToken, opts.baseUrl),
    amountText: formatMoney(payload.amount, payload.currency, locale),
    deadlineText: formatDate(payload.deadline, locale),
    projectTitle: payload.projectTitle || "—",
    invoiceTitle: payload.invoiceTitle || payload.entityId,
  };
  return { ...TEMPLATES[event][locale](ctx), locale };
}

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  if (!apiKey) {
    console.log(`[notify:stub][email] to=${to} subject=${subject}\n${text}`);
    return true;
  }
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM_EMAIL ?? "Veritas <noreply@veritas.id>",
      to: [to],
      subject,
      text,
    }),
  });
  if (!res.ok) throw new Error(`resend:${res.status}`);
  return false;
}

async function sendWA(to: string, text: string): Promise<boolean> {
  const apiKey = process.env.WA_API_KEY ?? "";
  const provider = (process.env.WA_PROVIDER ?? "fonnte").toLowerCase();
  if (!apiKey) {
    console.log(`[notify:stub][wa:${provider}] to=${to}\n${text}`);
    return true;
  }
  if (provider === "wablas") {
    const base = process.env.WABLAS_BASE_URL ?? "https://console.wablas.com/api/send-message";
    const res = await fetchImpl(`${base}?token=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: to, message: text }),
    });
    if (!res.ok) throw new Error(`wablas:${res.status}`);
    return false;
  }
  if (provider !== "fonnte") throw new Error(`unknown WA_PROVIDER: ${provider}`);
  const res = await fetchImpl("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ target: to, message: text }).toString(),
  });
  if (!res.ok) throw new Error(`fonnte:${res.status}`);
  return false;
}

// ---------------------------------------------------------------------------
// Reminder bucket -> template mapping
// ---------------------------------------------------------------------------

/** Reminder H-3/H+0 pakai invoice.sent; H+1 overdue pakai invoice.overdue. */
export function reminderTemplateFor(bucket: "H-3" | "H+0" | "H+1"): NotifyEvent {
  return bucket === "H+1" ? "invoice.overdue" : "invoice.sent";
}

// ---------------------------------------------------------------------------
// Public interface: send(to, template, payload)
// ---------------------------------------------------------------------------

/**
 * Kirim notifikasi sekali per idempotency key. Alamat berisi "@" = email,
 * selain itu = nomor WA. Gagal transport = tidak dicatat terkirim (boleh retry).
 * L2 DB (NotifyLog) dicek sebelum kirim dan ditulis sesudah kirim; keduanya
 * fail-open (DB down = andalkan L1) agar notif gagal tidak merusak alur utama.
 */
export async function send(
  to: string,
  template: NotifyEvent,
  payload: NotifyPayload,
): Promise<NotifyResult> {
  const key = idempotencyKeyFor(template, payload.entityId, payload.dedupeSuffix ?? undefined);
  const channel: NotifyChannel = to.includes("@") ? "email" : "wa";
  const seen = sentKeys.get(key);
  if (seen) {
    return { ok: true, channel, idempotencyKey: key, replayed: true, stubbed: seen.stubbed };
  }
  if (await isNotifyLogged(key)) {
    sentKeys.set(key, { stubbed: true });
    return { ok: true, channel, idempotencyKey: key, replayed: true, stubbed: true };
  }
  const { subject, text } = renderNotify(template, payload);
  try {
    const stubbed = channel === "email" ? await sendEmail(to, subject, text) : await sendWA(to, text);
    sentKeys.set(key, { stubbed });
    stats.sent += 1;
    await recordNotifyLog(key, template);
    return { ok: true, channel, idempotencyKey: key, replayed: false, stubbed };
  } catch (err) {
    return {
      ok: false,
      channel,
      idempotencyKey: key,
      replayed: false,
      stubbed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const notifyService = { send };
