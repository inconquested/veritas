import { notFound } from "next/navigation";
import ClientChargeDialog from "@/components/ui/invoice-charge-dialog";
import EscrowPanel from "@/components/ui/escrow-panel";
import { getInvoice } from "@/actions/invoices";
import { getEscrowState } from "@/actions/escrow";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarDays, CreditCard, DollarSign, Sparkles } from "lucide-react";
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
  project_id?: string;
  project?: { title?: string | null } | string | null;
  amount: string | number | bigint;
  currency: string;
  status: string;
  due_date?: string | Date | null;
  payment_method?: string | null;
  notes?: string | null;
  created_at?: string | Date | null;
};

const statusStyle: Record<string, string> = {
  PAID: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  SENT: "bg-blue-500/10 text-blue-600 border-blue-200",
  OVERDUE: "bg-red-500/10 text-red-600 border-red-200",
  DRAFT: "bg-muted text-muted-foreground border-border",
  REFUNDED: "bg-purple-500/10 text-purple-600 border-purple-200",
};

function formatMoney(amount: string | number | bigint, currency: string) {
  const numeric = typeof amount === "bigint" ? Number(amount) : Number(amount);
  const safeAmount = Number.isFinite(numeric) ? numeric : 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    safeAmount,
  );
}

function formatDate(
  value: string | Date | null | undefined,
  emptyLabel: string,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return emptyLabel;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return date.toLocaleDateString(
    "en-US",
    options ?? { month: "long", day: "numeric", year: "numeric" },
  );
}

function getProjectLabel(project: Invoice["project"], fallback: string) {
  if (!project) return fallback;
  if (typeof project === "string") return project;
  return project.title ?? fallback;
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("client");
  const { id } = await params;
  const result = await getInvoice(id);

  if (!result.success) {
    notFound();
  }

  const invoice = result.invoice as Invoice;
  const amountLabel = formatMoney(invoice.amount, invoice.currency);
  const payable = invoice.status !== "PAID" && invoice.status !== "REFUNDED";

  const escrowResult = await getEscrowState(id);
  const escrowState = escrowResult.success
    ? ((escrowResult.escrow as { state?: EscrowStateValue } | null)?.state ?? null)
    : null;

  return (
    <div className="max-w-3xl space-y-6 p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {getProjectLabel(invoice.project, t("invoices.projectBilling"))}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{invoice.title}</h1>
        </div>
        <Badge
          variant="outline"
          className={`px-3 py-1 text-sm ${statusStyle[invoice.status] ?? "bg-muted text-muted-foreground border-border"}`}
        >
          {t(`invoiceStatus.${invoice.status}`)}
        </Badge>
      </div>

      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{t("invoiceDetail.title")}</CardTitle>
        </CardHeader>
        <CardContent className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-full flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t("invoiceDetail.amountDue")}</p>
              <p className="text-3xl font-bold tracking-tight">{amountLabel}</p>
              <p className="text-xs text-muted-foreground">
                {invoice.currency}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("invoiceDetail.dueDate")}
            </p>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {formatDate(invoice.due_date, t("invoiceDetail.notAvailable"))}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("invoiceDetail.paymentMethod")}
            </p>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {invoice.payment_method ?? t("invoiceDetail.hostedCheckout")}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("invoiceDetail.issuedOn")}
            </p>
            <p className="text-sm font-medium">
              {formatDate(invoice.created_at, t("invoiceDetail.notAvailable"))}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("invoiceDetail.project")}
            </p>
            <p className="text-sm font-medium">
              {getProjectLabel(invoice.project, t("invoices.projectBilling"))}
            </p>
          </div>
        </CardContent>
      </Card>

      {invoice.notes ? (
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("invoiceDetail.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {invoice.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <EscrowPanel invoiceId={id} role="CLIENT" state={escrowState} />

      {payable ? (
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("invoiceDetail.launchPayment")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("invoiceDetail.paymentDesc")}
              </p>
            </div>
            <ClientChargeDialog
              invoiceId={id}
              amount={amountLabel}
              currency={invoice.currency}
              method={invoice.payment_method ?? undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertTitle>{t("invoiceDetail.settledTitle")}</AlertTitle>
          <AlertDescription>
            {t("invoiceDetail.settledDesc", {
              status: invoice.status.toLowerCase(),
            })}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
