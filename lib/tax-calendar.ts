/**
 * F10 — Kalender pajak ID 2026 (murni, tanpa DB): jatuh tempo PPh/PPN/SPT
 * + `dueReminders()` untuk pengingat H-`withinDays` dan yang lewat.
 *
 * Tanggal = jadwal umum DJP (setor PPh tgl 10/15, lapor PPN akhir bulan
 * berikut, SPT OP 31 Mar, SPT Badan 30 Apr). Bukan nasihat pajak — angka
 * pasti ikut aturan/SKP masing-masing. Saat libur, DJP biasanya geser ke
 * hari kerja berikut (TODO: kalender libur nasional).
 */

export type TaxDue = {
  key: string;
  label: string;
  /** ISO YYYY-MM-DD. */
  due: string;
  kind: "PPh" | "PPN" | "SPT";
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Daftar jatuh tempo setahun penuh 2026 (statis, bisa di-cache). */
export function taxDeadlines2026(): TaxDue[] {
  const out: TaxDue[] = [];
  for (let m = 1; m <= 12; m++) {
    const prev = MONTHS[m - 2] ?? "Des";
    out.push({
      key: `pph21-2026-${m}`,
      label: `Setor PPh 21 masa ${prev}`,
      due: iso(2026, m, 10),
      kind: "PPh",
    });
    out.push({
      key: `pph23-2026-${m}`,
      label: `Setor PPh 23 masa ${prev}`,
      due: iso(2026, m, 10),
      kind: "PPh",
    });
    out.push({
      key: `pph25-2026-${m}`,
      label: `Setor PPh 25 masa ${MONTHS[m - 1]}`,
      due: iso(2026, m, 15),
      kind: "PPh",
    });
    const nm = m === 12 ? 1 : m + 1; // lapor PPN akhir bulan berikut
    const ny = m === 12 ? 2027 : 2026;
    out.push({
      key: `ppn-2026-${m}`,
      label: `Lapor PPN masa ${MONTHS[m - 1]}`,
      due: iso(ny, nm, 30),
      kind: "PPN",
    });
  }
  out.push({
    key: "spt-op-2026",
    label: "SPT Tahunan PPh Orang Pribadi 2025",
    due: "2026-03-31",
    kind: "SPT",
  });
  out.push({
    key: "spt-badan-2026",
    label: "SPT Tahunan PPh Badan 2025",
    due: "2026-04-30",
    kind: "SPT",
  });
  return out.sort((a, b) => (a.due < b.due ? -1 : 1));
}

/**
 * Pengingat relatif ke `now`: lewat (`overdue`, due < hari ini) vs
 * dekat (`upcoming`, 0..withinDays ke depan). Murni & terurut.
 */
export function dueReminders(
  now: Date = new Date(),
  withinDays = 30,
): { overdue: TaxDue[]; upcoming: TaxDue[] } {
  const today = iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const horizon = new Date(now.getTime() + withinDays * 86_400_000);
  const h = iso(horizon.getFullYear(), horizon.getMonth() + 1, horizon.getDate());
  const overdue: TaxDue[] = [];
  const upcoming: TaxDue[] = [];
  for (const t of taxDeadlines2026()) {
    if (t.due < today && t.due >= "2026-01-01") overdue.push(t);
    else if (t.due >= today && t.due <= h) upcoming.push(t);
  }
  return { overdue, upcoming };
}
