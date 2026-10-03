/**
 * F4 — PDF invoice + kwitansi tanpa dependency berat: template HTML
 * print-friendly (A4, `window.print` → Save as PDF) + tombol Unduh/Cetak
 * di `components/invoice-pdf-button.tsx`.
 *
 * Berisi: nomor invoice, tipe termin (DP/TERMIN/FINAL/RETAINER), QR verifikasi
 * (link magic-link `/p/[token]` via qrserver + fallback anchor teks), dan
 * PPN/PPh23 opsional. Semua fungsi murni — aman diuji tanpa DB/browser.
 */

// TODO(F4-wave-integrasi): ganti qrserver dengan QR lokal (tanpa fetch
// eksternal) saat lib QR tersedia; F1 juga menunda QR dengan alasan sama.

export type InvoicePdfData = {
  number?: string | null;
  type?: string | null;
  title: string;
  clientName: string;
  freelancerName?: string | null;
  amount: bigint | number | string;
  currency?: string | null;
  dueDate: Date | string;
  issuedAt?: Date | string | null;
  notes?: string | null;
  /** Link magic-link `/p/[token]` — jika null, blok QR tampilkan nomor saja. */
  verifyUrl?: string | null;
  /** Persen, mis. 11 untuk PPN 11%. Kosong = baris disembunyikan. */
  ppnPercent?: number | null;
  /** Persen, mis. 2 untuk PPh 23 2%. Kosong = baris disembunyikan. */
  pph23Percent?: number | null;
};

export type InvoiceTotals = {
  subtotal: bigint;
  ppn: bigint;
  pph23: bigint;
  /** Yang ditagih/diterima: subtotal + ppn − pph23. */
  total: bigint;
};

function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(String(value).trim());
}

/** Hitung PPN/PPh23 dengan integer math (basis poin → tanpa float drift). */
export function calcInvoiceTotals(
  amount: bigint | number | string,
  ppnPercent?: number | null,
  pph23Percent?: number | null,
): InvoiceTotals {
  const subtotal = toBigInt(amount);
  const pct = (p: number | null | undefined) =>
    p == null || Number.isNaN(p) || p <= 0 ? 0 : Math.round(p * 100);
  const ppn = (subtotal * BigInt(pct(ppnPercent ?? null))) / 10000n;
  const pph23 = (subtotal * BigInt(pct(pph23Percent ?? null))) / 10000n;
  return { subtotal, ppn, pph23, total: subtotal + ppn - pph23 };
}

export function money(amount: bigint, currency?: string | null): string {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: (currency ?? "IDR").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency ?? "IDR"} ${amount.toString()}`;
  }
}

export function dateId(value: Date | string | null | undefined): string {
  if (value == null) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

export function esc(value: string | null | undefined): string {
  return (value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** QR via qrserver (online) — selalu ditemani anchor teks sebagai fallback. */
export function qrImageUrl(verifyUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verifyUrl)}`;
}

export function invoiceFileName(
  data: Pick<InvoicePdfData, "number" | "title">,
  kind: "invoice" | "kwitansi" = "invoice",
): string {
  const base = (data.number ?? data.title ?? kind)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${kind}-${base || "doc"}.html`;
}

const CSS = `
@page { size: A4; margin: 18mm 15mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; line-height: 1.5; margin: 0; padding: 24px; max-width: 720px; }
h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: .5px; }
.meta { color: #555; font-size: 12px; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; }
th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
th { background: #f4f4f4; font-size: 12px; }
.num { text-align: right; white-space: nowrap; }
.total td { font-weight: bold; border-top: 2px solid #111; }
.verify { margin-top: 20px; border: 1px dashed #999; padding: 12px; display: flex; gap: 12px; align-items: center; font-size: 12px; color: #333; }
.notes { margin-top: 12px; font-size: 12px; color: #444; }
.sign { display: flex; justify-content: flex-end; margin-top: 36px; }
.sign div { text-align: center; min-width: 200px; }
@media print { body { padding: 0; } }
`;

function totalsRows(t: InvoiceTotals, d: InvoicePdfData): string {
  const cur = d.currency ?? "IDR";
  let rows = `<tr><td>Subtotal</td><td class="num">${money(t.subtotal, cur)}</td></tr>`;
  if ((d.ppnPercent ?? 0) > 0)
    rows += `<tr><td>PPN ${esc(String(d.ppnPercent))}%</td><td class="num">${money(t.ppn, cur)}</td></tr>`;
  if ((d.pph23Percent ?? 0) > 0)
    rows += `<tr><td>PPh 23 ${esc(String(d.pph23Percent))}% (potong)</td><td class="num">−${money(t.pph23, cur)}</td></tr>`;
  rows += `<tr class="total"><td>Total</td><td class="num">${money(t.total, cur)}</td></tr>`;
  return rows;
}

function verifyBlock(d: InvoicePdfData): string {
  if (!d.verifyUrl) {
    return `<div class="verify"><div>No. ${esc(d.number ?? "—")}<br/>Verifikasi via portal klien (tautan magic-link).</div></div>`;
  }
  return `<div class="verify">
<img src="${esc(qrImageUrl(d.verifyUrl))}" width="120" height="120" alt="QR verifikasi"/>
<div><strong>Verifikasi keaslian</strong><br/>Pindai QR atau buka:<br/><a href="${esc(d.verifyUrl)}">${esc(d.verifyUrl)}</a></div>
</div>`;
}

/** HTML invoice lengkap (nomor, tipe termin, PPN/PPh23 opsional, QR verifikasi). */
export function buildInvoiceHtml(d: InvoicePdfData): string {
  const t = calcInvoiceTotals(d.amount, d.ppnPercent, d.pph23Percent);
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/>
<title>Invoice ${esc(d.number ?? d.title)}</title><style>${CSS}</style></head><body>
<h1>INVOICE</h1>
<div class="meta">No. <strong>${esc(d.number ?? "—")}</strong> · Tipe: <strong>${esc(d.type ?? "FINAL")}</strong><br/>
Diterbitkan: ${esc(dateId(d.issuedAt ?? new Date()))} · Jatuh tempo: ${esc(dateId(d.dueDate))}</div>
<p><strong>Ditagihkan kepada:</strong> ${esc(d.clientName)}<br/>${d.freelancerName ? `<strong>Dari:</strong> ${esc(d.freelancerName)}<br/>` : ""}</p>
<table><thead><tr><th>Uraian</th><th style="width:180px" class="num">Jumlah</th></tr></thead>
<tbody><tr><td>${esc(d.title)}</td><td class="num">${esc(money(t.subtotal, d.currency ?? "IDR"))}</td></tr>
${totalsRows(t, d)}</tbody></table>
${d.notes ? `<p class="notes"><strong>Catatan:</strong> ${esc(d.notes)}</p>` : ""}
${verifyBlock(d)}
<div class="sign"><div>Hormat kami,<br/><br/><br/>(${esc(d.freelancerName ?? "....................")})</div></div>
</body></html>`;
}

/** HTML kwitansi (bukti terima — nominal = total setelah PPN/PPh23). */
export function buildReceiptHtml(d: InvoicePdfData): string {
  const t = calcInvoiceTotals(d.amount, d.ppnPercent, d.pph23Percent);
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/>
<title>Kwitansi ${esc(d.number ?? d.title)}</title><style>${CSS}</style></head><body>
<h1>KWITANSI</h1>
<div class="meta">No. <strong>${esc(d.number ?? "—")}</strong> · Tertanggal: ${esc(dateId(d.issuedAt ?? new Date()))}</div>
<p>Telah diterima dari <strong>${esc(d.clientName)}</strong> uang sejumlah
<strong>${esc(money(t.total, d.currency ?? "IDR"))}</strong>
untuk pembayaran <em>${esc(d.title)}</em> (invoice ${esc(d.number ?? "—")}).</p>
${d.notes ? `<p class="notes"><strong>Catatan:</strong> ${esc(d.notes)}</p>` : ""}
${verifyBlock(d)}
<div class="sign"><div>Yang menerima,<br/><br/><br/>(${esc(d.freelancerName ?? "....................")})</div></div>
</body></html>`;
}
