import { currentUser } from "@clerk/nextjs/server";
import { Card, CardContent } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { CsvExportButton } from "@/components/revenue-chart";
import type { CsvCell } from "@/lib/export-csv";
import { addExpenseAction } from "@/actions/expenses";
import {
  JURNAL_HEADERS,
  MEKARI_HEADERS,
} from "@/lib/jurnal-export";
import { dueReminders } from "@/lib/tax-calendar";
import { monthlyPnL } from "@/lib/tax-report";
import { splitExpenseLabel } from "@/services/expense-service";

// TODO(nav): tambah 1 baris "Waktu & Bon" di navInsights layout freelancer
// (di-skip agar tak konflik eksekutor paralel — halaman ini mandiri).

type Db = {
  user: { findUnique(args: unknown): Promise<{ id: string } | null> };
  freelancerProfile: { findFirst(args: unknown): Promise<{ id: string } | null> };
  project: {
    findMany(args: unknown): Promise<{ id: string; title: string }[]>;
  };
  expense: {
    findMany(args: unknown): Promise<
      {
        id: string;
        freelancerId: string;
        label: string;
        amount: bigint;
        date: Date;
        receiptUrl: string | null;
        project_id: string | null;
      }[]
    >;
  };
  invoice: {
    findMany(args: unknown): Promise<
      { amount: bigint; status: string; createdAt: Date }[]
    >;
  };
};

function money(v: bigint | number): string {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `IDR ${String(v)}`;
  }
}

function day(d: Date | string): string {
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? "—" : t.toISOString().slice(0, 10);
}

export default async function FreelancerExpensesPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-5 text-sm">Masuk untuk melihat expense.</CardContent></Card>
      </div>
    );
  }
  const db = prisma as never as Db;
  const user = await db.user.findUnique({
    where: { clerkUserId: clerkUser.id },
    select: { id: true },
  });
  if (!user) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-5 text-sm">Akun tidak ditemukan.</CardContent></Card>
      </div>
    );
  }
  const profile = await db.freelancerProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  const key = profile?.id ?? user.id;

  const [projects, expenses, invoices] = await Promise.all([
    db.project.findMany({
      where: { freelancerId: user.id },
      select: { id: true, title: true },
      take: 200,
    }),
    db.expense.findMany({
      where: { freelancerId: key },
      orderBy: { date: "desc" },
      take: 200,
    }),
    db.invoice.findMany({
      where: { freelancerId: profile?.id ?? undefined },
      select: { amount: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }).catch(() => []),
  ]);

  const titleOf = new Map(projects.map((p) => [p.id, p.title]));
  const total = expenses.reduce<bigint>((s, e) => s + BigInt(e.amount), 0n);

  // P&L 6 bulan terakhir (PAID vs bon).
  const months: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const pnl = monthlyPnL(
    invoices.map((i) => ({ amount: i.amount, date: i.createdAt, status: i.status })),
    expenses.map((e) => ({ amount: e.amount, date: e.date })),
    months,
  );

  const { overdue, upcoming } = dueReminders(new Date(), 60);

  const csvHeaders = ["tanggal", "label", "kategori", "jumlah", "project", "bon"];
  const csvRows: CsvCell[][] = expenses.map((e) => {
    const { category, label } = splitExpenseLabel(e.label);
    return [
      day(e.date),
      label,
      category ?? "",
      String(e.amount),
      e.project_id ? (titleOf.get(e.project_id) ?? e.project_id) : "",
      e.receiptUrl ?? "",
    ];
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expense & Pajak</h1>
          <p className="text-sm text-muted-foreground">
            {expenses.length} bon · total {money(total)}. Foto bon wajib.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CsvExportButton filename="expense" headers={csvHeaders} rows={csvRows} />
          <CsvExportButton filename="jurnal-penjualan" headers={JURNAL_HEADERS} rows={csvRows} label="Jurnal CSV" />
          <CsvExportButton filename="mekari-penjualan" headers={MEKARI_HEADERS} rows={csvRows} label="Mekari CSV" />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">+ Tambah bon</h2>
          <form
            action={async (fd: FormData) => {
              "use server";
              await addExpenseAction(fd);
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <label className="grid gap-1 text-xs">
              Label
              <input
                name="label"
                required
                placeholder="Tol + parkir klien X"
                className="min-w-44 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Jumlah (IDR)
              <input
                name="amount"
                required
                inputMode="numeric"
                placeholder="75000"
                className="w-32 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Tanggal
              <input
                name="date"
                type="date"
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Kategori
              <select name="category" className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                <option value="">—</option>
                {["TRANSPORT", "MAKAN", "ALAT", "SUBSKRIPSI", "LAINNYA"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              Project
              <select name="project_id" className="min-w-36 rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              Foto bon (wajib)
              <input
                name="receipt"
                type="file"
                accept="image/*"
                required
                className="max-w-52 text-sm"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              Simpan
            </button>
          </form>
          <p className="text-xs text-muted-foreground">
            Foto diunggah via Cloudinary existing. Tanpa foto = ditolak.
            Total bon sebaiknya = jumlah rincian (validasi OCR manual).
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-2 text-sm font-semibold">P&L 6 bulan (PAID − bon)</h2>
            {pnl.map((m) => (
              <div key={m.month} className="flex justify-between gap-2 py-1 text-sm">
                <span className="font-mono">{m.month}</span>
                <span className={m.profit < 0n ? "text-red-600" : "text-emerald-600"}>
                  {money(m.profit)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-2 text-sm font-semibold">Pengingat pajak 2026</h2>
            {overdue.length === 0 && upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada jatuh tempo dekat.</p>
            ) : (
              <>
                {overdue.map((t) => (
                  <p key={t.key} className="py-0.5 text-sm text-red-600">
                    Lewat: {t.label} ({t.due})
                  </p>
                ))}
                {upcoming.map((t) => (
                  <p key={t.key} className="py-0.5 text-sm text-muted-foreground">
                    {t.label} — {t.due}
                  </p>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-2 text-sm font-semibold">Daftar bon</h2>
          {expenses.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Belum ada bon.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {expenses.map((e) => {
                const { category, label } = splitExpenseLabel(e.label);
                return (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="text-sm">
                      <p className="font-medium">{label} · {money(e.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {day(e.date)}
                        {category ? ` · ${category}` : ""}
                        {e.project_id ? ` · ${titleOf.get(e.project_id) ?? "project"}` : ""}
                      </p>
                    </div>
                    {e.receiptUrl ? (
                      <a
                        href={e.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Lihat bon
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
