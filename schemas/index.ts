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

// --- Milestone Schemas ---
const CreateMilestoneSchema = z.object({
  project_id: z.uuid({ error: "errors.invalidUuid" }),
  title: z
    .string({ error: "errors.invalidUuid" })
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
  notes: z.string().optional().nullable(),
  currency: z
    .string({ error: "errors.required" })
    .length(3, { error: "errors.required" }),
  amount: z.bigint({ error: "errors.required" }),
  payment_method: InvoicePaymentMethodSchema,
  status: InvoiceStatusSchema.optional(),
  due_date: z.date({ error: "errors.required" }),
});

export const ChargeInvoiceSchema = CreateInvoiceSchema.partial().extend({
  id: z.uuid({ error: "errors.invalidUuid" }),
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
  title: z.string({ error: "errors.invalidUuid" }),
  notes: z.string().optional().nullable(),
  currency: z.string({ error: "errors.invalidUuid" }),
  amount: z.bigint({ error: "errors.invalidUuid" }),
  payment_method: InvoicePaymentMethodSchema,
  status: InvoiceStatusSchema,
  due_date: z.date({ error: "errors.invalidUuid" }),
  created_at: z.date({ error: "errors.invalidUuid" }),
  updated_at: z.date({ error: "errors.invalidUuid" }),
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
