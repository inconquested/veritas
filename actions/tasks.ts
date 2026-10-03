"use server";

import { revalidatePath } from "next/cache";
import { taskService, type TaskStatus } from "@/services/task-service";
import {
  authErrorResponse,
  requireProjectAccess,
  requireUser,
} from "@/services/auth-context";
import { guardAction } from "@/lib/action-timeout";

/** Task boleh diubah kedua pihak project → mode "read" (cek pihak saja). */
export async function moveTaskAction(projectId: string, taskId: string, to: TaskStatus) {
  return guardAction<{ success: boolean; error?: string }>(
    async () => {
      const user = await requireUser();
      await requireProjectAccess(projectId, user, "read");
      await taskService.moveStatus(taskId, to, { actorId: user.id });
      revalidatePath(`/freelancer/projects/${projectId}`);
      return { success: true };
    },
    (info) => {
      const auth = info.error ? authErrorResponse(info.error) : null;
      return {
        success: false,
        error: auth ? auth.body.errorKey : "errors.task.move_failed",
      };
    },
  );
}
