"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TaskStatus } from "@/services/task-service";

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus | string;
  assignee?: string | null;
  due?: string | Date | null;
  milestoneTitle?: string | null;
};

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "TODO" },
  { status: "DOING", label: "DOING" },
  { status: "REVIEW", label: "REVIEW" },
  { status: "DONE", label: "DONE" },
];

function dueLabel(due?: string | Date | null): string {
  if (!due) return "—";
  const d = due instanceof Date ? due : new Date(due);
  if (Number.isNaN(d.getTime())) return "—";
  const overdue = d.getTime() < Date.now();
  return `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}${overdue ? " • lewat" : ""}`;
}

/**
 * F9 kanban task: drag-drop HTML5 native (tanpa lib baru) + filter teks/
 * assignee. Optimistic update; gagal server = kembalikan posisi + tampilkan error.
 */
export default function TaskBoard({
  tasks,
  onMove,
}: {
  tasks: BoardTask[];
  onMove?: (id: string, to: TaskStatus) => Promise<{ success: boolean; error?: string }>;
}) {
  const [items, setItems] = React.useState<BoardTask[]>(tasks);
  const [query, setQuery] = React.useState("");
  const [assignee, setAssignee] = React.useState<string>("all");
  const [error, setError] = React.useState<string | null>(null);
  const dragId = React.useRef<string | null>(null);

  React.useEffect(() => setItems(tasks), [tasks]);

  const assignees = React.useMemo(
    () => [...new Set(items.map((t) => t.assignee).filter(Boolean))] as string[],
    [items],
  );

  const visible = items.filter((t) => {
    const q = query.trim().toLowerCase();
    if (q && !t.title.toLowerCase().includes(q)) return false;
    if (assignee !== "all" && t.assignee !== assignee) return false;
    return true;
  });

  async function dropTo(to: TaskStatus) {
    const id = dragId.current;
    dragId.current = null;
    if (!id) return;
    const prev = items;
    const current = prev.find((t) => t.id === id);
    if (!current || current.status === to) return;
    setItems(prev.map((t) => (t.id === id ? { ...t, status: to } : t)));
    setError(null);
    if (!onMove) return;
    try {
      const res = await onMove(id, to);
      if (!res.success) {
        setItems(prev);
        setError(res.error ?? "Pindah status ditolak (transisi ilegal).");
      }
    } catch {
      setItems(prev);
      setError("Gagal memindah task.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter task…"
          className="h-8 max-w-52 text-sm"
          aria-label="Filter task"
        />
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Filter assignee"
        >
          <option value="all">Semua assignee</option>
          {assignees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = visible.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropTo(col.status)}
              className="min-h-32 rounded-lg border border-border/60 bg-muted/30 p-2"
              aria-label={`Kolom ${col.label}`}
            >
              <p className="flex items-center justify-between px-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground">
                {col.label}
                <span className="rounded-full bg-muted px-1.5">{list.length}</span>
              </p>
              <ul className="space-y-2">
                {list.map((t) => (
                  <li key={t.id}>
                    <Card
                      draggable
                      onDragStart={(e) => {
                        dragId.current = t.id;
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="cursor-grab border border-border/60 shadow-sm active:cursor-grabbing"
                    >
                      <CardContent className="space-y-1 p-2.5 text-sm">
                        <p className="leading-snug font-medium">{t.title}</p>
                        {t.milestoneTitle ? (
                          <p className="truncate text-xs text-muted-foreground">{t.milestoneTitle}</p>
                        ) : null}
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {t.assignee ?? "tanpa assignee"}
                          </Badge>
                          <span>{dueLabel(t.due)}</span>
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                ))}
                {list.length === 0 ? (
                  <li className="px-1 py-3 text-center text-xs text-muted-foreground/60">
                    Taruh di sini
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
