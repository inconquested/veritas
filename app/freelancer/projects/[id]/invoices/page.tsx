import { listInvoices } from "@/actions/invoices";
import { getEscrowState } from "@/actions/escrow";
import EscrowPanel from "@/components/ui/escrow-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";

type EscrowStateValue =
  | "INITIALIZED"
  | "FUNDS_HELD"
  | "DISPUTED"
  | "RELEASED"
  | "REFUNDED";

type Invoice = {
  id: string;
  title: string;
  amount?: string | number | null;
  currency?: string | null;
  status?: string | null;
  due_date?: string | Date | null;
  payment_method?: string | null;
};

const statusStyle: Record<string, string> = {
  PAID: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  SENT: "bg-blue-500/10 text-blue-600 border-blue-200",
  OVERDUE: "bg-red-500/10 text-red-600 border-red-200",
  DRAFT: "bg-muted text-muted-foreground border-border",
  REFUNDED: "bg-violet-500/10 text-violet-600 border-violet-200",
};

function money(value: Invoice["amount"], currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function date(value: string | Date | null | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? fallback
    : parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

export default async function ProjectInvoicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("freelancer");
  const result = await listInvoices(id);
  const invoices = result.success
    ? ((result.invoices as Invoice[] | undefined) ?? [])
    : [];

  // Fetch each invoice's escrow state in parallel so the freelancer can act
  // (dispute/refund) inline. Small lists; a bulk endpoint isn't worth it yet.
  const escrowStates = new Map<string, EscrowStateValue | null>(
    await Promise.all(
      invoices.map(async (invoice): Promise<[string, EscrowStateValue | null]> => {
        const escrow = await getEscrowState(invoice.id);
        const state = escrow.success
          ? ((escrow.escrow as { state?: EscrowStateValue } | null)?.state ?? null)
          : null;
        return [invoice.id, state];
      }),
    ),
  );

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          {t("invoices.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("invoices.count", { count: invoices.length })}
        </p>
      </div>

      {!result.success ? (
        <Card
          className="border-destructive/30 bg-destructive/5 shadow-none"
          role="alert"
        >
          <CardContent className="p-4 text-sm">
            {t("invoices.load-error")}
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card className="border border-dashed border-border/70 bg-muted/20 shadow-none">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <ReceiptText className="h-5 w-5" aria-hidden="true" />
            {t("invoices.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="space-y-2">
              <Card className="border border-border/60 shadow-sm">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {invoice.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("invoices.due-label")}{" "}
                      {date(invoice.due_date, t("invoices.no-due-date"))} ·{" "}
                      {(invoice.payment_method ?? "HOSTED_PAYMENT").replaceAll(
                        "_",
                        " ",
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-base font-bold">
                      {money(invoice.amount, invoice.currency ?? "USD")}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${statusStyle[invoice.status ?? ""] ?? statusStyle.DRAFT}`}
                    >
                      {t(`status.${invoice.status ?? "DRAFT"}`)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              <EscrowPanel
                invoiceId={invoice.id}
                role="FREELANCER"
                state={escrowStates.get(invoice.id) ?? null}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
