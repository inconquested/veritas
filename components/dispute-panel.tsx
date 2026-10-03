"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type DisputeDTO = {
  id: string;
  escrowId: string;
  reason: string;
  requestedAmount: string | null;
  status: string;
  deadlineAt: string;
};

export type DisputeActionResult = {
  success: boolean;
  error?: string;
};

function money(amount: string | null) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return amount;
  }
}

function remaining(deadlineAt: string, now: number) {
  const ms = new Date(deadlineAt).getTime() - now;
  if (ms <= 0) return "lewat deadline";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d} hari ${h} jam lagi` : `${h} jam ${m} mnt lagi`;
}

export default function DisputePanel({
  projectId,
  invoiceId,
  invoiceTitle,
  escrowId,
  dispute,
  openAction,
  respondAction,
  resolveAction,
}: {
  projectId: string;
  invoiceId: string;
  invoiceTitle: string;
  escrowId: string;
  dispute: DisputeDTO | null;
  openAction: (formData: FormData) => Promise<DisputeActionResult>;
  respondAction: (disputeId: string) => Promise<DisputeActionResult>;
  resolveAction: (disputeId: string, outcome: "REFUND" | "RELEASE") => Promise<DisputeActionResult>;
}) {
  const router = useRouter();
  const [now, setNow] = React.useState(() => Date.now());
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!dispute) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [dispute]);

  async function run(key: string, fn: () => Promise<DisputeActionResult>) {
    setPending(key);
    setError(null);
    try {
      const result = await fn();
      if (!result.success) {
        setError(result.error ?? "Gagal. Coba lagi.");
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm">Sengketa · {invoiceTitle}</CardTitle>
          {dispute ? (
            <Badge variant="outline" className="text-xs">
              {dispute.status}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!dispute ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run("open", () => openAction(new FormData(e.currentTarget)));
            }}
          >
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <input type="hidden" name="escrowId" value={escrowId} />
            <Textarea name="reason" placeholder="Alasan sengketa…" disabled={busy} />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                name="requestedAmount"
                inputMode="numeric"
                placeholder="Nominal klaim (Rp, opsional)"
                disabled={busy}
                className="w-56"
              />
              <input
                type="file"
                name="evidence"
                multiple
                accept="image/*"
                disabled={busy}
                className="min-w-0 flex-1 text-xs text-muted-foreground"
              />
              <Button size="sm" type="submit" disabled={busy}>
                {pending === "open" ? "Membuka…" : "Buka Sengketa"}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{dispute.reason}</p>
            <p className="text-xs text-muted-foreground">
              Klaim: {money(dispute.requestedAmount)} · deadline:{" "}
              {remaining(dispute.deadlineAt, now)}
            </p>
            {dispute.status === "OPEN" || dispute.status === "NEGOTIATING" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run("respond", () => respondAction(dispute.id))}
                >
                  {pending === "respond" ? "Memproses…" : "Respons / Negosiasi"}
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => run("release", () => resolveAction(dispute.id, "RELEASE"))}
                >
                  {pending === "release" ? "Memproses…" : "Setuju — Rilis Dana"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => run("refund", () => resolveAction(dispute.id, "REFUND"))}
                >
                  {pending === "refund" ? "Memproses…" : "Tolak — Refund"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sengketa selesai ({dispute.status}), tercatat di timeline escrow.
              </p>
            )}
          </>
        )}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
