/**
 * Brief generator F8 — paste chat WA klien → { scope, milestones, estimate, redFlags }.
 * `parseBrief` murni + deterministik (tanpa key tetap hasilkan struktur valid);
 * `generateBrief` memoles via `complete()` bila AI aktif, fallback ke hasil parse.
 */

import { complete, type CompleteResult } from "./ai-service";

export interface BriefMilestone {
  title: string;
  description?: string;
  /** Estimasi hari (bila terdeteksi). */
  estimateDays?: number;
}

export interface ProjectBrief {
  scope: string;
  milestones: BriefMilestone[];
  /** Ringkasan estimasi, mis. "±14 hari" atau "Belum ada estimasi". */
  estimate: string;
  /** Red flag: scope kabur, deadline tak realistis, tanpa budget, dsb. */
  redFlags: string[];
}

const MAX_SCOPE_CHARS = 600;
const MIN_CLEAR_SCOPE_CHARS = 80;

const BULLET_RE = /^\s*(?:[-•*]|\d+[.)])\s+(.+)$/;
const DURATION_RE = /(\d+)\s*(hari|minggu|bulan)/gi;
const DEADLINE_WORDS =
  /\b(secepatnya|asap|kilat|besok|lusa|minggu (ini|depan)|deadline|tenggat)\b/i;
const BUDGET_WORDS =
  /\b(budget|anggaran|harga|fee|biaya|rp|rupiah|juta|jt|ribu|rb|k\b|dp|termin)\b/i;
const SCOPEY_VERBS =
  /\b(buatkan|bikin|desain|design|kembangkan|develop|perbaiki|tambah|integrasi|migrasi|setup|deploy|tulis|edit|foto|video|logo|website|web|aplikasi|app|toko online|company profile)\b/i;

function toDays(n: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("minggu")) return n * 7;
  if (u.startsWith("bulan")) return n * 30;
  return n;
}

/** Ambil semua durasi "N hari/minggu/bulan" → total hari. */
export function extractDurations(text: string): number[] {
  const out: number[] = [];
  DURATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DURATION_RE.exec(text)) !== null) {
    out.push(toDays(Number(m[1]), m[2]));
  }
  DURATION_RE.lastIndex = 0;
  return out;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

/** Parse murni: tanpa I/O, tanpa AI. Selalu kembalikan struktur valid. */
export function parseBrief(chatText: string): ProjectBrief {
  const raw = (chatText ?? "").trim();
  if (!raw) {
    return {
      scope: "Belum ada brief.",
      milestones: [],
      estimate: "Belum ada estimasi",
      redFlags: ["Chat kosong — belum bisa disimpulkan apa pun."],
    };
  }

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = lines
    .map((l) => l.match(BULLET_RE)?.[1]?.trim())
    .filter((s): s is string => !!s && s.length > 3);

  const durations = extractDurations(raw);
  const totalDays = durations.reduce((a, b) => a + b, 0);
  const estimate =
    totalDays > 0 ? `±${totalDays} hari` : "Belum ada estimasi";

  // Milestone: bullets dulu; fallback = kalimat-kalimat bermakna (maks 6).
  const candidates =
    bullets.length > 0 ? bullets : splitSentences(raw).slice(0, 6);
  const perItem =
    candidates.length > 0 && totalDays > 0
      ? Math.max(1, Math.round(totalDays / candidates.length))
      : undefined;
  const milestones: BriefMilestone[] = candidates.slice(0, 8).map((t) => ({
    title: t.length > 90 ? `${t.slice(0, 87)}…` : t,
    ...(perItem ? { estimateDays: perItem } : {}),
  }));

  const scopeLines = lines.filter((l) => !BULLET_RE.test(l)).slice(0, 4);
  const scopeBase = scopeLines.join(" ") || raw;
  const scope =
    scopeBase.length > MAX_SCOPE_CHARS
      ? `${scopeBase.slice(0, MAX_SCOPE_CHARS - 1)}…`
      : scopeBase;

  const redFlags: string[] = [];
  if (raw.length < MIN_CLEAR_SCOPE_CHARS || !SCOPEY_VERBS.test(raw)) {
    redFlags.push(
      "Scope kabur — kebutuhan klien belum jelas, gali lagi sebelum kirim penawaran.",
    );
  }
  if (bullets.length === 0 && splitSentences(raw).length <= 2) {
    redFlags.push(
      "Belum ada rincian deliverable — pecah jadi milestone agar DP/termin bisa ditagih.",
    );
  }
  if (!BUDGET_WORDS.test(raw)) {
    redFlags.push("Belum ada bahasan budget — tanyakan rentang budget klien.");
  }
  if (DEADLINE_WORDS.test(raw)) {
    const minSane = Math.max(3, milestones.length * 2);
    if (totalDays > 0 && totalDays < minSane) {
      redFlags.push(
        `Deadline tak realistis — ±${totalDays} hari untuk ${milestones.length || 1} item, negosiasi ulang.`,
      );
    } else {
      redFlags.push(
        "Klien mendesak deadline — pastikan tanggal pasti + biaya percepatan bila perlu.",
      );
    }
  } else if (totalDays === 0) {
    redFlags.push("Belum ada deadline — sepakati tanggal serah terima.");
  }

  return { scope, milestones, estimate, redFlags };
}

export type CompleteFn = (
  prompt: string,
  ctx?: Parameters<typeof complete>[1],
) => Promise<CompleteResult>;

/**
 * Brief + poles AI bila aktif. `completeFn` injectable untuk test.
 * Selalu resolve struktur valid (fallback = hasil parse murni).
 */
export async function generateBrief(
  chatText: string,
  completeFn: CompleteFn = complete,
): Promise<ProjectBrief> {
  const parsed = parseBrief(chatText);
  const prompt =
    `Susun brief proyek dari chat klien berikut. Jawab HANYA JSON valid ` +
    `{"scope": string, "milestones": [{"title": string}], "estimate": string, ` +
    `"redFlags": string[]}.\n\n${chatText.slice(0, 4000)}`;
  let res: CompleteResult;
  try {
    res = await completeFn(prompt);
  } catch {
    return parsed;
  }
  if (res.stub) return parsed;
  try {
    const json = JSON.parse(
      res.text.replace(/^```json\n?|\n?```$/g, "").trim(),
    ) as Partial<ProjectBrief>;
    if (typeof json.scope !== "string" || !Array.isArray(json.milestones)) {
      return parsed;
    }
    return {
      scope: json.scope || parsed.scope,
      milestones: json.milestones
        .filter((m) => m && typeof m.title === "string" && m.title.trim())
        .slice(0, 8)
        .map((m) => ({ title: m.title.trim() })),
      estimate:
        typeof json.estimate === "string" && json.estimate
          ? json.estimate
          : parsed.estimate,
      redFlags: Array.isArray(json.redFlags)
        ? json.redFlags.filter((f): f is string => typeof f === "string")
        : parsed.redFlags,
    };
  } catch {
    return parsed;
  }
}
