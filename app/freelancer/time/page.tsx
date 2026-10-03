import { currentUser } from "@clerk/nextjs/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import prisma from "@/lib/prisma";
import { CsvExportButton } from "@/components/revenue-chart";
import type { CsvCell } from "@/lib/export-csv";
import TimerPanel, { ManualTimeForm } from "./timer-panel";
import {
  approveTimeAction,
  convertTimeAction,
  rejectTimeAction,
} from "@/actions/time";

// TODO(nav): tambah 1 baris "Waktu" di navInsights layout freelancer
// (di-skip agar tak konflik eksekutor paralel — halaman ini mandiri).

type Db = {
  user: { findUnique(args: unknown): Promise<{ id: string } | null> };
  freelancerProfile: { findFirst(args: unknown): Promise<{ id: string } | null> };
  project: {
    findMany(args: unknown): Promise<{ id: string; title: string }[]>;
  };
  timeEntry: {
    findMany(args: unknown): Promise<
      {
        id: string;
        project_id: string;
        taskId: string | null;
        freelancerId: string;
        minutes: number;
        status: string;
        rate: bigint | null;
      }[]
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

export default async function FreelancerTimePage() {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-5 text-sm">Masuk untuk melihat timesheet.</CardContent></Card>
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

  const [projects, entries] = await Promise.all([
    db.project.findMany({
      where: { freelancerId: user.id },
      select: { id: true, title: true },
      take: 200,
    }),
    db.timeEntry.findMany({
      where: { freelancerId: key },
      orderBy: { id: "desc" },
      take: 200,
    }),
  ]);

  const titleOf = new Map(projects.map((p) => [p.id, p.title]));
  const active = entries.find((e) => e.status === "RUNNING") ?? null;
  const approved = entries.filter((e) => e.status === "APPROVED");
  const approvedMinutes = approved.reduce((s, e) => s + e.minutes, 0);

  const csvHeaders = ["project", "menit", "rate_per_jam", "status"];
  const csvRows: CsvCell[][] = entries.map((e) => [
    titleOf.get(e.project_id) ?? e.project_id,
    e.minutes,
    e.rate == null ? "" : String(e.rate),
    e.status,
  ]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Waktu & Timesheet</h1>
          <p className="text-sm text-muted-foreground">
            Timer → approval klien → invoice {approvedMinutes / 60} jam approved
            menunggu ditagih.
          </p>
        </div>
        <CsvExportButton filename="timesheet" headers={csvHeaders} rows={csvRows} />
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Timer</h2>
          <TimerPanel
            projects={projects}
            active={active ? { id: active.id, project_id: active.project_id } : null}
          />
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Entri manual (lupa nyalakan timer)
            </summary>
            <div className="pt-2"><ManualTimeForm projects={projects} /></div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-5">
          <h2 className="text-sm font-semibold">Konversi ke invoice draft</h2>
          <p className="text-xs text-muted-foreground">
            Jam APPROVED → 1 invoice draft (rate/jam per entri). Arsip PDF
            tersedia di halaman invoice/portal (reuse invoice-pdf existing).
          </p>
          <form
            action={async (fd: FormData) => {
              "use server";
              await convertTimeAction(fd);
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <label className="grid gap-1 text-xs">
              Project (kosong = semua, asal 1 project)
              <select
                name="project_id"
                className="min-w-44 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">Semua</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={approved.length === 0}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Buat invoice ({approved.length} sesi)
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-2 text-sm font-semibold">Timesheet</h2>
          {entries.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Belum ada entri waktu.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {entries.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="text-sm">
                    <p className="font-medium">
                      {titleOf.get(e.project_id) ?? "Project"} · {e.minutes} mnt
                      {e.rate != null ? ` · ${money(e.rate)}/jam` : " · tanpa rate"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                    {e.status === "DRAFT" ? (
                      <>
                        <form
                          action={async (fd: FormData) => {
                            "use server";
                            await approveTimeAction(fd);
                          }}
                        >
                          <input type="hidden" name="id" value={e.id} />
                          <button type="submit" className="text-xs font-medium text-emerald-600 hover:underline">
                            Setujui (klien)
                          </button>
                        </form>
                        <form
                          action={async (fd: FormData) => {
                            "use server";
                            await rejectTimeAction(fd);
                          }}
                        >
                          <input type="hidden" name="id" value={e.id} />
                          <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                            Tolak
                          </button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
