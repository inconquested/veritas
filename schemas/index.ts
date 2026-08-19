import { z } from "zod";

const ProjectStatusSchema = z.enum([
  "ONBOARDING",
  "RESEARCH",
  "MODELLING",
  "DEPLOYMENT",
  "MAINTENANCE",
  "COMPLETED",
  "CANCELLED",
]);

const InvoicePaymentMethodSchema = z.enum([
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "STRIPE",
  "PAYPAL",
  "CASH",
  "OTHER",
  "XENDIT",
  "MIDTRANS",
]);

const InvoiceStatusSchema = z.enum([
  "DRAFT",
  "SENT",
  "PAID",
  "OVERDUE",
  "REFUNDED",
]);

const InvoiceCurrencySchema = z.enum([
  "USD",
  "IDR",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CNY",
  "KRW",
  "INR",
]);

// Money is stored as a BigInt (minor-unit-free integer) but arrives over JSON as
// a string or number — JSON has no bigint. Coerce every transport form to a
// non-negative bigint so both the client action and the API validate identically.
const AmountSchema = z
  .union([z.bigint(), z.number(), z.string()])
  .transform((value, ctx) => {
    try {
      const normalized =
        typeof value === "bigint"
          ? value
          : typeof value === "number"
            ? BigInt(Math.trunc(value))
            : BigInt(value.trim());
      if (normalized < 0n) {
        ctx.addIssue({ code: "custom", message: "errors.required" });
        return z.NEVER;
      }
      return normalized;
    } catch {
      ctx.addIssue({ code: "custom", message: "errors.required" });
      return z.NEVER;
    }
  });

// Dates arrive as ISO strings over JSON or as Date from a server action. Accept
// both and normalize to a valid Date; reject anything unparseable.
const DueDateSchema = z
  .union([z.date(), z.string(), z.number()])
  .transform((value, ctx) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "errors.required" });
      return z.NEVER;
    }
    return date;
  });

// --- Milestone Schemas ---
const CreateMilestoneSchema = z.object({
  project_id: z.uuid({ error: "errors.invalidUuid" }),
  title: z
    .string({ error: "errors.required" })
    .min(1, { error: "errors.required" })
    .max(255),
  description: z.string().optional().nullable(),
  due_date: z.iso.datetime().or(z.date()),
});
const CreateProjectMilestoneSchema = CreateMilestoneSchema.omit({
  project_id: true,
});
export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;

const UpdateMilestoneSchema = CreateMilestoneSchema.partial().extend({
  project_id: z.uuid({ error: "errors.invalidUuid" }),
  id: z.uuid({ error: "errors.invalidUuid" }),
});
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;

// --- Invoice Schemas ---
export const CreateInvoiceSchema = z.object({
  project_id: z.uuid({ error: "errors.required" }),
  title: z
    .string({ error: "errors.required" })
    .min(1, { error: "errors.required" })
    .max(255),
  notes: z.string().max(2000).optional().nullable(),
  currency: InvoiceCurrencySchema,
  amount: AmountSchema,
  payment_method: InvoicePaymentMethodSchema,
  status: InvoiceStatusSchema.optional(),
  due_date: DueDateSchema,
});

export const ChargeInvoiceSchema = CreateInvoiceSchema.partial().extend({
  id: z.uuid({ error: "errors.invalidUuid" }),
  // Gateway routing fields the charge dialog sends. Kept here so the schema
  // doesn't silently strip them before they reach the payment strategy.
  destination_account_id: z.string().max(255).optional(),
  payerEmail: z.email({ error: "errors.invalidEmail" }).optional(),
  stripeCustomerId: z.string().optional(),
  stripePaymentMethodId: z.string().optional(),
});
export type ChargeInvoiceInput = z.infer<typeof ChargeInvoiceSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

// --- Payment Gateway Specific Input Schemas ---
const StripeChargeInvoiceInputSchema = CreateInvoiceSchema.extend({
  id: z.uuid({ error: "errors.invalidUuid" }),
  stripeCustomerId: z.string().optional(),
  stripePaymentMethodId: z.string().optional(),
  destination_account_id: z.string().optional(),
  stripePaymentIntentId: z.string().optional(),
});
export type StripeChargeInvoiceInput = z.infer<
  typeof StripeChargeInvoiceInputSchema
>;

const PaypalChargeInvoiceInputSchema = CreateInvoiceSchema.extend({
  id: z.uuid({ error: "errors.invalidUuid" }),
  paypalCustomerId: z.string().optional(),
  paypalPaymentId: z.string().optional(),
});
export type PaypalChargeInvoiceInput = z.infer<
  typeof PaypalChargeInvoiceInputSchema
>;

const XenditChargeInvoiceInputSchema = CreateInvoiceSchema.extend({
  id: z.uuid({ error: "errors.invalidUuid" }),
  payerEmail: z.email({ error: "errors.invalidEmail" }).optional(),
  xenditCustomerId: z.string().optional(),
  xenditInvoiceId: z.string().optional(),
});
export type XenditChargeInvoiceInput = z.infer<
  typeof XenditChargeInvoiceInputSchema
>;

const MidtransChargeInvoiceInputSchema = CreateInvoiceSchema.extend({
  id: z.uuid({ error: "errors.invalidUuid" }),
  midtransOrderId: z.string().optional(),
  midtransCustomerId: z.string().optional(),
  destination_account_id: z.string().optional(),
});
export type MidtransChargeInvoiceInput = z.infer<
  typeof MidtransChargeInvoiceInputSchema
>;

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial().extend({
  project_id: z.uuid({ error: "errors.invalidUuid" }),
  id: z.uuid({ error: "errors.invalidUuid" }),
});
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;

// --- Invoice Result Schemas ---
export const InvoiceResultSchema = z.object({
  id: z.uuid({ error: "errors.invalidUuid" }),
  project_id: z.uuid({ error: "errors.invalidUuid" }),
  title: z.string({ error: "errors.required" }),
  notes: z.string().optional().nullable(),
  currency: z.string({ error: "errors.required" }),
  amount: z.bigint({ error: "errors.required" }),
  payment_method: InvoicePaymentMethodSchema,
  status: InvoiceStatusSchema,
  due_date: z.date({ error: "errors.required" }),
  created_at: z.date({ error: "errors.required" }),
  updated_at: z.date({ error: "errors.required" }),
});
export type InvoiceResult = z.infer<typeof InvoiceResultSchema>;

// --- Payment Result Schemas ---
export const PaymentResultSchema = z.object({
  success: z.boolean(),
  providerTxId: z.string().optional(),
  checkoutUrl: z.url().optional(),
  redirectUrl: z.url().optional(),
  errorMessage: z.string().optional(),
  destinationAccountId: z.string().optional(),
});

export const StripePaymentResultSchema = PaymentResultSchema.extend({
  sessionId: z.string().optional(),
  customerId: z.string().optional(),
  paymentIntentId: z.string().optional(),
});
export type StripePaymentResult = z.infer<typeof StripePaymentResultSchema>;

export const PaypalPaymentResultSchema = PaymentResultSchema.extend({
  orderId: z.string().optional(),
  customerId: z.string().optional(),
  paymentId: z.string().optional(),
});
export type PaypalPaymentResult = z.infer<typeof PaypalPaymentResultSchema>;

export const XenditPaymentResultSchema = PaymentResultSchema.extend({
  invoiceId: z.string().optional(),
  externalId: z.string().optional(),
  customerId: z.string().optional(),
});
export type XenditPaymentResult = z.infer<typeof XenditPaymentResultSchema>;

export const MidtransPaymentResultSchema = PaymentResultSchema.extend({
  orderId: z.string().optional(),
  customerId: z.string().optional(),
  snapToken: z.string().optional(),
});
export type MidtransPaymentResult = z.infer<typeof MidtransPaymentResultSchema>;

export type PaymentResult =
  | MidtransPaymentResult
  | XenditPaymentResult
  | PaypalPaymentResult
  | StripePaymentResult
  | z.infer<typeof PaymentResultSchema>;

// --- Escrow Schemas ---
export const EscrowStateSchema = z.enum([
  "INITIALIZED",
  "FUNDS_HELD",
  "DISPUTED",
  "RELEASED",
  "REFUNDED",
]);
export type EscrowState = z.infer<typeof EscrowStateSchema>;

// Actions a signed-in user (client/freelancer) may trigger from the UI.
export const EscrowManualActionSchema = z.enum(["release", "dispute", "refund"]);
export type EscrowManualAction = z.infer<typeof EscrowManualActionSchema>;

// Body for a manual escrow action. idempotencyKey is optional — the server
// mints one when absent, but callers should send a stable key on retries.
export const EscrowActionInputSchema = z.object({
  idempotencyKey: z.string().min(8).max(200).optional(),
  reason: z.string().max(1000).optional(),
});
export type EscrowActionInput = z.infer<typeof EscrowActionInputSchema>;

// Incoming gateway webhook. Strict bounds so malformed/oversized payloads are
// rejected before they reach the state machine.
export const EscrowWebhookSchema = z.object({
  eventId: z.string().min(1).max(200),
  invoiceId: z.uuid({ error: "errors.invalidUuid" }),
  type: z.enum([
    "payment.captured",
    "payment.settled",
    "payment.refunded",
    "charge.disputed",
  ]),
  provider: z.string().max(50).optional(),
  amount: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
});
export type EscrowWebhookInput = z.infer<typeof EscrowWebhookSchema>;

// Webhook event type -> escrow transition.
export const WEBHOOK_ACTION: Record<
  EscrowWebhookInput["type"],
  "fund" | "refund" | "dispute"
> = {
  "payment.captured": "fund",
  "payment.settled": "fund",
  "payment.refunded": "refund",
  "charge.disputed": "dispute",
};

// --- Handsout Schemas ---
const CreateHandsoutSchema = z.object({
  project_id: z.uuid({ error: "errors.required" }),
  title: z
    .string({ error: "errors.required" })
    .min(1, { error: "errors.required" })
    .max(255),
  description: z.string().optional().nullable(),
  content_url: z.string().max(255).optional().nullable(),
  thumb_url: z.string().max(255).optional().nullable(),
});
export type CreateHandsoutInput = z.infer<typeof CreateHandsoutSchema>;

const UpdateHandsoutSchema = CreateHandsoutSchema.partial().extend({
  project_id: z.uuid({ error: "errors.invalidUuid" }),
  id: z.uuid({ error: "errors.invalidUuid" }),
});
export type UpdateHandsoutInput = z.infer<typeof UpdateHandsoutSchema>;

// --- Project Schemas ---
export const CreateProjectSchema = z.object({
  title: z.string().min(1, { error: "errors.required" }).max(255),
  slug: z.string().min(1, { error: "errors.required" }),
  description: z.string().optional().nullable(),
  status: ProjectStatusSchema.optional(),
  thumb_url: z.string().max(255).optional().nullable(),
  thumb_file: z.instanceof(File).optional().nullable(),
  freelancer_id: z.uuid().optional(),
  client_id: z.uuid().optional(),
  brief_image_files: z.array(z.instanceof(File)).optional(),

  //Optional fields
  milestones: z.array(CreateProjectMilestoneSchema).optional().nullable(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  milestones: z
    .array(
      CreateProjectMilestoneSchema.extend({
        id: z.uuid({ error: "errors.invalidUuid" }).optional(),
      }),
    )
    .optional()
    .nullable(),

  handsouts: z
    .array(
      CreateHandsoutSchema.extend({
        id: z.uuid({ error: "errors.invalidUuid" }).optional(),
      }),
    )
    .optional()
    .nullable(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
