import { ChargeInvoiceInput, PaymentResult } from "@/schemas";

export interface PaymentGatewayStrategy {
  chargeInvoice(input: ChargeInvoiceInput): Promise<PaymentResult>;
}
