import { toCsv } from "./export-csv";

/**
 * F10 — Ekspor format Jurnal/Mekari (read-only import `export-csv`,
 * file itu TIDAK diubah). Output = CSV (`\r\n`, escaping standar) yang
 * dibuka di Excel/Jurnal/Mekari tanpa rusak — tanpa dep `xlsx`.
 *
 * Kolom mengikuti impor penjualan generik Jurnal (Tanggal, Nomor,
 * Pelanggan, Deskripsi, Jumlah, Pajak, Mata Uang). Mekari = susunan sama
 * dengan header Bahasa Indonesia penuh (alias agar jelas di UI).
 */

export type ExportInvoice = {
  due_date?: Date | string | null;
  createdAt?: Date | string | null;
  number?: string | null;
  clientName?: string | null;
  title?: string | null;
  amount?: bigint | number | string | null;
  currency?: string | null;
};

export const JURNAL_HEADERS = [
  "Tanggal",
  "Nomor",
  "Pelanggan",
  "Deskripsi",
  "Jumlah",
  "Pajak",
  "Mata Uang",
];

export const MEKARI_HEADERS = [
  "Tanggal Transaksi",
  "Nomor Transaksi",
  "Nama Pelanggan",
  "Deskripsi",
  "Jumlah",
  "Pajak",
  "Mata Uang",
];

function cellDate(v: Date | string | null | undefined): string {
  if (v == null) return "";
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function toRows(invoices: ExportInvoice[]): (string | number)[][] {
  return invoices.map((inv) => [
    cellDate(inv.createdAt ?? inv.due_date),
    inv.number ?? "",
    inv.clientName ?? "",
    inv.title ?? "",
    inv.amount == null ? "" : String(inv.amount),
    "",
    (inv.currency ?? "IDR").toString().toUpperCase(),
  ]);
}

/** CSV gaya Jurnal dari daftar invoice. */
export function toJurnalCsv(invoices: ExportInvoice[]): string {
  return toCsv(JURNAL_HEADERS, toRows(invoices) as never);
}

/** CSV gaya Mekari dari daftar invoice (isi sama, header beda). */
export function toMekariCsv(invoices: ExportInvoice[]): string {
  return toCsv(MEKARI_HEADERS, toRows(invoices) as never);
}
