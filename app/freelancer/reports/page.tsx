import { currentUser } from "@clerk/nextjs/server";
import { Card, CardContent } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { CsvExportButton, RevenueChart } from "@/components/revenue-chart";
import { DeadlineCalendar, type DeadlineItem } from "@/components/deadline-calendar";
import type { CsvCell } from "@/lib/export-csv";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}

export default async function ReportsPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-5 text-sm">Masuk untuk melihat laporan.</CardContent></Card>
      </div>
    );
  }
  const user = await prisma.user.findUnique({
    where: { clerkUserId: clerkUser.id },
    select: { id: true },
  });
  const profile = user
    ? await prisma.freelancerProfile.findFirst({
        where: { userId: user.id },
        select: { id: true },
      })
    : null;
  if (!user || !profile) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-5 text-sm">Profil freelancer tidak ditemukan.</CardContent></Card>
      </div>
    );
  }

  const [invoices, projects] = await Promise.all([
    prisma.invoice.findMany({
      where: { freelancerId: profile.id },
      select: {
        id: true, project_id: true, title: true, clientName: true, amount: true,
        currency: true, status: true, due_date: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.project.findMany({
      where: { freelancerId: user.id },
      select: {
        id: true,
        title: true,
        milestones: { select: { id: true, title: true, due_date: true } },
      },
      take: 200,
    }),
  ]);

  // Revenue 6 bulan terakhir (PAID by createdAt) + outstanding per bulan.
  const months: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  const monthly = months.map((key) => {
    let revenue = 0;
    let outstanding = 0;
    for (const inv of invoices) {
      if (monthKey(new Date(inv.createdAt)) !== key) continue;
      const amt = Number(inv.amount);
      if (inv.status === "PAID") revenue += amt;
      else if (inv.status !== "CANCELLED" && inv.status !== "REFUNDED") outstanding += amt;
    }
    return { month: monthLabel(key), revenue, outstanding };
  });

  const perClientMap = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status !== "PAID") continue;
    perClientMap.set(inv.clientName, (perClientMap.get(inv.clientName) ?? 0) + Number(inv.amount));
  }
  const perClient = [...perClientMap.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const titleOf = new Map(projects.map((p) => [p.id, p.title]));
  const items: DeadlineItem[] = [];
  for (const p of projects) {
    for (const m of p.milestones) {
      const due = new Date(m.due_date);
      if (due >= weekStart && due < weekEnd) {
        items.push({ id: m.id, title: m.title, project: p.title, kind: "milestone", due: due.toISOString() });
      }
    }
  }
  for (const inv of invoices) {
    const due = new Date(inv.due_date);
    if (inv.status !== "PAID" && due >= weekStart && due < weekEnd) {
      items.push({
        id: inv.id, title: inv.title,
        project: titleOf.get(inv.project_id) ?? inv.clientName,
        kind: "invoice", due: due.toISOString(),
      });
    }
  }

  const csvHeaders = ["title", "client", "amount", "currency", "status", "due"];
  const csvRows: CsvCell[][] = invoices.map((inv) => [
    inv.title, inv.clientName, String(inv.amount), inv.currency, inv.status,
    new Date(inv.due_date).toISOString().slice(0, 10),
  ]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan</h1>
          <p className="text-sm text-muted-foreground">Revenue, outstanding, deadline minggu ini.</p>
        </div>
        <CsvExportButton filename="laporan-invoice" headers={csvHeaders} rows={csvRows} />
      </div>
      <RevenueChart monthly={monthly} perClient={perClient} />
      <DeadlineCalendar items={items} weekStart={weekStart.toISOString()} />
      {/* TODO(F6): pasang link permanen di layout navInsights sudah ada (1 baris "Laporan"). */}
    </div>
  );
}
