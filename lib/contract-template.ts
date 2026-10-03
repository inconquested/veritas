/** F5 template kontrak kerja freelance standar Indonesia (e-sign v1). */

export type ContractTemplateParams = {
  freelancerName: string;
  clientName: string;
  projectTitle: string;
  /** Nilai kontrak penuh (IDR). */
  total: bigint | number | string;
  /** Persen DP (default 50). */
  dpPercent?: number;
  /** Batas akhir pekerjaan, mis. "30 Juni 2026". */
  deadline?: string;
  city?: string;
  date?: Date | string;
};

export function formatIDR(n: bigint | number | string): string {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return `Rp${String(n)}`;
  }
}

/** Body kontrak ID standar — disimpan ke Contract.body, di-hash saat sign. */
export function buildStandardContract(p: ContractTemplateParams): string {
  const dp = Math.min(100, Math.max(1, Math.trunc(p.dpPercent ?? 50)));
  const city = p.city ?? "Jakarta";
  const date = p.date ? new Date(p.date) : new Date();
  const dateStr = Number.isNaN(date.getTime())
    ? String(p.date)
    : date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const total = formatIDR(p.total);
  return [
    `KONTRAK KERJA FREELANCE — ${p.projectTitle}`,
    ``,
    `Pada hari ini, ${dateStr}, bertempat di ${city}, yang bertanda tangan di bawah ini:`,
    ``,
    `PIHAK PERTAMA (Freelancer): ${p.freelancerName}`,
    `PIHAK KEDUA (Klien): ${p.clientName}`,
    ``,
    `Pasal 1 — Lingkup Pekerjaan`,
    `Pihak Pertama mengerjakan "${p.projectTitle}" sesuai proposal dan milestone yang disepakati di aplikasi Veritas.`,
    ``,
    `Pasal 2 — Nilai Kontrak dan Termin`,
    `Nilai kontrak ${total}. DP ${dp}% dibayar di muka via escrow Veritas; pelunasan ${100 - dp}% setelah handsout disetujui (APPROVED).`,
    ``,
    `Pasal 3 — Escrow dan Serah Terima`,
    `Dana DP ditahan escrow dan cair ke freelancer saat klien approve handsout atau auto-release sesuai pengaturan. Bukti serah terima tercatat di aplikasi.`,
    ``,
    `Pasal 4 — Revisi`,
    `Klien berhak meminta revisi maksimal 2 putaran per handsout; penolakan (REJECT) menaikkan versi handsout. Di luar itu dikenakan biaya tambahan.`,
    ``,
    `Pasal 5 — Waktu Pengerjaan`,
    `Target selesai: ${p.deadline ?? "sesuai due_date milestone"}. Keterlambatan > 7 hari tanpa kabar memberi hak klien membuka sengketa.`,
    ``,
    `Pasal 6 — Sengketa`,
    `Sengketa diselesaikan musyawarah di dalam aplikasi (maks. 7×24 jam), lalu mediasi data escrow bila buntu.`,
    ``,
    `Pasal 7 — Tanda Tangan Elektronik`,
    `Persetujuan sah via e-sign v1: nama ketik + timestamp + hash SHA-256 isi kontrak ini. Perubahan isi setelah kedua pihak signed membuat kontrak INVALID dan wajib terbit versi baru.`,
  ].join("\n");
}
