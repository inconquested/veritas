"use server";

import { revalidatePath } from "next/cache";
import { shareService } from "@/services/share-service";
import {
  authErrorResponse,
  requireProjectAccess,
  requireUser,
} from "@/services/auth-context";
import { guardAction } from "@/lib/action-timeout";

export async function createClientLink(projectId: string) {
  return guardAction<{ success: boolean; token?: string; errorKey?: string }>(
    async () => {
      const user = await requireUser();
      await requireProjectAccess(projectId, user, "write");
      const link = await shareService.createShareLink(projectId);
      revalidatePath(`/freelancer/projects/${projectId}`);
      return { success: true, token: link.token };
    },
    () => ({ success: false, errorKey: "errors.share.failed" }),
  );
}

export async function revokeClientLink(projectId: string, token: string) {
  return guardAction<{ success: boolean; errorKey?: string }>(
    async () => {
      const user = await requireUser();
      await requireProjectAccess(projectId, user, "write");
      await shareService.revokeShareLink(token);
      revalidatePath(`/freelancer/projects/${projectId}`);
      return { success: true };
    },
    (info) => {
      const auth = info.error ? authErrorResponse(info.error) : null;
      return {
        success: false,
        errorKey: auth ? auth.body.errorKey : "errors.share.failed",
      };
    },
  );
}
