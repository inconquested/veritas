import { listInvoices } from "@/actions/invoices";
import { getInvoicePdfHtml } from "@/actions/invoice-pdf";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import InvoicePdfButton from "@/components/invoice-pdf-button";
import PayoutPanel from "@/components/payout-panel";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

type Invoice = {
  id: string;
  title: string;
  clientName?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  status?: string | null;
  due_date?: string | Date | null;
  createdAt?: string | Date | null;
  project?: { title?: string | null };
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

function date(value: Invoice["due_date"], noDueDate: string) {
  if (!value) return noDueDate;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? noDueDate
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function BillingInvoicesSlot() {
  const t = await getTranslations("freelancer");
  const result = await listInvoices();

  return (
    <div className="space-y-4">
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold">
            {t("billing.recentInvoices")}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("billing.subtitle")}
          </p>
        </div>
        <Link
          href="/freelancer/projects"
          className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("billing.viewAll")}
        </Link>
      </CardHeader>
      <CardContent>
        {!result.success ? (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
            role="alert"
          >
            {t("billing.loadError")}
          </div>
        ) : ((result.invoices as Invoice[] | undefined) ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            {t("billing.empty")}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {((result.invoices as Invoice[] | undefined) ?? [])
              .slice(0, 4)
              .map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {invoice.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.clientName ||
                        invoice.project?.title ||
                        t("billing.projectFallback")}{" "}
                      · {date(invoice.due_date ?? invoice.createdAt, t("billing.noDueDate"))}
                    </p>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold">
                      {money(invoice.amount, invoice.currency ?? "USD")}
                    </span>
                    <Badge
                      variant="outline"
                      className={`px-1.5 py-0.5 text-[10px] ${statusStyle[invoice.status ?? ""] ?? statusStyle.DRAFT}`}
                    >
                      {invoice.status ?? "DRAFT"}
                    </Badge>
                    <InvoicePdfButton
                      fetchHtml={getInvoicePdfHtml.bind(null, invoice.id)}
                    />
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
    <PayoutPanel />
    </div>
  );
}
