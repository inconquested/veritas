import { Badge } from "@/components/ui/badge";

export type DeadlineItem = {
  id: string;
  title: string;
  project: string;
  kind: "milestone" | "invoice";
  /** ISO string (sudah diserialisasi server). */
  due: string;
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * F6 — kalender deadline mingguan: milestone `due_date` + invoice jatuh tempo.
 * Murni render dari props (tanpa fetch) agar bisa dipakai server component.
 */
export function DeadlineCalendar({
  items,
  weekStart,
}: {
  items: DeadlineItem[];
  weekStart?: string | Date;
}) {
  const start = new Date(weekStart ?? Date.now());
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const byDay = new Map<string, DeadlineItem[]>();
  for (const item of items) {
    const due = new Date(item.due);
    if (Number.isNaN(due.getTime())) continue;
    const key = dayKey(due);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(item);
  }
  const today = dayKey(new Date());

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <h2 className="text-sm font-semibold">Deadline minggu ini</h2>
      <p className="text-xs text-muted-foreground">Milestone + invoice jatuh tempo</p>
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
                        {item.kind === "milestone" ? "Milestone" : "Invoice"}
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
