"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { client } from "@/lib/api-client";
import { EscrowManualActionSchema, type EscrowManualAction } from "@/schemas";
import {
  guardAction,
  timeoutSignal,
  TIMEOUT_ERROR_KEY,
} from "@/lib/action-timeout";

async function apiInit() {
  return {
    headers: { cookie: (await cookies()).toString() },
    init: { signal: timeoutSignal() },
  };
}

async function readError(response: Response, fallback: string) {
  if (response.headers.get("content-type")?.includes("application/json")) {
    const body = (await response.json()) as { errorKey?: string; message?: string };
    return { errorKey: body.errorKey ?? fallback, message: body.message };
  }
  return { errorKey: `${fallback}_${response.status}` };
}

export async function getEscrowState(invoiceId: string) {
  return guardAction(
    async () => {
      const response = await (client as any).api.v1.escrow[":invoiceId"].$get(
        { param: { invoiceId } },
        await apiInit(),
      );
      if (!response.ok) {
        return { success: false, ...(await readError(response, "errors.escrow.failed")) };
      }
      const body = (await response.json()) as { data?: unknown };
      return { success: true, escrow: body.data };
    },
    ({ timedOut }) => ({
      success: false,
      errorKey: timedOut ? TIMEOUT_ERROR_KEY : "errors.escrow.failed",
    }),
  );
}

export async function initializeEscrow(invoiceId: string) {
  return guardAction(
    async () => {
      const response = await (client as any).api.v1.escrow[":invoiceId"].initialize.$post(
        { param: { invoiceId }, json: {} },
        await apiInit(),
      );
      if (!response.ok) {
        return { success: false, ...(await readError(response, "errors.escrow.failed")) };
      }
      const body = (await response.json()) as { data?: unknown };
      revalidatePath(`/client/invoices/${invoiceId}`);
      revalidatePath(`/freelancer/projects`);
      return { success: true, data: body.data };
    },
    ({ timedOut }) => ({
      success: false,
      errorKey: timedOut ? TIMEOUT_ERROR_KEY : "errors.escrow.failed",
    }),
  );
}

export async function escrowAction(action: EscrowManualAction, invoiceId: string, reason?: string) {
  const valid = EscrowManualActionSchema.safeParse(action);
  if (!valid.success) {
    return { success: false, errorKey: "errors.escrow.unknown_action" };
  }

  return guardAction(
    async () => {
      const response = await (client as any).api.v1.escrow[":invoiceId"][":action"].$post(
        { param: { invoiceId, action: valid.data }, json: reason ? { reason } : {} },
        await apiInit(),
      );
      if (!response.ok) {
        return { success: false, ...(await readError(response, "errors.escrow.failed")) };
      }
      const body = (await response.json()) as { data?: unknown };
      revalidatePath(`/client/invoices/${invoiceId}`);
      return { success: true, data: body.data };
    },
    ({ timedOut }) => ({
      success: false,
      errorKey: timedOut ? TIMEOUT_ERROR_KEY : "errors.escrow.failed",
    }),
  );
}
