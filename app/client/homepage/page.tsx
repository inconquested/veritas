import { listInvoices } from "@/actions/invoices";
import { listProjects } from "@/actions/projects";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorStateMessage } from "@/lib/utils";
import { AlertCircle, CalendarDays, FileText, FolderOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

type Project = {
  id: string;
  title: string;
  status?: string | null;
  updatedAt?: string | Date | null;
  milestones?: { due_date?: string | Date | null }[];
};

type Invoice = {
  id: string;
  title: string;
  amount?: string | number | null;
  currency?: string | null;
  status?: string | null;
  due_date?: string | Date | null;
};

const statusColors: Record<string, string> = {
  ONBOARDING: "bg-sky-500/10 text-sky-600 border-sky-200",
  RESEARCH: "bg-violet-500/10 text-violet-600 border-violet-200",
  MODELLING: "bg-amber-500/10 text-amber-600 border-amber-200",
  DEPLOYMENT: "bg-orange-500/10 text-orange-600 border-orange-200",
  MAINTENANCE: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  COMPLETED: "bg-green-500/10 text-green-600 border-green-200",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

const invoiceStatus: Record<string, string> = {
  PAID: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  SENT: "bg-blue-500/10 text-blue-600 border-blue-200",
  OVERDUE: "bg-red-500/10 text-red-600 border-red-200",
  DRAFT: "bg-muted text-muted-foreground border-border",
  REFUNDED: "bg-violet-500/10 text-violet-600 border-violet-200",
};

const progressByStatus: Record<string, number> = {
  ONBOARDING: 10,
  RESEARCH: 25,
  MODELLING: 55,
  DEPLOYMENT: 80,
  MAINTENANCE: 90,
  COMPLETED: 100,
  CANCELLED: 0,
};

function date(value: string | Date | null | undefined, emptyLabel: string) {
  if (!value) return emptyLabel;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? emptyLabel
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function money(value: Invoice["amount"], currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export default async function ClientHomepage() {
  const t = await getTranslations("client");
  const [projectResult, invoiceResult] = await Promise.all([
    listProjects({ limit: 4, page: 1, sort: "desc", sortBy: "updated_at" }),
    listInvoices(),
  ]);
  const projects = projectResult.success
    ? ((projectResult.projects as Project[] | undefined) ?? [])
    : [];
  const invoices = invoiceResult.success
    ? ((invoiceResult.invoices as Invoice[] | undefined) ?? [])
    : [];
  const latestHandsoutProject = projects.find(
    (project) => project.milestones?.length,
  );

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("homepage.welcome")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("homepage.summary")}
        </p>
      </div>

      {!projectResult.success || !invoiceResult.success ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none" role="alert">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p>{getErrorStateMessage((projectResult.success ? invoiceResult : projectResult).errorKey)}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border border-border/60 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <FolderOpen
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <CardTitle className="text-base">{t("homepage.activeProjects")}</CardTitle>
            </div>
            <Link
              href="/client/projects"
              className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("common.viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                {t("homepage.noProjects")}
              </div>
            ) : (
              projects.map((project) => {
                const progress = progressByStatus[project.status ?? ""] ?? 0;
                const due = project.milestones
                  ?.map((milestone) => milestone.due_date)
                  .filter(Boolean)
                  .at(-1);
                return (
                  <Link
                    key={project.id}
                    href={`/client/projects/${project.id}`}
                  >
                    <div className="group flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border/40 p-4 transition-all hover:border-primary/30 hover:bg-muted/30">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                          {project.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <div
                            className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                            aria-hidden="true"
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {progress}%
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {date(due ?? project.updatedAt, t("common.noDate"))}
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusColors[project.status ?? ""] ?? statusColors.CANCELLED}`}
                        >
                          {t(`projectStatus.${project.status ?? "ONBOARDING"}`)}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <FileText
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <CardTitle className="text-base">{t("invoices.title")}</CardTitle>
              </div>
              <Link
                href="/client/invoices"
                className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("common.viewAll")}
              </Link>
            </CardHeader>
            <CardContent className="divide-y divide-border/50">
              {invoices.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  {t("homepage.noInvoices")}
                </div>
              ) : (
                invoices.slice(0, 3).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">
                        {invoice.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {date(invoice.due_date, t("common.noDate"))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {money(invoice.amount, invoice.currency ?? "USD")}
                      </span>
                      <Badge
                        variant="outline"
                        className={`px-1.5 py-0 text-[10px] ${invoiceStatus[invoice.status ?? ""] ?? invoiceStatus.DRAFT}`}
                      >
                        {t(`invoiceStatus.${invoice.status ?? "DRAFT"}`)}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("homepage.latestDelivery")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10"
                aria-hidden="true"
              >
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">
                {latestHandsoutProject?.title ?? t("homepage.noDeliveries")}
              </p>
              <p className="text-xs text-muted-foreground">
                {latestHandsoutProject
                  ? t("homepage.activitySynced")
                  : t("homepage.deliverablesAppear")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
