"use server"

import {auth, clerkClient} from "@clerk/nextjs/server";
import {
    isTimeoutError,
    TIMEOUT_ERROR_KEY,
    withTimeout,
} from "@/lib/action-timeout";
import {provisionCurrentUser} from "@/services/auth-context";

export type UpdateUserRoleResult =
    | { success: true }
    | { success: false; errorKey: string };

export async function updateUserRole(
    role: "client" | "freelancer",
): Promise<UpdateUserRoleResult> {
    const {userId} = await auth()
    if (!userId) {
        return {success: false, errorKey: "errors.unauthorized"};
    }

    try {
        const client = await clerkClient()

        // Clerk's SDK doesn't take an AbortSignal, so bound it with a timeout so
        // the onboarding screen can recover instead of hanging on a slow call.
        await withTimeout(
            client.users.updateUserMetadata(userId, {
                publicMetadata: {
                    role
                }
            }),
        )

        // Write the DB row now — lazy provisioning via the API routes is a
        // fallback, not the plan. Idempotent upsert, safe to retry.
        await provisionCurrentUser(role === "freelancer" ? "FREELANCER" : "CLIENT")

        return {success: true}
    } catch (error) {
        if (isTimeoutError(error)) {
            return {success: false, errorKey: TIMEOUT_ERROR_KEY};
        }
        console.error("updateUserRole failed:", error);
        return {success: false, errorKey: "errors.internal"};
    }
}
