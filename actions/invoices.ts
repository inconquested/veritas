"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  ChargeInvoiceInput,
  ChargeInvoiceSchema,
  CreateInvoiceInput,
  CreateInvoiceSchema,
  UpdateInvoiceInput,
  UpdateInvoiceSchema,
} from "@/schemas";
import { client } from "@/lib/api-client";
import { validateWithTranslation } from "@/lib/utils";

async function apiInit() {
  return { headers: { cookie: (await cookies()).toString() } };
}

async function apiFailure(response: Response, fallback: string) {
  if (response.headers.get("content-type")?.includes("application/json")) {
    const body = (await response.json()) as { errorKey?: string };
    return body.errorKey ?? fallback;
  }

  return `${fallback}_${response.status}`;
}

export async function createInvoice(raw: unknown) {
  const t = await getTranslations("errors");
  const valid = validateWithTranslation<CreateInvoiceInput>(
    CreateInvoiceSchema,
    raw,
    t,
  );

  if (!valid.success) {
    return { success: false, errors: valid.errors };
  }

  const payload: CreateInvoiceInput = valid.data!;
  const response = await (client as any).api.v1.invoices.$post(
    { json: payload },
    await apiInit(),
  );

  if (!response.ok) {
    return {
      success: false,
      errorKey: await apiFailure(response, "errors.invoice.creation_failed"),
    };
  }

  const resBody = (await response.json()) as { data?: unknown };
  revalidatePath("/invoices");
  return { success: true, data: resBody.data };
}

export async function chargeInvoice(raw: unknown, invoiceId: string) {
  const t = await getTranslations("errors");
  const valid = validateWithTranslation<ChargeInvoiceInput>(
    ChargeInvoiceSchema,
    raw,
    t,
  );
  if (!valid.success) {
    return { success: false, errors: valid.errors };
  }

  const payload: ChargeInvoiceInput = valid.data!;
  const response = await (client as any).api.v1.invoices[":id"].charge.$post(
    {
      param: { id: invoiceId },
      json: payload,
    },
    await apiInit(),
  );

  if (!response.ok) {
    if (response.headers.get("content-type")?.includes("application/json")) {
      const resBody = (await response.json()) as {
        errorKey?: string;
        data?: { errorMessage?: string };
      };
      return {
        success: false,
        errorKey: resBody.errorKey ?? "errors.invoice.charge_failed",
        data: resBody.data,
      };
    }
    return {
      success: false,
      errorKey: `errors.invoice.charge_failed_${response.status}`,
    };
  }

  const resBody = (await response.json()) as { data?: unknown };
  revalidatePath("/invoices");
  return { success: true, data: resBody.data };
}

export async function updateInvoice(raw: unknown, invoiceId: string) {
  const t = await getTranslations("errors");
  const valid = validateWithTranslation<UpdateInvoiceInput>(
    UpdateInvoiceSchema,
    raw,
    t,
  );
  if (!valid.success) {
    return { success: false, errors: valid.errors };
  }

  const payload: UpdateInvoiceInput = valid.data!;
  const response = await (client as any).api.v1.invoices[":id"].$put(
    {
      param: { id: invoiceId },
      json: payload,
    },
    await apiInit(),
  );

  if (!response.ok) {
    return {
      success: false,
      errorKey: await apiFailure(response, "errors.invoice.update_failed"),
    };
  }

  const resBody = (await response.json()) as { data?: unknown };
  revalidatePath("/invoices");
  return { success: true, data: resBody.data };
}

export async function getInvoice(invoiceId: string) {
  const response = await (client as any).api.v1.invoices[":id"].$get(
    {
      param: { id: invoiceId },
    },
    await apiInit(),
  );

  if (!response.ok) {
    return {
      success: false,
      errorKey: await apiFailure(response, "errors.notExist"),
    };
  }

  const resBody = (await response.json()) as { data?: unknown };
  return { success: true, invoice: resBody.data };
}

export async function listInvoices(projectId?: string) {
  const response = await (client as any).api.v1.invoices.$get(
    {
      query: projectId ? { projectId } : undefined,
    },
    await apiInit(),
  );

  if (!response.ok) {
    return {
      success: false,
      errorKey: await apiFailure(response, "errors.invoices.fetch_failed"),
    };
  }

  const resBody = (await response.json()) as { data?: unknown };
  return { success: true, invoices: resBody.data };
}

export async function deleteInvoice(invoiceId: string) {
  const response = await (client as any).api.v1.invoices[":id"].$delete(
    {
      param: { id: invoiceId },
    },
    await apiInit(),
  );

  if (!response.ok) {
    return {
      success: false,
      errorKey: await apiFailure(response, "errors.invoice.delete_failed"),
    };
  }

  const resBody = (await response.json()) as { success?: boolean };
  return { success: resBody.success ?? true };
}
