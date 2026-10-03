"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * F4 — Tombol Unduh/Cetak invoice & kwitansi. HTML print-friendly datang
 * dari server action (deferred: diambil saat diklik, bukan saat render
 * daftar) lalu dibuka di window baru untuk `print` (Save as PDF, A4)
 * atau diunduh sebagai file `.html`.
 */
export default function InvoicePdfButton({
  fetchHtml,
  fileName = "invoice.html",
  label = "Unduh / Cetak",
}: {
  fetchHtml: () => Promise<{
    success: boolean;
    html?: string;
    fileName?: string;
    error?: string;
  }>;
  fileName?: string;
  label?: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastFileName, setLastFileName] = React.useState<string | null>(null);

  async function load(): Promise<string | null> {
    setPending(true);
    setError(null);
    try {
      const res = await fetchHtml();
      if (!res.success || !res.html) {
        setError(res.error ?? "Gagal memuat dokumen.");
        return null;
      }
      if (res.fileName) setLastFileName(res.fileName);
      return res.html;
    } catch {
      setError("Gagal memuat dokumen.");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function onPrint() {
    const html = await load();
    if (!html) return;
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) {
      setError("Popup diblokir — izinkan popup lalu coba lagi.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  async function onDownload() {
    const html = await load();
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = lastFileName ?? fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={onPrint}
      >
        {pending ? "…" : "Cetak"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={onDownload}
        aria-label={label}
      >
        {pending ? "…" : "Unduh"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
