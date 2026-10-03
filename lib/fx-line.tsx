import { invoiceFxDisplay, type FxQuoteInput } from "./fx";

/** Baris kecil kurs + fee untuk kartu invoice (portal + dashboard). */
export function FxLine(props: FxQuoteInput) {
  const q = invoiceFxDisplay(props);
  return (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      <p>{q.rateLabel}</p>
      <p>
        Fee ({props.feePct ?? 0}%): {q.feeLabel} · Total: {q.totalLabel}
      </p>
    </div>
  );
}
