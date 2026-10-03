/**
 * F7 multi-currency DISPLAY (tanpa ubah strategi charge — charge tetap IDR
 * di gateway). Pure functions; komponen di lib/fx-line.tsx.
 */
export function formatMoney(
  amount: number | bigint | string,
  currency = "IDR",
  locale = "id-ID",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${String(amount)}`;
  }
}

/** Konversi memakai kurs `rate` (1 unit currency = rate unit displayCurrency). */
export function convertAmount(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export type FxQuoteInput = {
  amount: number;
  currency?: string;
  displayCurrency: string;
  /** Kurs: 1 currency = rate displayCurrency. */
  rate: number;
  /** Fee gateway/platform dalam persen, ditampilkan eksplisit. */
  feePct?: number;
  locale?: string;
};

export type FxQuote = {
  baseLabel: string;
  converted: number;
  convertedLabel: string;
  fee: number;
  feeLabel: string;
  total: number;
  totalLabel: string;
  rateLabel: string;
};

/** Hitung tampilan invoice: nominal terkonversi + fee eksplisit + total. */
export function invoiceFxDisplay(q: FxQuoteInput): FxQuote {
  const currency = q.currency ?? "IDR";
  const feePct = q.feePct ?? 0;
  const locale = q.locale ?? "id-ID";
  const converted = convertAmount(q.amount, q.rate);
  const fee = Math.round(converted * (feePct / 100) * 100) / 100;
  const total = Math.round((converted + fee) * 100) / 100;
  return {
    baseLabel: formatMoney(q.amount, currency, locale),
    converted,
    convertedLabel: formatMoney(converted, q.displayCurrency, locale),
    fee,
    feeLabel: formatMoney(fee, q.displayCurrency, locale),
    total,
    totalLabel: formatMoney(total, q.displayCurrency, locale),
    rateLabel: `Kurs: 1 ${currency} = ${formatMoney(q.rate, q.displayCurrency, locale)} (${q.displayCurrency})`,
  };
}
