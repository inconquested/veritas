import {
  type StripeChargeInvoiceInput,
  type StripePaymentResult,
} from "@/schemas";
import Stripe from "stripe";
import type { PaymentGatewayStrategy } from "./constants";

/**
 * Absolute `expires_at` (unix seconds) derived from the invoice due date.
 * Past-due or missing dates clamp to a viable future window so Stripe never
 * receives 0/negative timestamps.
 */
export function stripeExpiresAtFor(
  due_date?: Date | string | number | null,
  now: Date = new Date(),
): number {
  const nowSec = Math.floor(now.getTime() / 1000);
  if (due_date == null) return nowSec + 24 * 3600;
  const due = due_date instanceof Date ? due_date : new Date(due_date);
  if (Number.isNaN(due.getTime())) return nowSec + 24 * 3600;
  const target = Math.floor(due.getTime() / 1000);
  return target > nowSec ? target : nowSec + 30 * 60;
}

export class StripeStrategy implements PaymentGatewayStrategy {
  private readonly stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: "2026-06-24.dahlia",
      appInfo: {
        name: "veritas",
        version: "1.0.0",
      },
    });
  }

  async chargeInvoice(
    input: StripeChargeInvoiceInput,
  ): Promise<StripePaymentResult> {
    try {
      const invoiceTitle = input.title?.trim() || `Invoice #${input.id}`;
      const currency = (input.currency ?? "USD").toLowerCase();
      const amount = this.toMinorUnit(input.amount, currency);
      const baseUrl = this.getBaseUrl();

      const session = await this.stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card", "paypal"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amount,
              product_data: {
                name: invoiceTitle,
                description: `Invoice payment for project ${input.project_id ?? "unknown"}`,
              },
            },
          },
        ],
        success_url: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/payments/cancel?session_id={CHECKOUT_SESSION_ID}`,
        metadata: {
          invoiceId: input.id ?? "",
          projectId: input.project_id ?? "",
        },
        client_reference_id: input.id ?? "",
        expires_at: stripeExpiresAtFor(input.due_date),
        payment_intent_data: input.destination_account_id
          ? {
              application_fee_amount: 0,
              transfer_data: {
                destination: input.destination_account_id,
              },
            }
          : undefined,
      });

      return {
        success: true,
        providerTxId: session.id,
        checkoutUrl: session.url ?? undefined,
        redirectUrl: session.url ?? undefined,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Stripe error";

      return {
        success: false,
        errorMessage: `Failed to charge invoice: ${message}`,
      };
    }
  }

  private toMinorUnit(
    amount: bigint | number | string | null | undefined,
    currency: string,
  ): number {
    if (amount == null) {
      throw new Error("Invoice amount is required");
    }

    const normalized =
      typeof amount === "bigint" ? amount.toString() : String(amount);

    if (!/^\d+$/.test(normalized)) {
      throw new Error(
        `Invoice amount must be a non-negative integer for ${currency}`,
      );
    }

    return Number(normalized);
  }

  private getBaseUrl(): string {
    const configured =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "http://localhost:3000";
    return configured.replace(/\/$/, "");
  }
}
