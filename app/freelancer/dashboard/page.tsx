import { listInvoices } from "@/actions/invoices";
import { listProjects } from "@/actions/projects";
import { Card, CardContent } from "@/components/ui/card";
import { getErrorStateMessage } from "@/lib/utils";
import { AlertCircle, DollarSign, FileText, FolderOpen, TrendingUp } from "lucide-react";

type Project = { status?: string | null };
type Invoice = {
  amount?: string | number | null;
  status?: string | null;
  currency?: string | null;
};

function amount(value: Invoice["amount"]) {
  return Number(value ?? 0);
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function DashboardPage() {
  const [projectResult, invoiceResult] = await Promise.all([
    listProjects({ limit: 100, page: 1, sort: "desc", sortBy: "updated_at" }),
    listInvoices(),
  ]);

  if (!projectResult.success || !invoiceResult.success) {
    const errorMessage = getErrorStateMessage(
      (projectResult.success ? invoiceResult as any : projectResult as any).errorKey,
    );

    return (
      <Card className="border-destructive/30 bg-destructive/5 shadow-none" role="alert">
        <CardContent className="flex items-start gap-3 p-5">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <h1 className="text-lg font-semibold">Dashboard unavailable</h1>
            <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const projects = (projectResult.projects as Project[] | undefined) ?? [];
  const invoices = (invoiceResult.invoices as Invoice[] | undefined) ?? [];
  const currency =
    invoices.find((invoice) => invoice.currency)?.currency ?? "USD";
  const paid = invoices.filter((invoice) => invoice.status === "PAID");
  const pending = invoices.filter(
    (invoice) => invoice.status && invoice.status !== "PAID",
  );
  const activeProjects = projects.filter(
    (project) => !["COMPLETED", "CANCELLED"].includes(project.status ?? ""),
  ).length;
  const totalRevenue = paid.reduce(
    (sum, invoice) => sum + amount(invoice.amount),
    0,
  );
  const avgProjectValue = activeProjects ? totalRevenue / activeProjects : 0;

  const kpis = [
    {
      label: "Total revenue",
      value: money(totalRevenue, currency),
      change: paid.length
        ? `${paid.length} paid invoice${paid.length === 1 ? "" : "s"}`
        : "No paid invoices yet",
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Active projects",
      value: String(activeProjects),
      change: projects.length
        ? `${projects.length} total project${projects.length === 1 ? "" : "s"}`
        : "Create your first project",
      icon: FolderOpen,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    },
    {
      label: "Pending invoices",
      value: String(pending.length),
      change: pending.length
        ? `${money(
            pending.reduce((sum, invoice) => sum + amount(invoice.amount), 0),
            currency,
          )} outstanding`
        : "Nothing outstanding",
      icon: FileText,
      color: "text-amber-600",
      bg: "bg-amber-500/10",
    },
    {
      label: "Avg. project value",
      value: money(avgProjectValue, currency),
      change: activeProjects
        ? "Based on active projects"
        : "Waiting for project data",
      icon: TrendingUp,
      color: "text-violet-600",
      bg: "bg-violet-500/10",
    },
  ];

  if (projects.length === 0 && invoices.length === 0) {
    return (
      <div className="space-y-4">
        <div className="mb-2">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your live project and billing snapshot.
          </p>
        </div>
        <Card className="border-dashed border-border/70 bg-muted/20 shadow-none">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">No workspace activity yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a project or send an invoice to populate this dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your live project and billing snapshot.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border border-border/60 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {kpi.label}
                  </p>
                  <p className="mt-1 truncate text-2xl font-bold tracking-tight">
                    {kpi.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {kpi.change}
                  </p>
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.bg}`}
                  aria-hidden="true"
                >
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
