import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PaymentGatewayStrategy } from "./vendor/payment/constants";
import {
  ChargeInvoiceInput,
  InvoiceResultSchema,
  PaymentResult,
} from "@/schemas";
import { StripeStrategy } from "./vendor/payment/stripe-strategy";
import { PaypalStrategy } from "./vendor/payment/paypal-strategy";
import { XenditStrategy } from "./vendor/payment/xendit-strategy";
import { MidtransStrategy } from "./vendor/payment/midtrans-strategy";

const invoiceInclude = {
  project: {
    select: {
      id: true,
      title: true,
      client: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          instanceName: true,
        },
      },
    },
  },
};

function clientName(project: {
  client?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    instanceName?: string | null;
  } | null;
}) {
  const client = project.client;
  return (
    [client?.firstName, client?.lastName].filter(Boolean).join(" ") ||
    client?.instanceName ||
    client?.email ||
    "Client"
  );
}

export class InvoiceService {
  public constructor(
    private readonly defaultPaymentMethod = "STRIPE",
    private readonly db: typeof prisma = prisma,
  ) {}

  public getStrategyForInvoice(
    input: Partial<ChargeInvoiceInput>,
  ): PaymentGatewayStrategy {
    return InvoiceService.getStrategyByPaymentMethod(
      input.payment_method ?? this.defaultPaymentMethod,
    );
  }

  public async chargeInvoice(
    input: ChargeInvoiceInput,
  ): Promise<PaymentResult> {
    if (!input.id) {
      return {
        success: false,
        errorMessage: "Invoice ID is required",
      };
    }

    try {
      const storedInvoice = await this.db.invoice.findUnique({
        where: { id: input.id },
      });
      const resolvedInput: ChargeInvoiceInput = {
        ...input,
        project_id: input.project_id ?? storedInvoice?.project_id,
        payment_method:
          input.payment_method ??
          (storedInvoice?.payment_method as
            ChargeInvoiceInput["payment_method"] | undefined),
      };

      if (!resolvedInput.project_id) {
        return {
          success: false,
          errorMessage: "Invoice project ID is required",
        };
      }

      const strategy = this.getStrategyForInvoice(resolvedInput);
      const paymentResult = await strategy.chargeInvoice(resolvedInput);

      if (paymentResult.success && paymentResult.providerTxId) {
        try {
          await this.db.invoice.update({
            where: { id: input.id },
            data: {
              providerTxId: paymentResult.providerTxId,
              status: "SENT",
            },
          });
        } catch (dbError) {
          console.error("CRITICAL: Gateway charge succeeded but DB update failed", {
            invoiceId: input.id,
            providerTxId: paymentResult.providerTxId,
            error: dbError instanceof Error ? dbError.message : String(dbError),
          });
        }
      }

      return paymentResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        errorMessage: `Failed to charge invoice: ${message}`,
      };
    }
  }

  public static getStrategyByPaymentMethod(
    paymentMethod: string,
  ): PaymentGatewayStrategy {
    switch (paymentMethod.toUpperCase()) {
      case "STRIPE":
        return new StripeStrategy();
      case "PAYPAL":
        return new PaypalStrategy();
      case "XENDIT":
        return new XenditStrategy();
      case "MIDTRANS":
        return new MidtransStrategy();
      default:
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
    }
  }

  public async createInvoice(input: Omit<ChargeInvoiceInput, "id">) {
    if (
      !input.project_id ||
      !input.title ||
      !input.currency ||
      input.amount === undefined ||
      !input.payment_method ||
      !input.due_date
    ) {
      throw new Error(
        "Required fields missing: project_id, title, currency, amount, payment_method, due_date",
      );
    }

    const [project, clerkUser] = await Promise.all([
      this.db.project.findUnique({
        where: { id: input.project_id },
        select: invoiceInclude.project.select,
      }),
      currentUser(),
    ]);

    const freelancer = clerkUser
      ? await this.db.freelancerProfile.findFirst({
          where: { user: { clerkUserId: clerkUser.id } },
          select: { id: true },
        })
      : null;

    if (!project || !freelancer) {
      throw new Error("errors.invoice.creation_failed");
    }

    const invoice = await this.db.invoice.create({
      data: {
        project_id: input.project_id,
        freelancerId: freelancer.id,
        clientName: clientName(project),
        title: input.title,
        notes: input.notes ?? null,
        currency: input.currency as any,
        amount: BigInt(input.amount),
        payment_method: input.payment_method as any,
        status: input.status ?? "DRAFT",
        due_date: new Date(input.due_date),
      },
    });

    return InvoiceResultSchema.parse({
      ...invoice,
      created_at: invoice.createdAt,
      updated_at: invoice.createdAt,
    });
  }

  public async getInvoice(invoiceId: string) {
    const invoice = await this.db.invoice.findUnique({
      where: { id: invoiceId },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    return invoice;
  }

  public async getInvoices(
    limit = 10,
    scope?: Prisma.InvoiceWhereInput,
  ) {
    return this.db.invoice.findMany({
      where: scope,
      take: Math.max(1, Math.min(limit, 100)),
      orderBy: { createdAt: "desc" },
      include: invoiceInclude,
    });
  }

  public async getProjectInvoices(
    projectId: string,
    scope?: Prisma.InvoiceWhereInput,
  ) {
    return this.db.invoice.findMany({
      where: { project_id: projectId, ...scope },
      orderBy: { createdAt: "desc" },
      include: invoiceInclude,
    });
  }

  public async updateInvoice(
    invoiceId: string,
    input: Partial<ChargeInvoiceInput>,
  ) {
    const updateData: any = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.notes !== undefined) updateData.notes = input.notes ?? null;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.amount !== undefined) updateData.amount = BigInt(input.amount);
    if (input.payment_method !== undefined)
      updateData.payment_method = input.payment_method;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.due_date !== undefined)
      updateData.due_date = new Date(input.due_date);
    if (input.project_id !== undefined)
      updateData.project_id = input.project_id;

    const invoice = await this.db.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    return InvoiceResultSchema.parse({
      ...invoice,
      created_at: invoice.createdAt,
      updated_at: invoice.createdAt,
    });
  }

  public async deleteInvoice(invoiceId: string): Promise<boolean> {
    const result = await this.db.invoice.delete({
      where: { id: invoiceId },
    });

    return !!result;
  }
}

export const invoiceService = new InvoiceService();
