import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * Identity + authorization core shared by every CRUD path (projects, invoices).
 *
 * The app authenticates with Clerk but authorizes against our own `User` rows.
 * Onboarding provisions the row via `provisionCurrentUser`; this module also
 * lazily upserts the DB user (and a FreelancerProfile for
 * freelancers) from the Clerk session the first time it is needed. Every
 * ownership check resolves the acting user here, so a signed-in caller can only
 * touch the projects/invoices they are a party to.
 */

export type AppRole = "CLIENT" | "FREELANCER";

export type AuthUser = {
  /** Internal DB user id (Project/Invoice relations reference this, not Clerk). */
  id: string;
  clerkUserId: string;
  role: AppRole;
  email: string;
  /** Present only for freelancers; the Invoice.freelancerId FK. */
  freelancerProfileId: string | null;
};

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" = "FORBIDDEN",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// AuthError.code -> (HTTP status, i18n error key). Callers surface this without
// leaking which resource exists to a user who may not touch it.
const AUTH_STATUS: Record<AuthError["code"], { status: number; errorKey: string }> = {
  UNAUTHENTICATED: { status: 401, errorKey: "errors.auth.unauthenticated" },
  FORBIDDEN: { status: 403, errorKey: "errors.auth.forbidden" },
  NOT_FOUND: { status: 404, errorKey: "errors.notExist" },
};

/** Map any thrown value to a safe HTTP response body. Non-AuthErrors fall
 * through so route handlers can apply their own domain fallback. */
export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    const { status, errorKey } = AUTH_STATUS[error.code];
    return { status, body: { success: false, errorKey } };
  }
  return null;
}

/**
 * Clerk stores role as lowercase "client"/"freelancer".
 * F7 wave integrasi: server reads privateMetadata ONLY (not exposed to
 * client JS, tidak bisa di-spoof). Fallback publicMetadata DIHAPUS.
 */
export function normalizeRole(value: unknown): AppRole {
  return String(value ?? "").toUpperCase() === "FREELANCER"
    ? "FREELANCER"
    : "CLIENT";
}

/**
 * Role claim from a Clerk user object. Reads privateMetadata ONLY.
 * Unknown/absent -> null (caller treats as not-onboarded → /onboarding).
 */
export function roleFromMetadata(
  user: {
    publicMetadata?: { role?: unknown };
    privateMetadata?: { role?: unknown };
  } | null | undefined,
): unknown {
  return user?.privateMetadata?.role;
}

/**
 * The role the current Clerk session claims, or null when the user hasn't
 * onboarded yet. Used by the route-group guards to decide onboarding vs. area
 * redirects without provisioning a DB row.
 */
export async function resolveClerkRole(): Promise<AppRole | null> {
  const clerkUser = await currentUser();
  const raw = roleFromMetadata(clerkUser);
  if (raw !== "client" && raw !== "freelancer") return null;
  return normalizeRole(raw);
}

function displayName(
  first?: string | null,
  last?: string | null,
  fallback?: string | null,
): string {
  return (
    [first, last].filter(Boolean).join(" ") || fallback || "Freelancer"
  );
}

/**
 * Ensure a FreelancerProfile exists for a freelancer user and return its id.
 * Idempotent: a lost create race (P2002) is resolved by re-reading.
 */
async function ensureFreelancerProfile(
  userId: string,
  name: string,
): Promise<string> {
  const existing = await prisma.freelancerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.freelancerProfile.create({
      data: { userId, name },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.freelancerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (raced) return raced.id;
    }
    throw error;
  }
}

/**
 * Resolve the signed-in Clerk user into an authenticated AuthUser, provisioning
 * the DB `User` (and FreelancerProfile) on first sight and keeping the stored
 * role in sync with Clerk. Returns null when there is no session.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const role = normalizeRole(roleFromMetadata(clerkUser));
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses?.[0]?.emailAddress ??
    "";
  const firstName = clerkUser.firstName ?? null;
  const lastName = clerkUser.lastName ?? null;
  const imageUrl = clerkUser.imageUrl ?? null;

  let user = await prisma.user.findUnique({
    where: { clerkUserId: clerkUser.id },
    select: { id: true, clerkUserId: true, role: true, email: true },
  });

  if (!user) {
    user = await provisionUser({
      clerkUserId: clerkUser.id,
      email,
      role,
      firstName,
      lastName,
      imageUrl,
    });
  } else if (user.role !== role) {
    // Clerk metadata is the source of truth for role; heal drift.
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role, updatedAt: new Date() },
      select: { id: true, clerkUserId: true, role: true, email: true },
    });
  }

  const resolvedRole = user.role as AppRole;
  const freelancerProfileId =
    resolvedRole === "FREELANCER"
      ? await ensureFreelancerProfile(
          user.id,
          displayName(firstName, lastName, email),
        )
      : null;

  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    role: resolvedRole,
    email: user.email,
    freelancerProfileId,
  };
}

/**
 * Upsert a DB user from an explicit role (used by onboarding, where the freshly
 * chosen role isn't yet reflected in the session token). Safe to call again.
 */
export async function provisionUser(input: {
  clerkUserId: string;
  email: string;
  role: AppRole;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
}) {
  const user = await prisma.user.upsert({
    where: { clerkUserId: input.clerkUserId },
    update: {
      email: input.email,
      role: input.role,
      firstName: input.firstName ?? undefined,
      lastName: input.lastName ?? undefined,
      imageUrl: input.imageUrl ?? undefined,
      updatedAt: new Date(),
    },
    create: {
      clerkUserId: input.clerkUserId,
      email: input.email,
      role: input.role,
      firstName: input.firstName ?? undefined,
      lastName: input.lastName ?? undefined,
      imageUrl: input.imageUrl ?? undefined,
    },
    select: { id: true, clerkUserId: true, role: true, email: true },
  });

  if (input.role === "FREELANCER") {
    await ensureFreelancerProfile(
      user.id,
      displayName(input.firstName, input.lastName, input.email),
    );
  }

  return user;
}

/** Provision the DB user for the current session from an explicit role. */
export async function provisionCurrentUser(role: AppRole) {
  const clerkUser = await currentUser();
  if (!clerkUser) throw new AuthError("Not authenticated", "UNAUTHENTICATED");
  return provisionUser({
    clerkUserId: clerkUser.id,
    email:
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses?.[0]?.emailAddress ??
      "",
    role,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    imageUrl: clerkUser.imageUrl,
  });
}

/** Like getCurrentUser but throws UNAUTHENTICATED instead of returning null. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Not authenticated", "UNAUTHENTICATED");
  return user;
}

/** Assert the caller holds a specific role. */
export function requireRole(user: AuthUser, role: AppRole): void {
  if (user.role !== role) {
    throw new AuthError(`Requires ${role} role`, "FORBIDDEN");
  }
}

export type ProjectAccess = {
  projectId: string;
  clientId: string;
  freelancerId: string;
  /** The caller's relation to this project. */
  as: AppRole;
};

/**
 * Verify the caller is a party to a project and return their relation.
 * `mode: "write"` additionally requires the caller to be the freelancer (only
 * the owning freelancer may mutate/delete a project or its invoices).
 */
export async function requireProjectAccess(
  projectId: string,
  user: AuthUser,
  mode: "read" | "write" = "read",
): Promise<ProjectAccess> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true, freelancerId: true },
  });
  if (!project) throw new AuthError("Project not found", "NOT_FOUND");

  const isClient = project.clientId === user.id;
  const isFreelancer = project.freelancerId === user.id;
  if (!isClient && !isFreelancer) {
    throw new AuthError("Not a member of this project", "FORBIDDEN");
  }
  if (mode === "write" && !isFreelancer) {
    throw new AuthError("Only the freelancer may modify this project", "FORBIDDEN");
  }

  return {
    projectId: project.id,
    clientId: project.clientId,
    freelancerId: project.freelancerId,
    as: isFreelancer ? "FREELANCER" : "CLIENT",
  };
}

export type InvoiceAccess = ProjectAccess & { invoiceId: string };

/**
 * Verify the caller is a party to an invoice's project. `mode: "write"`
 * requires the freelancer; charging is authorized separately (client-only).
 */
export async function requireInvoiceAccess(
  invoiceId: string,
  user: AuthUser,
  mode: "read" | "write" = "read",
): Promise<InvoiceAccess> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      project_id: true,
      project: { select: { clientId: true, freelancerId: true } },
    },
  });
  if (!invoice) throw new AuthError("Invoice not found", "NOT_FOUND");

  const isClient = invoice.project.clientId === user.id;
  const isFreelancer = invoice.project.freelancerId === user.id;
  if (!isClient && !isFreelancer) {
    throw new AuthError("Not a party to this invoice", "FORBIDDEN");
  }
  if (mode === "write" && !isFreelancer) {
    throw new AuthError("Only the freelancer may modify this invoice", "FORBIDDEN");
  }

  return {
    invoiceId: invoice.id,
    projectId: invoice.project_id,
    clientId: invoice.project.clientId,
    freelancerId: invoice.project.freelancerId,
    as: isFreelancer ? "FREELANCER" : "CLIENT",
  };
}

/** Prisma `where` fragment scoping projects to those the caller is a party to. */
export function projectScopeWhere(user: AuthUser): Prisma.ProjectWhereInput {
  return user.role === "FREELANCER"
    ? { freelancerId: user.id }
    : { clientId: user.id };
}

/** Prisma `where` fragment scoping invoices to the caller's own projects. */
export function invoiceScopeWhere(user: AuthUser): Prisma.InvoiceWhereInput {
  return user.role === "FREELANCER"
    ? { project: { freelancerId: user.id } }
    : { project: { clientId: user.id } };
}
