"use server";

import { revalidatePath } from "next/cache";
import { commentService } from "@/services/comment-service";
import prisma from "@/lib/prisma";
import {
  authErrorResponse,
  requireProjectAccess,
  requireUser,
} from "@/services/auth-context";
import { guardAction } from "@/lib/action-timeout";

function filesOf(formData: FormData) {
  return formData
    .getAll("evidence")
    .filter((f): f is File => f instanceof File && f.size > 0);
}

/** Komentar boleh dari klien maupun freelancer → mode "read" (cek pihak saja). */
export async function addCommentAction(formData: FormData) {
  return guardAction<{ success: boolean; error?: string }>(
    async () => {
      const user = await requireUser();
      const projectId = String(formData.get("projectId") ?? "");
      const access = await requireProjectAccess(projectId, user, "read");
      const files = filesOf(formData);
      const attachments = files.length
        ? await commentService.uploadAttachments(files)
        : [];
      const comment = await commentService.addComment({
        projectId,
        milestoneId: (formData.get("milestoneId") as string) || null,
        handsoutId: (formData.get("handsoutId") as string) || null,
        authorId: user.id,
        authorRole: access.as,
        body: String(formData.get("body") ?? ""),
        attachments,
      });
      // Wave integrasi: comment.created (best-effort; gagal notif ≠ gagal komen).
      try {
        const { send } = await import("@/services/vendor/notify/notify-service");
        const project = await (prisma as any).project
          .findUnique({
            where: { id: projectId },
            select: {
              title: true,
              client: { select: { email: true, phone: true } },
            },
          })
          .catch(() => null);
        const to =
          (project?.client?.phone as string | null) ??
          (project?.client?.email as string | null) ??
          null;
        if (to) {
          await send(to, "comment.created", {
            entityId: String((comment as any)?.id ?? `${projectId}:${Date.now()}`),
            projectTitle: (project?.title as string | null) ?? null,
            invoiceTitle: String(formData.get("body") ?? "").slice(0, 80) || null,
          });
        }
      } catch {
        // Best-effort: komentar sudah tersimpan di atas.
      }
      revalidatePath(`/freelancer/projects/${projectId}`);
      revalidatePath(`/client/projects/${projectId}`);
      return { success: true };
    },
    (info) => {
      const auth = info.error ? authErrorResponse(info.error) : null;
      return {
        success: false,
        error: auth ? auth.body.errorKey : "errors.comment.failed",
      };
    },
  );
}
