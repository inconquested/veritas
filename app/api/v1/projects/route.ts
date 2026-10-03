/**
 * F13 Public API: GET/POST /v1/projects (API key, tanpa Clerk).
 *
 * - GET: list (?limit, ?id= untuk detail). Scope: read.
 * - POST: create minimal { title, slug?, description?, clientId, freelancerId }.
 *   Scope: write. TODO(DB): turunkan client/freelancer/workspace dari ApiKey
 *   (model ApiKey di wave integrasi); v1 terima id eksplisit dari caller.
 * - PUT/DELETE tetap di app/api/[...route] (Clerk). File ini 405 untuk itu.
 */
import prisma from "@/lib/prisma";
import { guardApiKey } from "@/lib/api-key";
import { checkRateLimitSync } from "@/lib/rate-limit";
import { logEvent } from "@/lib/obs";
import { toJsonSafe, slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rateLimited(req: Request): Response | null {
  const key = req.headers.get("x-api-key") ?? req.headers.get("authorization") ?? "anon";
  const r = checkRateLimitSync(`v1:projects:${key}`, { limit: 60, windowMs: 60_000 });
  if (!r.ok) {
    return Response.json(
      { success: false, errorKey: "errors.rate_limited" },
      { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
    );
  }
  return null;
}

export async function GET(req: Request) {
  const rl = rateLimited(req);
  if (rl) return rl;
  const g = guardApiKey(req, "read");
  if (!g.ok) return g.response;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 50);
  try {
    if (id) {
      const row = await prisma.project.findUnique({ where: { id } });
      if (!row) return Response.json({ success: false, errorKey: "errors.notExist" }, { status: 404 });
      return Response.json({ success: true, data: toJsonSafe(row) });
    }
    const rows = await prisma.project.findMany({ take: limit, orderBy: { createdAt: "desc" } });
    return Response.json({ success: true, data: toJsonSafe(rows) });
  } catch (e) {
    logEvent("error", "v1 projects GET failed", { message: e instanceof Error ? e.message : String(e) });
    return Response.json({ success: false, errorKey: "errors.internal" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const rl = rateLimited(req);
  if (rl) return rl;
  const g = guardApiKey(req, "write");
  if (!g.ok) return g.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ success: false, errorKey: "errors.validation_failed" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const freelancerId = typeof body.freelancerId === "string" ? body.freelancerId : "";
  if (!title || !clientId || !freelancerId) {
    return Response.json(
      { success: false, errorKey: "errors.validation_failed", fields: ["title", "clientId", "freelancerId"] },
      { status: 400 },
    );
  }
  const slugBase = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : title;
  const slug = `${slugify(slugBase).slice(0, 60) || "project"}-${Date.now().toString(36)}`;
  try {
    const row = await prisma.project.create({
      data: {
        title: title.slice(0, 255),
        slug,
        description: typeof body.description === "string" ? body.description : null,
        clientId,
        freelancerId,
      },
    });
    return Response.json({ success: true, data: toJsonSafe(row) }, { status: 201 });
  } catch (e) {
    logEvent("error", "v1 projects POST failed", { message: e instanceof Error ? e.message : String(e) });
    return Response.json({ success: false, errorKey: "errors.project.creation_failed" }, { status: 500 });
  }
}
