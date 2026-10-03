/**
 * F3 cron reminders: H-3 + H+0 (template invoice.sent), H+1 overdue
 * (template invoice.overdue). Baca Invoice via Prisma langsung (model yang
 * sudah ada). Guard: Authorization Bearer CRON_SECRET. `?dryRun=1` untuk
 * cek tanpa kirim (dipakai DoD "tidak dobel-kirim").
 *
 * Wave integrasi: jadwal di vercel.json + idempotency via NotifyLog DB
 * (di send()) + User.phone dibaca bila ada (kolom baru, nullable).
 */

import prisma from "@/lib/prisma";
import { cronUnauthorized, isCronAuthorized } from "@/lib/cron-auth";
import { reminderChannel } from "@/lib/freelancer-settings";
import {
  send as sendNotify,
  reminderTemplateFor,
  type NotifyEvent,
} from "@/services/vendor/notify/notify-service";
export { reminderTemplateFor };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

export type ReminderBucket = "H-3" | "H+0" | "H+1";

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Bucket reminder dari selisih hari kalender (due - now). Overdue (>H+0) = H+1. */
export function classifyReminder(dueDate: Date | string, now: Date = new Date()): ReminderBucket | null {
  const diff = Math.round(
    (startOfDay(new Date(dueDate)).getTime() - startOfDay(now).getTime()) / DAY_MS,
  );
  if (diff === 3) return "H-3";
  if (diff === 0) return "H+0";
  if (diff < 0) return "H+1";
  return null;
}

export interface ReminderItem {
  invoiceId: string;
  bucket: ReminderBucket;
  template: NotifyEvent;
  to?: string;
  key?: string;
  status: "sent" | "dry-run" | "skipped" | "error";
  reason?: string;
}

export async function runReminders(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  sender: typeof sendNotify = sendNotify,
  now: Date = new Date(),
  opts: { dryRun?: boolean } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ sent: number; skipped: number; items: ReminderItem[] }> {
  const channel = reminderChannel();
  // v1: saring di JS (SENT/OVERDUE biasanya sedikit per freelancer).
  // TODO(integrasi): prefilter due_date di DB bila volume besar.
  const invoices = await db.invoice.findMany({
    where: { status: { in: ["SENT", "OVERDUE"] } },
    select: {
      id: true,
      title: true,
      amount: true,
      currency: true,
      status: true,
      due_date: true,
      project_id: true,
      project: {
        select: {
          id: true,
          title: true,
          client: { select: { email: true, phone: true } },
        },
      },
    },
  });

  const items: ReminderItem[] = [];
  let sent = 0;
  let skipped = 0;

  for (const inv of invoices) {
    const bucket = classifyReminder(inv.due_date, now);
    if (!bucket) {
      skipped += 1;
      items.push({ invoiceId: inv.id, bucket: "H+0", template: "invoice.sent", status: "skipped", reason: "no-bucket" });
      continue;
    }
    const template = reminderTemplateFor(bucket);
    const key = `${template}:${inv.id}:${bucket}`;

    const tokenRow = await db.projectShareToken
      .findFirst({
        where: { project_id: inv.project_id },
        orderBy: { createdAt: "desc" },
        select: { token: true },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch(() => null as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (inv.project as any)?.client as { email?: string | null; phone?: string | null } | null | undefined;
    const email = client?.email ?? null;
    const phone = client?.phone ?? null;

    const recipients: string[] = [];
    if (channel !== "wa" && email) recipients.push(email);
    if (channel !== "email" && phone) recipients.push(phone);
    if (recipients.length === 0) {
      skipped += 1;
      items.push({ invoiceId: inv.id, bucket, template, key, status: "skipped", reason: channel === "email" ? "no-email" : "no-recipient" });
      continue;
    }

    if (opts.dryRun) {
      items.push({ invoiceId: inv.id, bucket, template, to: recipients.join(","), key, status: "dry-run" });
      continue;
    }

    try {
      for (const to of recipients) {
        await sender(to, template, {
          entityId: inv.id,
          dedupeSuffix: bucket,
          portalToken: tokenRow?.token ?? null,
          amount: inv.amount,
          currency: inv.currency,
          deadline: inv.due_date,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          projectTitle: (inv.project as any)?.title ?? null,
          invoiceTitle: inv.title ?? null,
        });
      }
      sent += 1;
      items.push({ invoiceId: inv.id, bucket, template, to: recipients.join(","), key, status: "sent" });
    } catch (err) {
      skipped += 1;
      items.push({
        invoiceId: inv.id,
        bucket,
        template,
        key,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { sent, skipped, items };
}

export async function GET(req: Request): Promise<Response> {
  if (!isCronAuthorized(req)) return cronUnauthorized();
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const result = await runReminders(prisma, sendNotify, new Date(), { dryRun });
    return Response.json({ success: true, dryRun, channel: reminderChannel(), ...result });
  } catch (err) {
    console.error("cron/reminders failed", { message: err instanceof Error ? err.message : String(err) });
    return Response.json({ success: false, errorKey: "errors.internal" }, { status: 500 });
  }
}
