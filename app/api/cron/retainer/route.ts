/**
 * F6 cron retainer (wave integrasi): generate invoice bulanan otomatis untuk
 * retainer aktif yang `nextRunAt <= now`. Idempoten per bulan via
 * `RetainerService.runRetainerCycle` (cek invoice RETAINER di bulan berjalan).
 *
 * Guard: Authorization Bearer CRON_SECRET. `?dryRun=1` = daftar yang JATUH
 * TEMPO tanpa create (tanpa tulis DB).
 */

import prisma from "@/lib/prisma";
import { retainerService } from "@/services/retainer-service";
import { cronUnauthorized, isCronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  if (!isCronAuthorized(req)) return cronUnauthorized();
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const now = new Date();
    if (dryRun) {
      const due = await (prisma as any).retainer.findMany({
        where: { active: true, nextRunAt: { lte: now } },
        select: { id: true, project_id: true, nextRunAt: true },
      });
      return Response.json({ success: true, dryRun, due: due.length, items: due });
    }
    const items = await retainerService.runRetainerCycle({ now });
    return Response.json({
      success: true,
      dryRun,
      generated: items.filter((i) => i.invoiceId).length,
      items,
    });
  } catch (err) {
    console.error("cron/retainer failed", { message: err instanceof Error ? err.message : String(err) });
    return Response.json({ success: false, errorKey: "errors.internal" }, { status: 500 });
  }
}
