import { Card, CardContent } from "@/components/ui/card";
import {
  checkSlaBreach,
  ticketEscalationLink,
  ticketService,
  type TicketLike,
} from "@/services/ticket-service";
import { buildSlaReport } from "@/lib/sla-report";

type Row = TicketLike & {
  project_id?: string;
  severity?: string;
  createdAt?: Date | string | null;
};

async function load() {
  try {
    return (await ticketService.listOpen()) as Row[];
  } catch {
    return [] as Row[];
  }
}

export default async function StudioTicketsPage() {
  const now = new Date();
  const rows = await load();
  const breachedIds = new Set(checkSlaBreach(rows, now).map((t) => String(t.id)));
  const report = buildSlaReport(rows, { now });

  return (
    <div className="flex min-h-full flex-col gap-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tiket Support</h1>
        <p className="text-sm text-muted-foreground">
          SLA: KRITIS 4 jam · TINGGI 24 jam · NORMAL 72 jam. Bulan {report.month}:
          {" "}{report.total} tiket, {report.breached} breach
          {report.breachRate !== null && ` (${Math.round(report.breachRate * 100)}%)`}.
        </p>
      </div>
      {rows.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-5 text-sm text-muted-foreground">
            Tidak ada tiket open.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((t) => {
            const breached = breachedIds.has(String(t.id));
            return (
              <Card key={String(t.id)} className="shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.severity ?? "NORMAL"}</span>
                    <span className="text-xs text-muted-foreground">{t.status}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Project {t.project_id ?? "-"} · SLA{" "}
                    {t.slaDue ? new Date(t.slaDue).toLocaleString("id-ID") : "-"}
                  </div>
                  {breached && (
                    <a
                      className="mt-3 inline-block text-sm underline"
                      href={ticketEscalationLink(
                        { id: String(t.id), severity: t.severity, project_id: t.project_id },
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Eskalasi via WA
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {/* Wave integrasi: kirim otomatis via ticketService.notifySlaBreach (dipanggil dari cron/aksi dengan alamat WA studio); link manual ini fallback. */}
    </div>
  );
}
