/**
 * Redaksi PII sebelum teks dikirim ke API AI eksternal.
 * Pure, tanpa I/O. Dipakai `services/ai/ai-service.ts`.
 *
 * Target: email, nomor WA/telepon Indonesia, nomor rekening bank.
 */

/** Alamat email. */
export const EMAIL_PATTERN =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Kandidat deretan digit panjang (telepon atau rekening). */
const LONG_DIGIT_RUN = /\+?\d[\d .\-]{7,}\d/g;

export type PiiKind = "email" | "phone" | "account";

export const REDACT_LABEL: Record<PiiKind, string> = {
  email: "[email disensor]",
  phone: "[nomor disensor]",
  account: "[rekening disensor]",
};

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Klasifikasikan deretan digit: nomor HP/WA Indonesia vs rekening.
 * - Awalan 08 / +628 / 628 / 62 → phone (format nomor Indonesia).
 * - 0 + 9–14 digit → phone (telepon rumah/kantor).
 * - >= 10 digit tanpa awalan telepon → rekening.
 * - < 9 digit → bukan PII (tahun, nominal kecil, dsb), biarkan.
 */
export function classifyDigitRun(raw: string): PiiKind | null {
  const compact = raw.replace(/[ .\-]/g, "");
  const d = digitsOnly(compact);
  if (d.length < 9) return null;
  if (/^(?:\+?62|0)8/.test(compact)) return "phone";
  if (/^(?:\+?62|0)/.test(compact) && d.length <= 14) return "phone";
  if (d.length >= 10 && d.length <= 20) return "account";
  return null;
}

export interface RedactResult {
  text: string;
  /** Jumlah substitusi per jenis PII. */
  redacted: Record<PiiKind, number>;
}

/** Sensor PII dalam teks bebas. Idempoten untuk teks yang sudah disensor. */
export function redactPII(input: string): RedactResult {
  const redacted: Record<PiiKind, number> = {
    email: 0,
    phone: 0,
    account: 0,
  };
  let text = input.replace(EMAIL_PATTERN, () => {
    redacted.email += 1;
    return REDACT_LABEL.email;
  });
  text = text.replace(LONG_DIGIT_RUN, (m) => {
    const kind = classifyDigitRun(m);
    if (!kind) return m;
    redacted[kind] += 1;
    return REDACT_LABEL[kind];
  });
  return { text, redacted };
}

/** True jika teks masih mengandung PII yang belum disensor. */
export function containsPII(input: string): boolean {
  EMAIL_PATTERN.lastIndex = 0;
  if (EMAIL_PATTERN.test(input)) {
    EMAIL_PATTERN.lastIndex = 0;
    return true;
  }
  LONG_DIGIT_RUN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LONG_DIGIT_RUN.exec(input)) !== null) {
    if (classifyDigitRun(m[0])) {
      LONG_DIGIT_RUN.lastIndex = 0;
      return true;
    }
  }
  LONG_DIGIT_RUN.lastIndex = 0;
  return false;
}
