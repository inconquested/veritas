"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * F4 — Charge sheet ID. Menampilkan instruksi bayar lokal (QRIS / VA
 * BCA-Mandiri-BNI / OVO-DANA / gerai) untuk charge Midtrans-Snap / Xendit
 * yang sudah dibuat via `chargeInvoice` — strategi gateway TIDAK diubah
 * (guard past_due + due_date F0 tetap seperti semula).
 *
 * Status final mengikuti webhook HMAC existing (payment.settled → escrow
 * fund). Polling di sini hanya untuk tampilan; berhenti saat status
 * terminal (PAID/REFUNDED/CANCELLED) atau batas poll tercapai.
 */

export type ChargeMethod = { label: string; steps: string };

/** Instruksi statis per kanal — sama untuk Snap & Xendit hosted page. */
export function getChargeInstructions(): ChargeMethod[] {
  return [
    {
      label: "QRIS",
      steps:
        "Buka halaman bayar → pilih QRIS → pindai dengan GoPay / OVO / DANA / m-banking. Berlaku ~durasi invoice.",
    },
    {
      label: "Virtual Account (BCA / Mandiri / BNI)",
      steps:
        "Pilih bank → catat no. VA → bayar via m-banking/ATM tepat senilai tagihan agar terkonfirmasi otomatis.",
    },
    {
      label: "E-wallet (OVO / DANA / GoPay / ShopeePay / LinkAja)",
      steps:
        "Pilih e-wallet → masukkan no. HP terdaftar → setujui notifikasi pembayaran sebelum kedaluwarsa.",
    },
    {
      label: "Gerai (Alfamart / Indomaret)",
      steps:
        "Pilih gerai → catat kode bayar → tunjukkan ke kasir dan bayar tunai sebelum kedaluwarsa.",
    },
  ];
}

const TERMINAL = new Set(["PAID", "REFUNDED", "CANCELLED"]);

export default function ChargeSheet({
  provider,
  checkoutUrl,
  providerTxId,
  status,
  pollStatus,
  pollIntervalMs = 5000,
  maxPolls = 60,
}: {
  provider?: string | null;
  checkoutUrl?: string | null;
  providerTxId?: string | null;
  status?: string | null;
  pollStatus?: () => Promise<string>;
  pollIntervalMs?: number;
  maxPolls?: number;
}) {
  const [live, setLive] = React.useState<string | null>(status ?? null);
  const [polls, setPolls] = React.useState(0);

  React.useEffect(() => {
    setLive(status ?? null);
  }, [status]);

  React.useEffect(() => {
    if (!pollStatus || (live && TERMINAL.has(live)) || polls >= maxPolls) return;
    const t = setTimeout(async () => {
      try {
        setLive(await pollStatus());
      } catch {
        /* polling gagal = abaikan, coba lagi */
      }
      setPolls((n) => n + 1);
    }, pollIntervalMs);
    return () => clearTimeout(t);
  }, [pollStatus, live, polls, pollIntervalMs, maxPolls]);

  return (
    <Card className="border border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">
            Cara bayar{provider ? ` · ${provider}` : ""}
          </CardTitle>
          {live ? (
            <Badge variant="outline" className="text-xs">
              {live}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-2">
          {getChargeInstructions().map((m) => (
            <li key={m.label} className="text-xs">
              <p className="font-semibold">{m.label}</p>
              <p className="text-muted-foreground">{m.steps}</p>
            </li>
          ))}
        </ol>
        {providerTxId ? (
          <p className="truncate text-[11px] text-muted-foreground">
            Ref: {providerTxId}
          </p>
        ) : null}
        {checkoutUrl ? (
          <Button size="sm" asChild>
            <a href={checkoutUrl} target="_blank" rel="noreferrer">
              Lanjut ke halaman bayar
            </a>
          </Button>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          Status final dikonfirmasi otomatis via webhook. Halaman ini
          memperbarui tampilan tiap {Math.round(pollIntervalMs / 1000)} dtk.
        </p>
      </CardContent>
    </Card>
  );
}
