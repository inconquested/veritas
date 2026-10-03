import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EscrowTimeline from "@/components/escrow-timeline";
import ProjectEvidence from "@/components/project-evidence";
import InvoicePdfButton from "@/components/invoice-pdf-button";
import { getInvoicePdfHtml } from "@/actions/invoice-pdf";
import { portalRateLimit } from "@/lib/portal-rate-limit";
import { shareService } from "@/services/share-service";
import PortalInvoiceActions from "./portal-actions";

export const dynamic = "force-dynamic";

function money(amount: bigint | number | string, currency: string) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `${currency} ${String(amount)}`;
  }
}

function date(value: Date | string | null | undefined) {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

export default async function PublicProjectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const limit = portalRateLimit(`${ip}:${token}`);
  if (!limit.ok) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="text-lg font-bold">Terlalu banyak permintaan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Coba lagi dalam {limit.retryAfterSec} detik.
        </p>
      </div>
    );
  }

  let portal;
  try {
    portal = await shareService.getProjectByToken(token);
  } catch {
    // Expired, revoked, or unknown token: identical 404, no signal which.
    notFound();
  }

  const { project } = portal;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-2">
        <Badge variant="outline">{project.status}</Badge>
        <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
        {project.description ? (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Milestone</CardTitle>
        </CardHeader>
        <CardContent>
          {project.milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada milestone.</p>
          ) : (
            <ol className="space-y-3">
              {project.milestones.map((m) => (
                <li key={m.id} className="text-sm">
                  <p className="font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {date(m.due_date)}
                    {m.description ? ` · ${m.description}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Handsout (hasil kerja)</CardTitle>
        </CardHeader>
        <CardContent>
          {project.handsouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada hasil diserahkan.</p>
          ) : (
            <ol className="space-y-3">
              {project.handsouts.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="font-medium">{h.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {date(h.createdAt)}
                    {h.description ? ` · ${h.description}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <ProjectEvidence projectId={project.id} />

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Tagihan & Escrow</h2>
        {project.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada tagihan.</p>
        ) : (
          project.invoices.map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{invoice.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {money(invoice.amount, invoice.currency)} · jatuh tempo{" "}
                      {date(invoice.due_date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {invoice.status}
                    </Badge>
                    {invoice.escrow ? (
                      <Badge variant="outline" className="text-xs">
                        {invoice.escrow.status}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <PortalInvoiceActions
                  token={token}
                  invoiceId={invoice.id}
                  invoiceStatus={invoice.status}
                  escrowStatus={invoice.escrow?.status ?? null}
                  paymentMethod={invoice.payment_method}
                />
                <div className="flex flex-wrap gap-2">
                  <InvoicePdfButton
                    fetchHtml={getInvoicePdfHtml.bind(null, invoice.id, {
                      token,
                      kind: "invoice",
                    })}
                  />
                  <InvoicePdfButton
                    label="Unduh / Cetak kwitansi"
                    fetchHtml={getInvoicePdfHtml.bind(null, invoice.id, {
                      token,
                      kind: "kwitansi",
                    })}
                  />
                </div>
                {invoice.escrow && invoice.escrow.events.length > 0 ? (
                  <div className="border-t border-border/60 pt-3">
                    <EscrowTimeline events={invoice.escrow.events} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
