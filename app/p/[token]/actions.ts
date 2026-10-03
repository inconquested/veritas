"use server";

import { revalidatePath } from "next/cache";
import { shareService, SHARE_NOT_FOUND } from "@/services/share-service";
import { invoiceService } from "@/services/invoice-service";
import { escrowService } from "@/services/escrow-service";

/** Token is the authorization: no Clerk here, the unguessable link is the key. */
async function checkToken(token: string) {
  try {
    await shareService.getProjectByToken(token);
    return null;
  } catch {
    return { success: false as const, error: SHARE_NOT_FOUND };
  }
}

export async function payInvoice(token: string, invoiceId: string) {
  const denied = await checkToken(token);
  if (denied) return denied;
  try {
    const stored = await invoiceService.getInvoice(invoiceId);
    const result = await invoiceService.chargeInvoice({
      id: invoiceId,
      project_id: stored.project_id,
      title: stored.title,
      currency: stored.currency,
      amount: stored.amount,
      payment_method: stored.payment_method,
      due_date: stored.due_date,
    } as never);
    if (!result.success) {
      return { success: false as const, error: result.errorMessage };
    }
    revalidatePath(`/p/${token}`);
    return {
      success: true as const,
      checkoutUrl:
        "checkoutUrl" in result ? (result.checkoutUrl as string) : undefined,
      providerTxId:
        "providerTxId" in result
          ? ((result.providerTxId as string) ?? undefined)
          : undefined,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "errors.internal",
    };
  }
}

export async function approveWork(token: string, invoiceId: string) {
  const denied = await checkToken(token);
  if (denied) return denied;
  try {
    // Stable key: double-click approve replays instead of double-releasing.
    await escrowService.transition(
      "release",
      invoiceId,
      "CLIENT",
      `portal:${token}:${invoiceId}:release`,
    );
    revalidatePath(`/p/${token}`);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "errors.internal",
    };
  }
}

/** Polling ringan untuk ChargeSheet: status invoice via token yang sama. */
export async function getInvoiceStatus(token: string, invoiceId: string) {
  try {
    const portal = await shareService.getProjectByToken(token);
    const invoice = portal.project.invoices.find((i) => i.id === invoiceId);
    if (!invoice) return { success: false as const, error: SHARE_NOT_FOUND };
    return { success: true as const, status: invoice.status as string };
  } catch {
    return { success: false as const, error: SHARE_NOT_FOUND };
  }
}
