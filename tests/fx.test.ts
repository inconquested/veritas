import assert from "node:assert/strict";
import test from "node:test";

import { convertAmount, formatMoney, invoiceFxDisplay } from "../lib/fx";

test("formatMoney IDR tanpa desimal", () => {
  const s = formatMoney(1_500_000, "IDR");
  assert.ok(s.includes("1.500.000"), s);
});

test("formatMoney USD en-US 2 desimal", () => {
  assert.equal(formatMoney(1500, "USD", "en-US"), "$1,500.00");
});

test("formatMoney currency tak dikenal = fallback tanpa throw", () => {
  const s = formatMoney(100, "XXX-NOT-A-CCY");
  assert.ok(s.includes("XXX-NOT-A-CCY"), s);
});

test("convertAmount: kali kurs + pembulatan 2 desimal", () => {
  assert.equal(convertAmount(100, 15800), 1_580_000);
  assert.equal(convertAmount(10, 0.333), 3.33);
});

test("invoiceFxDisplay: konversi + fee eksplisit + total + label kurs", () => {
  const q = invoiceFxDisplay({
    amount: 100,
    currency: "USD",
    displayCurrency: "IDR",
    rate: 15800,
    feePct: 2,
  });
  assert.equal(q.converted, 1_580_000);
  assert.equal(q.fee, 31600);
  assert.equal(q.total, 1_611_600);
  assert.ok(q.rateLabel.includes("Kurs"), q.rateLabel);
  assert.ok(q.rateLabel.includes("USD") && q.rateLabel.includes("IDR"), q.rateLabel);
  assert.ok(q.totalLabel.includes("1.611.600"), q.totalLabel);
});

test("invoiceFxDisplay: tanpa fee = total sama dengan konversi", () => {
  const q = invoiceFxDisplay({ amount: 50, currency: "USD", displayCurrency: "IDR", rate: 16000 });
  assert.equal(q.fee, 0);
  assert.equal(q.total, q.converted);
});
