import { Xendit, Invoice } from "xendit-node";
import { PaymentGatewayStrategy } from "./constants";
import { XenditChargeInvoiceInput, type XenditPaymentResult } from "@/schemas";

/**
 * Seconds from `now` until `due_date`, clamped to a minimum of 60s so a
 * past-due or imminent deadline never sends 0/negative to Xendit.
 * Falls back to 24h when no usable due date is provided.
 */
export function xenditDurationFor(
  due_date?: Date | string | number | null,
  now: Date = new Date(),
): number {
  const fallback = 24 * 3600;
  if (due_date == null) return fallback;
  const due = due_date instanceof Date ? due_date : new Date(due_date);
  if (Number.isNaN(due.getTime())) return fallback;
  return Math.max(60, Math.ceil((due.getTime() - now.getTime()) / 1000));
}

export class XenditStrategy implements PaymentGatewayStrategy {
  private readonly xenditInvoiceClient: Invoice;

  constructor() {
    const secretKey = process.env.XENDIT_SECRET_KEY;

    if (!secretKey) {
      throw new Error("XENDIT_SECRET_KEY is not configured");
    }

    const client = new Xendit({ secretKey });
    this.xenditInvoiceClient = client.Invoice;
  }

  async chargeInvoice(
    input: XenditChargeInvoiceInput,
  ): Promise<XenditPaymentResult> {
    try {
      const currency = (input.currency ?? "USD").toUpperCase();
      const amount = this.formatAmount(input.amount);
      const invoiceTitle = input.title?.trim() || `Invoice #${input.id}`;
      const externalId = input.id ?? "";

      const invoice = await this.xenditInvoiceClient.createInvoice({
        data: {
          externalId,
          amount: amount,
          currency: currency,
          payerEmail: input.payerEmail || undefined,
          description: invoiceTitle,
          invoiceDuration: xenditDurationFor(input.due_date),
          items: [
            {
              name: invoiceTitle,
              quantity: 1,
              price: amount,
            },
          ],
          metadata: {
            invoiceId: input.id ?? "",
            projectId: input.project_id ?? "",
          },
        },
      });

      return {
        success: true,
        providerTxId: invoice.id,
        checkoutUrl: invoice.invoiceUrl,
        redirectUrl: invoice.invoiceUrl,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Xendit error";
      return {
        success: false,
        errorMessage: `Failed to create Xendit invoice: ${message}`,
      };
    }
  }

  private formatAmount(
    amount: bigint | number | string | null | undefined,
  ): number {
    if (amount == null) {
      throw new Error("Invoice amount is required");
    }

    const normalized =
      typeof amount === "bigint" ? amount.toString() : String(amount);

    if (!/^\d+$/.test(normalized)) {
      throw new Error("Invoice amount must be a non-negative integer");
    }

    // Xendit expects amount in the smallest unit (cents for most currencies)
    return parseInt(normalized, 10);
  }
}
