import { Badge } from "@/components/ui/badge";

export type ActivityItem = {
  id: string;
  actorId?: string | null;
  action: string;
  createdAt: string | Date;
  metadata?: unknown;
};

const ACTION_LABEL: Record<string, string> = {
  "task.created": "Task dibuat",
  "task.updated": "Task diubah",
  "task.moved": "Status task",
  "task.assigned": "Task di-assign",
  "task.deleted": "Task dihapus",
  "attachment.added": "File diunggah",
  mention: "Mention",
};

function summaryOf(item: ActivityItem): string {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  switch (item.action) {
    case "task.moved":
      return `${str(meta.from) ?? "?"} → ${str(meta.to) ?? "?"}`;
    case "task.assigned":
      return `→ ${str(meta.assignee) ?? "—"}`;
    case "mention":
      return `@${str(meta.mentioned) ?? "?"}`;
    case "attachment.added":
      return `v${String(meta.version ?? "?")} · ${str(meta.note) ?? str(meta.parentType) ?? ""}`;
    default:
      return (
        str(meta.title) ??
        str(meta.taskId) ??
        (meta && typeof meta === "object" ? Object.values(meta).find((v) => typeof v === "string") ?? "" : "")
      );
  }
}

function time(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/**
 * F9 activity feed per project (non-uang; reuse pola EscrowEvent).
 * Murni render dari props agar bisa dipakai server component.
 */
export default function ActivityFeed({
  events,
  emptyLabel = "Belum ada aktivitas.",
}: {
  events: ActivityItem[];
  emptyLabel?: string;
}) {
  if (!events.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ol className="relative space-y-3 border-l border-border/70 pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative text-sm">
          <span
            aria-hidden="true"
            className="absolute top-1.5 -left-5 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary/70"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {ACTION_LABEL[e.action] ?? e.action}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {e.actorId ?? "sistem"} · {time(e.createdAt)}
            </span>
          </div>
          {summaryOf(e) ? (
            <p className="mt-0.5 text-sm break-words">{summaryOf(e)}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
