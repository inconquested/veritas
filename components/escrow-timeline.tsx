import { Badge } from "@/components/ui/badge";

export type EscrowTimelineEvent = {
  id: string;
  action: string;
  actorRole: string;
  fromStatus: string | null;
  toStatus: string;
  createdAt: string | Date;
  metadata?: unknown;
  txId?: string | null;
};

const STATUS_CLASS: Record<string, string> = {
  INITIALIZED: "bg-muted text-muted-foreground border-border",
  FUNDS_HELD: "bg-blue-500/10 text-blue-600 border-blue-200",
  DISPUTED: "bg-amber-500/10 text-amber-600 border-amber-200",
  RELEASED: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  REFUNDED: "bg-purple-500/10 text-purple-600 border-purple-200",
};

const DOT_CLASS: Record<string, string> = {
  INITIALIZED: "bg-muted-foreground/40",
  FUNDS_HELD: "bg-blue-500",
  DISPUTED: "bg-amber-500",
  RELEASED: "bg-emerald-500",
  REFUNDED: "bg-purple-500",
};

function txIdOf(event: EscrowTimelineEvent): string | null {
  if (event.txId) return event.txId;
  const meta = event.metadata as Record<string, unknown> | null;
  const raw =
    meta?.providerTxId ?? meta?.txId ?? meta?.transactionId ?? meta?.sessionId;
  return typeof raw === "string" && raw ? raw : null;
}

function time(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/**
 * Read-only escrow audit timeline. Pure render (no client JS) so it works in
 * the public magic-link portal and the freelancer dashboard alike.
 */
export default function EscrowTimeline({
  events,
  emptyLabel = "No escrow activity yet.",
}: {
  events: EscrowTimelineEvent[];
  emptyLabel?: string;
}) {
  if (!events.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-border/70 pl-5">
      {events.map((event) => {
        const txId = txIdOf(event);
        return (
          <li key={event.id} className="relative text-sm">
            <span
              aria-hidden="true"
              className={`absolute top-1.5 -left-5 h-2.5 w-2.5 -translate-x-1/2 rounded-full ${DOT_CLASS[event.toStatus] ?? "bg-muted-foreground/40"}`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${STATUS_CLASS[event.toStatus] ?? STATUS_CLASS.INITIALIZED}`}
              >
                {event.fromStatus
                  ? `${event.fromStatus} → ${event.toStatus}`
                  : event.toStatus}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {event.action} · {event.actorRole} · {time(event.createdAt)}
              </span>
            </div>
            {txId ? (
              <p className="mt-1 font-mono text-xs break-all text-muted-foreground">
                tx: {txId}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
