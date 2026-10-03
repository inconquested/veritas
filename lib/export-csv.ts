/**
 * F6 — CSV export untuk laporan freelancer (dipakai tombol di reports page).
 * Murni (tanpa DOM) kecuali `downloadCsv` yang no-op di SSR.
 */

export type CsvCell = string | number | bigint | null | undefined;

function escapeCell(value: CsvCell): string {
  const raw = value == null ? "" : String(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

/** Bangun string CSV (header + baris) dengan escaping standar. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCell).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** Unduh CSV di browser; no-op saat SSR (tanpa `document`). */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
