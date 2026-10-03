"use server";

import { revalidatePath } from "next/cache";
import { commentService } from "@/services/comment-service";
import { disputeService, type DisputeOutcome } from "@/services/dispute-service";
import {
  authErrorResponse,
  requireProjectAccess,
  requireUser,
} from "@/services/auth-context";
import { guardAction } from "@/lib/action-timeout";

type Fail = { success: false; error: string };
const fail = (info: { error?: unknown }, fallback: string): Fail => {
  const auth = info.error ? authErrorResponse(info.error) : null;
  return { success: false, error: auth ? auth.body.errorKey : fallback };
};

function revalidate(projectId: string) {
  revalidatePath(`/freelancer/projects/${projectId}`);
  revalidatePath(`/client/projects/${projectId}`);
}

/** Buka sengketa + simpan bukti upload sebagai komentar evidence. */
export async function openDisputeAction(formData: FormData) {
  return guardAction<{ success: boolean; error?: string }>(
    async () => {
      const user = await requireUser();
      const projectId = String(formData.get("projectId") ?? "");
      const invoiceId = String(formData.get("invoiceId") ?? "");
      const escrowId = String(formData.get("escrowId") ?? "");
      const access = await requireProjectAccess(projectId, user, "read");
      const reason = String(formData.get("reason") ?? "");
      const rawAmount = String(formData.get("requestedAmount") ?? "").replace(/[^0-9]/g, "");
      const files = formData
        .getAll("evidence")
        .filter((f): f is File => f instanceof File && f.size > 0);
      const attachments = files.length
        ? await commentService.uploadAttachments(files)
        : [];
      const dispute = await disputeService.openDispute(
        escrowId,
        reason,
        rawAmount ? BigInt(rawAmount) : null,
        { invoiceId, role: access.as },
      );
      if (attachments.length > 0) {
        await commentService.addComment({
          projectId,
          authorId: user.id,
          authorRole: access.as,
          body: `Bukti sengketa: ${reason.trim().slice(0, 200)}`,
          attachments,
        });
      }
      void dispute;
      revalidate(projectId);
      return { success: true };
    },
    (info) => fail(info, "errors.dispute.failed"),
  );
}

export async function respondDisputeAction(disputeId: string, projectId: string) {
  return guardAction<{ success: boolean; error?: string }>(
    async () => {
      const user = await requireUser();
      await requireProjectAccess(projectId, user, "read");
      await disputeService.respondDispute(disputeId);
      revalidate(projectId);
      return { success: true };
    },
    (info) => fail(info, "errors.dispute.failed"),
  );
}

export async function resolveDisputeAction(
  disputeId: string,
  projectId: string,
  invoiceId: string,
  outcome: DisputeOutcome,
) {
  return guardAction<{ success: boolean; error?: string }>(
    async () => {
      const user = await requireUser();
      await requireProjectAccess(projectId, user, "read");
      await disputeService.resolveDispute(disputeId, outcome, { invoiceId });
      revalidate(projectId);
      return { success: true };
    },
    (info) => fail(info, "errors.dispute.failed"),
  );
}
