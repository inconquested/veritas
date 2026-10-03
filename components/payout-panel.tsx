"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listPayoutsAction,
  markPayoutDoneAction,
  requestPayoutAction,
} from "@/actions/payouts";

/**
 * F4 — Panel Tarik Dana (dashboard freelancer): form + riwayat payout.
 * Anti double-submit: tiap klik kirim idempotencyKey UUID baru + tombol
 * dikunci selama request berjalan; server dedupe via kolom unik.
 */

type Payout = {
  id: string;
  amount: string;
  bank: string;
  accountNo: string;
  status: string;
  extRef?: string | null;
  createdAt?: string | Date | null;
};

function money(value: string | number) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `IDR ${String(value)}`;
  }
}

export default function PayoutPanel() {
  const [rows, setRows] = React.useState<Payout[]>([]);
  const [amount, setAmount] = React.useState("");
  const [bank, setBank] = React.useState("BCA");
  const [accountNo, setAccountNo] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const res = await listPayoutsAction();
    if (res.success) setRows(res.payouts as Payout[]);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return; // kunci ganda di client
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await requestPayoutAction({
        amount,
        bank,
        accountNo,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOk("Permintaan tarik dana tercatat (QUEUED).");
      setAmount("");
      setAccountNo("");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function done(id: string) {
    setPending(true);
    try {
      const res = await markPayoutDoneAction(id);
      if (!res.success) setError(res.error);
      else await refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Tarik Dana</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Min. Rp10rb (BCA/Mandiri/BNI) · Rp57.500 (bank lain). Manual v1:
          admin transfer lalu tandai selesai.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs">
            Nominal (IDR)
            <input
              className="w-36 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              inputMode="numeric"
              placeholder="100000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-xs">
            Bank
            <select
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
            >
              {["BCA", "MANDIRI", "BNI", "BRI", "BANK LAIN"].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            No. rekening
            <input
              className="w-44 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              inputMode="numeric"
              placeholder="8210…"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              required
            />
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Memproses…" : "Tarik Dana"}
          </Button>
        </form>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {ok ? <p className="text-xs text-emerald-600">{ok}</p> : null}
        <div className="divide-y divide-border/50">
          {rows.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Belum ada penarikan.
            </p>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {money(r.amount)} · {r.bank} {r.accountNo}
                  </p>
                  {r.extRef ? (
                    <p className="text-xs text-muted-foreground">
                      Ref: {r.extRef}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {r.status}
                  </Badge>
                  {r.status === "QUEUED" || r.status === "PROCESSING" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => done(r.id)}
                    >
                      Tandai selesai
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
