/**
 * F7 server-side role guards for server actions + route handlers.
 * Role-first API over services/auth-context; the resolver is injectable so
 * tests can prove spoof/no-session rejection without a Clerk session.
 */
import {
  AuthError,
  getCurrentUser,
  requireRole as assertRole,
  type AppRole,
  type AuthUser,
} from "@/services/auth-context";

export type CurrentUserResolver = () => Promise<AuthUser | null>;

/** Throw UNAUTHENTICATED (no session) or FORBIDDEN (wrong role). */
export async function requireRole(
  role: AppRole,
  resolve: CurrentUserResolver = getCurrentUser,
): Promise<AuthUser> {
  const user = await resolve();
  if (!user) throw new AuthError("Not authenticated", "UNAUTHENTICATED");
  assertRole(user, role);
  return user;
}

/** Caller must be a freelancer (spoofed CLIENT role -> FORBIDDEN). */
export function requireFreelancer(
  resolve?: CurrentUserResolver,
): Promise<AuthUser> {
  return requireRole("FREELANCER", resolve);
}

/** Caller must be a client (spoofed FREELANCER role -> FORBIDDEN). */
export function requireClient(resolve?: CurrentUserResolver): Promise<AuthUser> {
  return requireRole("CLIENT", resolve);
}
