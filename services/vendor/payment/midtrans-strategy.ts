import { Snap, SnapTransactionParameters } from "midtrans-client";
import { PaymentGatewayStrategy } from "./constants";
import {
  MidtransChargeInvoiceInput,
  type MidtransPaymentResult,
} from "@/schemas";

type FlexibleSnapParameters = SnapTransactionParameters & Record<string, any>;

export class MidtransStrategy implements PaymentGatewayStrategy {
  private readonly snapClient: Snap;

  constructor() {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const clientKey = process.env.MIDTRANS_CLIENT_KEY;

    if (!serverKey || !clientKey) {
      throw new Error(
        "MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY are required",
      );
    }

    this.snapClient = new Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
      serverKey: serverKey,
      clientKey: clientKey,
    });
  }

  async chargeInvoice(
    input: MidtransChargeInvoiceInput,
  ): Promise<MidtransPaymentResult> {
    try {
      const currency = (input.currency ?? "USD").toUpperCase();
      const amount = this.formatAmount(input.amount);
      const invoiceTitle = input.title?.trim() || `Invoice #${input.id}`;
      const orderId = this.resolveOrderId(input);
      const destinationAccountId = this.resolveDestinationAccountId(input);

      // Change the type declaration to the flexible version here
      const parameter: FlexibleSnapParameters = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount,
        },
        item_details: [
          {
            id: input.id ?? "",
            price: amount,
            quantity: 1,
            name: invoiceTitle,
          },
        ],
        custom_field1: input.project_id ?? "",
        expiry: this.DuedateToExpiry(input.due_date),
      };

      if (destinationAccountId) {
        parameter.custom_field2 = destinationAccountId;
      }

      if (currency) {
        parameter.custom_field3 = currency;
      }

      const snapResponse = await this.snapClient.createTransaction(parameter);

      return {
        success: true,
        providerTxId: orderId,
        redirectUrl: snapResponse.redirect_url,
        checkoutUrl: snapResponse.redirect_url,
        destinationAccountId,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Midtrans error";
      return {
        success: false,
        errorMessage: `Failed to create Midtrans transaction: ${message}`,
      };
    }
  }

  private resolveOrderId(input: MidtransChargeInvoiceInput): string {
    const providedOrderId = input.midtransOrderId?.trim();
    if (providedOrderId) {
      return providedOrderId;
    }

    const invoiceId = input.id?.trim();
    return invoiceId ? `invoice-${invoiceId}` : `invoice-${Date.now()}`;
  }

  private resolveDestinationAccountId(
    input: MidtransChargeInvoiceInput,
  ): string | undefined {
    const directDestination = input.destination_account_id?.trim();
    if (directDestination) {
      return directDestination;
    }

    const alternateDestination = (
      input as MidtransChargeInvoiceInput & { destinationAccountId?: string }
    ).destinationAccountId?.trim();
    return alternateDestination || undefined;
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

    // Midtrans expects amount in the smallest unit (cents)
    return parseInt(normalized, 10);
  }

  private DuedateToExpiry(date: Date): {
  start_time: string;
  unit: "minutes";
  duration: number;
} {
  const now = new Date();
  const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
  const duration = Math.max(0, Math.ceil(diffInSeconds / 60));

  return {
    start_time: now.toISOString(),
    unit: "minutes",
    duration,
  };
}
}
