/**
 * F3 cron auto-release: rilis escrow FUNDS_HELD ke RELEASED bila klien diam
 * > N hari (env AUTO_RELEASE_DAYS, default 14) dan tidak ada sengketa.
 *
 * Sengketa dicek 2 lapis: Escrow.status + EscrowEvent(action=dispute /
 * toStatus=DISPUTED) DAN tabel Dispute F2 (status OPEN/NEGOTIATING per escrow
 * — wave integrasi; fail-open bila tabel belum ada/pre-migrate).
 *
 * Idempotency lintas isolate via tabel NotifyLog (key stabil
 * `auto-release:${invoiceId}`): dicek sebelum rilis, ditulis sesudah rilis.
 *
 * Rilis memakai fungsi apply yang SUDAH ADA (escrowService.transition,
 * tanpa edit services/escrow-service.ts) sehingga retry aman (replay).
 */

import prisma from "@/lib/prisma";
import { escrowService } from "@/services/escrow-service";
import { cronUnauthorized, isCronAuthorized } from "@/lib/cron-auth";
import { autoReleaseDays } from "@/lib/freelancer-settings";
import {
  isNotifyLogged,
  recordNotifyLog,
} from "@/services/vendor/notify/notify-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

export interface AutoReleaseEscrow {
  invoiceId: string;
  status: string;
  updatedAt: Date | string;
}

export interface AutoReleaseEvent {
  action?: string;
  toStatus?: string;
  createdAt: Date | string;
}

export function isDisputeEvent(e: AutoReleaseEvent): boolean {
  return e.action === "dispute" || e.toStatus === "DISPUTED";
}

export function autoReleaseKey(invoiceId: string): string {
  return `auto-release:${invoiceId}`;
}

/** Murni (tanpa DB): layak auto-release? DISPUTED / aktif / sengketa baru / dispute OPEN = tidak. */
export function shouldAutoRelease(
  escrow: AutoReleaseEscrow,
  events: AutoReleaseEvent[],
  now: Date = new Date(),
  days = 14,
  opts: { hasOpenDispute?: boolean } = {},
): { ok: boolean; reason: string } {
  if (opts.hasOpenDispute) return { ok: false, reason: "open-dispute" };
  if (escrow.status === "DISPUTED") return { ok: false, reason: "disputed" };
  if (escrow.status !== "FUNDS_HELD") return { ok: false, reason: `status-${escrow.status}` };
  const cutoff = now.getTime() - days * DAY_MS;
  if (new Date(escrow.updatedAt).getTime() > cutoff) return { ok: false, reason: "active" };
  if (events.some((e) => isDisputeEvent(e) && new Date(e.createdAt).getTime() > cutoff)) {
    return { ok: false, reason: "recent-dispute" };
  }
  return { ok: true, reason: "silent" };
}

export interface AutoReleaseItem {
  invoiceId: string;
  key: string;
  status: "released" | "dry-run" | "error";
  replayed?: boolean;
  error?: string;
}

export async function collectAutoReleaseCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  now: Date = new Date(),
  days = 14,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  const rows = await db.escrow.findMany({
    where: { status: "FUNDS_HELD", updatedAt: { lte: cutoff } },
    select: {
      id: true,
      invoiceId: true,
      status: true,
      updatedAt: true,
      events: { select: { action: true, toStatus: true, createdAt: true } },
    },
  });
  // Lapis 2: dispute OPEN/NEGOTIATING per escrow (fail-open pre-migrate).
  let openDisputed = new Set<string>();
  try {
    const open: Array<{ escrowId: string }> =
      (await db.dispute?.findMany?.({
        where: { status: { in: ["OPEN", "NEGOTIATING"] } },
        select: { escrowId: true },
      })) ?? [];
    openDisputed = new Set(open.map((d) => d.escrowId));
  } catch {
    openDisputed = new Set();
  }
  return rows.filter(
    (r: AutoReleaseEscrow & { id?: string; events?: AutoReleaseEvent[] }) =>
      shouldAutoRelease(r, r.events ?? [], now, days, {
        hasOpenDispute: openDisputed.has(r.id ?? ""),
      }).ok,
  );
}

export async function runAutoRelease(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  releaser: (invoiceId: string, key: string) => Promise<{ replayed?: boolean }>,
  now: Date = new Date(),
  days = 14,
  opts: { dryRun?: boolean } = {},
): Promise<{ released: number; days: number; items: AutoReleaseItem[] }> {
  const candidates = await collectAutoReleaseCandidates(db, now, days);
  const items: AutoReleaseItem[] = [];
  for (const c of candidates) {
    const key = autoReleaseKey(c.invoiceId);
    if (opts.dryRun) {
      items.push({ invoiceId: c.invoiceId, key, status: "dry-run" });
      continue;
    }
    try {
      // Idempotency lintas isolate: sudah tercatat di NotifyLog = replay.
      if (await isNotifyLogged(key)) {
        items.push({ invoiceId: c.invoiceId, key, status: "released", replayed: true });
        continue;
      }
      const r = await releaser(c.invoiceId, key);
      await recordNotifyLog(key, "escrow.released");
      items.push({ invoiceId: c.invoiceId, key, status: "released", replayed: r?.replayed ?? false });
    } catch (err) {
      items.push({
        invoiceId: c.invoiceId,
        key,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { released: items.filter((i) => i.status === "released").length, days, items };
}

/** Default releaser: fungsi apply yang sudah ada — JANGAN duplikasi logikanya di sini. */
const defaultReleaser = (invoiceId: string, key: string) =>
  escrowService.transition("release", invoiceId, "SYSTEM", key);

export async function GET(req: Request): Promise<Response> {
  if (!isCronAuthorized(req)) return cronUnauthorized();
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const days = autoReleaseDays();
    const result = await runAutoRelease(prisma, defaultReleaser, new Date(), days, { dryRun });
    return Response.json({ success: true, dryRun, ...result });
  } catch (err) {
    console.error("cron/auto-release failed", { message: err instanceof Error ? err.message : String(err) });
    return Response.json({ success: false, errorKey: "errors.internal" }, { status: 500 });
  }
}
