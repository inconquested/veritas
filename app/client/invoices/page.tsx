import Link from "next/link";
import { listInvoices } from "@/actions/invoices";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CalendarDays, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";

type Invoice = {
  id: string;
  title: string;
  amount: string | number | bigint;
  currency: string;
  status: string;
  due_date?: string | Date | null;
  payment_method?: string | null;
  project?: { title?: string | null } | string | null;
};

const statusStyle: Record<string, string> = {
  PAID: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  SENT: "bg-blue-500/10 text-blue-600 border-blue-200",
  OVERDUE: "bg-red-500/10 text-red-600 border-red-200",
  DRAFT: "bg-muted text-muted-foreground border-border",
  REFUNDED: "bg-purple-500/10 text-purple-600 border-purple-200",
};

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

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
) {
  if (!value) return emptyLabel;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getProjectLabel(project: Invoice["project"], fallback: string) {
  if (!project) return fallback;
  if (typeof project === "string") return project;
  return project.title ?? fallback;
}

export default async function ClientInvoicesPage() {
  const t = await getTranslations("client");
  const result = await listInvoices();
  const invoices = result.success ? toArray<Invoice>(result.invoices) : [];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("invoices.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("invoices.subtitle", { count: invoices.length })}
        </p>
      </div>

      {!result.success || invoices.length === 0 ? (
        <Empty className="border border-dashed border-border/70 bg-muted/20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptText className="h-4 w-4" />
            </EmptyMedia>
            <EmptyTitle>{t("invoices.emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("invoices.emptyDesc")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Link key={invoice.id} href={`/client/invoices/${invoice.id}`}>
              <Card className="group cursor-pointer border border-border/60 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
                      {invoice.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {getProjectLabel(invoice.project, t("invoices.projectBilling"))} ·{" "}
                      {invoice.payment_method ?? t("invoices.hostedPayment")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(invoice.due_date, t("invoices.noDueDate"))}
                    </div>
                    <span className="text-base font-bold">
                      {formatMoney(invoice.amount, invoice.currency)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${statusStyle[invoice.status] ?? "bg-muted text-muted-foreground border-border"}`}
                    >
                      {t(`invoiceStatus.${invoice.status}`)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
