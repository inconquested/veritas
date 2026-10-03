"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import ChargeSheet from "@/components/charge-sheet";
import { approveWork, getInvoiceStatus, payInvoice } from "./actions";

export default function PortalInvoiceActions({
  token,
  invoiceId,
  invoiceStatus,
  escrowStatus,
  paymentMethod,
}: {
  token: string;
  invoiceId: string;
  invoiceStatus: string;
  escrowStatus: string | null;
  paymentMethod?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [charge, setCharge] = React.useState<{
    checkoutUrl?: string;
    providerTxId?: string;
  } | null>(null);

  async function run(
    key: string,
    fn: () => Promise<{ success: boolean; error?: unknown; checkoutUrl?: string }>,
  ) {
    setPending(key);
    setError(null);
    try {
      const result = await fn();
      if (!result.success) {
        setError(typeof result.error === "string" ? result.error : "Gagal. Coba lagi.");
        return;
      }
      if (key === "pay" && result.checkoutUrl) {
        // Tampilkan charge sheet ID dulu (instruksi QRIS/VA/e-wallet/gerai);
        // klien lanjut ke halaman bayar via tombol di dalamnya.
        setCharge({
          checkoutUrl: result.checkoutUrl,
          providerTxId:
            "providerTxId" in result
              ? ((result.providerTxId as string) ?? undefined)
              : undefined,
        });
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const canPay = invoiceStatus === "SENT" || invoiceStatus === "OVERDUE" || invoiceStatus === "DRAFT";
  const canApprove = escrowStatus === "FUNDS_HELD" || escrowStatus === "DISPUTED";

  if (!canPay && !canApprove) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canPay && !charge ? (
          <Button
            size="sm"
            disabled={pending !== null}
            onClick={() => run("pay", () => payInvoice(token, invoiceId))}
          >
            {pending === "pay" ? "Memproses…" : "Bayar"}
          </Button>
        ) : null}
        {canApprove ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => run("approve", () => approveWork(token, invoiceId))}
          >
            {pending === "approve" ? "Memproses…" : "Approve & Rilis Dana"}
          </Button>
        ) : null}
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
      {charge ? (
        <ChargeSheet
          provider={paymentMethod}
          checkoutUrl={charge.checkoutUrl}
          providerTxId={charge.providerTxId}
          status={invoiceStatus}
          pollStatus={async () => {
            const res = await getInvoiceStatus(token, invoiceId);
            if (!res.success) throw new Error(res.error);
            if (res.status === "PAID") router.refresh();
            return res.status;
          }}
        />
      ) : null}
    </div>
  );
}
