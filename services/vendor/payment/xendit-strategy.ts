import { Xendit, Invoice } from "xendit-node";
import { PaymentGatewayStrategy } from "./constants";
import { XenditChargeInvoiceInput, type XenditPaymentResult } from "@/schemas";

export class XenditStrategy implements PaymentGatewayStrategy {
  private readonly xenditClient: any;
  private readonly xenditInvoiceClient: Invoice;

  constructor() {
    const secretKey = process.env.XENDIT_SECRET_KEY;

    if (!secretKey) {
      throw new Error("XENDIT_SECRET_KEY is not configured");
    }

    this.xenditClient = new Xendit({ secretKey });
    this.xenditInvoiceClient = this.xenditClient.Invoice;
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
          invoiceDuration: 10 * 60, // 10 minutes
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
