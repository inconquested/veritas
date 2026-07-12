import { PaypalChargeInvoiceInput, PaypalPaymentResult } from "@/schemas";
import { PaymentGatewayStrategy } from "./constants";
import { formatInvoiceDate } from "@/lib/utils";

export class PaypalStrategy implements PaymentGatewayStrategy {
  private readonly PAYPAL_CLIENT_ID: string;
  private readonly PAYPAL_CLIENT_SECRET: string;
  private readonly PAYPAL_API_BASE_URL: string;

  constructor() {
    this.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
    this.PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
    this.PAYPAL_API_BASE_URL =
      process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";

    if (!this.PAYPAL_CLIENT_ID || !this.PAYPAL_CLIENT_SECRET) {
      throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required");
    }
  }

  private async getPaypalAuthToken(): Promise<string> {
    const auth = Buffer.from(
      `${this.PAYPAL_CLIENT_ID}:${this.PAYPAL_CLIENT_SECRET}`,
    ).toString("base64");
    try {
      const response = await fetch(
        `${this.PAYPAL_API_BASE_URL}/v1/oauth2/token`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "grant_type=client_credentials",
        },
      );

      if (!response.ok) {
        throw new Error(`PayPal auth failed: ${response.status}`);
      }

      const data = (await response.json()) as { access_token: string };
      return data.access_token;
    } catch (error) {
      throw new Error(
        `Failed to retrieve PayPal authentication token: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async chargeInvoice(input: PaypalChargeInvoiceInput): Promise<PaypalPaymentResult> {
    try {
      const accessToken = await this.getPaypalAuthToken();
      const invoiceTitle = input.title?.trim() || `Invoice #${input.id}`;
      const currency = (input.currency ?? "USD").toUpperCase();
      const amount = this.formatAmount(input.amount);
      const baseUrl = this.getBaseUrl();

      const response = await fetch(
        `${this.PAYPAL_API_BASE_URL}/v2/invoicing/invoices`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            detail:{
              invoice_number: input.id ?? crypto.randomUUID(),
              currency_code: currency,
              note: invoiceTitle,
              payment_term:{
                term_type: "DUE_ON_DATE_SPECIFIED",
                due_date: formatInvoiceDate(input.due_date ?? new Date()),
              }
            },
            invoicer:{
              
            }
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`PayPal order creation failed: ${response.status}`);
      }

      const order = (await response.json()) as {
        id: string;
        links: Array<{ rel: string; href: string }>;
      };

      const approvalLink = order.links.find(
        (link) => link.rel === "approve",
      )?.href;

      return {
        success: true,
        providerTxId: order.id,
        checkoutUrl: approvalLink,
        redirectUrl: approvalLink,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown PayPal error";
      return {
        success: false,
        errorMessage: `Failed to create PayPal order: ${message}`,
      };
    }
  }

  private formatAmount(
    amount: bigint | number | string | null | undefined,
  ): string {
    if (amount == null) {
      throw new Error("Invoice amount is required");
    }

    const normalized =
      typeof amount === "bigint" ? amount.toString() : String(amount);

    if (!/^\d+$/.test(normalized)) {
      throw new Error("Invoice amount must be a non-negative integer");
    }

    const cents = parseInt(normalized, 10);
    const dollars = (cents / 100).toFixed(2);
    return dollars;
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
