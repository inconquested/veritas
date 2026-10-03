"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildICS, type IcsEventInput } from "@/lib/ics";

export type WeekItem = {
  id: string;
  title: string;
  project: string;
  kind: "task" | "milestone" | "invoice";
  /** ISO string (sudah diserialisasi server). */
  due: string;
};

const KIND_LABEL: Record<WeekItem["kind"], string> = {
  task: "Task",
  milestone: "Milestone",
  invoice: "Invoice",
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * F9 kalender mingguan: task due + milestone due + invoice due (data dibaca
 * read-only via Prisma di server section, komponen ini murni render + aksi
 * klien: unduh ICS valid + salin link meet template).
 *
 * TODO(Cal.com): ganti `meetUrl` template dengan embed/scheduling Cal.com
 * saat integrasi kalender wave berikutnya; format ICS tetap valid.
 */
export default function WeekCalendar({
  items,
  weekStart,
  projectId,
  meetUrl,
}: {
  items: WeekItem[];
  weekStart?: string | Date;
  projectId?: string;
  /** Template URL meet; default pola internal per project. */
  meetUrl?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const link = meetUrl ?? `https://meet.veritas.id/m/${projectId ?? "new"}`;

  const start = new Date(weekStart ?? Date.now());
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const byDay = new Map<string, WeekItem[]>();
  for (const item of items) {
    const due = new Date(item.due);
    if (Number.isNaN(due.getTime())) continue;
    const key = dayKey(due);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(item);
  }
  const today = dayKey(new Date());

  function downloadICS() {
    const events: IcsEventInput[] = items
      .filter((i) => !Number.isNaN(new Date(i.due).getTime()))
      .map((i) => ({
        id: `${i.kind}-${i.id}`,
        title: `[${KIND_LABEL[i.kind]}] ${i.title}`,
        start: new Date(i.due),
        description: `${i.project}`,
        url: link,
      }));
    const blob = new Blob([buildICS(events, { calName: "Veritas Deadlines" })], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "veritas-deadlines.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyMeet() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Kalender minggu ini</h2>
          <p className="text-xs text-muted-foreground">Task + milestone + invoice jatuh tempo</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={downloadICS}>
            Unduh ICS
          </Button>
          <Button size="sm" variant="outline" onClick={copyMeet}>
            {copied ? "Tersalin!" : "Salin link meet"}
          </Button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-7">
        {days.map((d) => {
          const key = dayKey(d);
          const list = byDay.get(key) ?? [];
          const isToday = key === today;
          return (
            <div
              key={key}
              className={`min-h-24 rounded-md border p-2 ${isToday ? "border-primary/60 bg-primary/5" : "border-border/60"}`}
            >
              <p className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {fmtDay(d)}
              </p>
              <ul className="mt-1 space-y-1">
                {list.length === 0 ? (
                  <li className="text-xs text-muted-foreground/60">—</li>
                ) : (
                  list.map((item) => (
                    <li key={`${item.kind}-${item.id}`} className="text-xs">
                      <Badge variant="outline" className="mb-0.5 text-[10px]">
                        {KIND_LABEL[item.kind]}
                      </Badge>
                      <p className="line-clamp-2 font-medium leading-tight">{item.title}</p>
                      <p className="truncate text-muted-foreground">{item.project}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
