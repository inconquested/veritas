import { listInvoices } from "@/actions/invoices";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

type Invoice = {
  amount?: string | number | null;
  currency?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
  due_date?: string | Date | null;
};

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function amount(value: Invoice["amount"]) {
  return Number(value ?? 0);
}

function monthIndex(value: string | Date | null | undefined) {
  const date =
    value instanceof Date ? value : value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().getMonth() : date.getMonth();
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function RevenueTrackerSlot() {
  const t = await getTranslations("freelancer");
  const result = await listInvoices();
  const invoices = result.success
    ? ((result.invoices as Invoice[] | undefined) ?? [])
    : [];
  const currency =
    invoices.find((invoice) => invoice.currency)?.currency ?? "USD";
  const data = Array.from({ length: 12 }, () => 0);

  invoices
    .filter((invoice) => invoice.status === "PAID")
    .forEach((invoice) => {
      data[monthIndex(invoice.createdAt ?? invoice.due_date)] += amount(
        invoice.amount,
      );
    });

  const max = Math.max(...data, 0);
  const total = data.reduce((sum, value) => sum + value, 0);
  const best = Math.max(...data, 0);
  const activeMonths = data.filter(Boolean).length;
  const currentYear = new Date().getFullYear();

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold">
            {t("revenue.title")}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("revenue.subtitle")}
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {currentYear}
        </Badge>
      </CardHeader>
      <CardContent>
        {!result.success ? (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
            role="alert"
          >
            {t("revenue.loadError")}
          </div>
        ) : total === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            {t("revenue.empty")}
          </div>
        ) : (
          <>
            <div
              className="flex h-36 w-full items-end gap-1.5"
              role="img"
              aria-label={t("revenue.chartLabel", { year: currentYear, amount: money(total, currency) })}
            >
              {data.map((value, index) => {
                const height = Math.max(4, Math.round((value / max) * 100));
                const isCurrentMonth = index === new Date().getMonth();
                return (
                  <div
                    key={months[index]}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <div
                      className="flex w-full items-end"
                      style={{ height: "112px" }}
                    >
                      <div
                        className={`w-full rounded-t-sm transition-colors ${
                          isCurrentMonth
                            ? "bg-primary"
                            : "bg-primary/30 hover:bg-primary/50"
                        }`}
                        style={{ height: `${value ? height : 0}%` }}
                        title={t("revenue.barTooltip", { month: months[index], amount: money(value, currency) })}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-medium ${isCurrentMonth ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {months[index]}
                    </span>
                  </div>
                );
              })}
            </div>

            <dl className="mt-4 grid gap-4 border-t border-border/50 pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t("revenue.ytd")}</dt>
                <dd className="text-lg font-bold">{money(total, currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("revenue.bestMonth")}</dt>
                <dd className="text-lg font-bold">{money(best, currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("revenue.monthlyAvg")}</dt>
                <dd className="text-lg font-bold">
                  {money(activeMonths ? total / activeMonths : 0, currency)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}
