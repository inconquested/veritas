/**
 * F13 Public API: GET /v1/search?q=...&project_id=...&kind=... (API key).
 * Scope: read. Full-text via lib/semantic-search (Prisma contains +
 * ranking di memori). Embedding pgvector = TODO (lihat lib tersebut).
 */
import prisma from "@/lib/prisma";
import { guardApiKey } from "@/lib/api-key";
import { checkRateLimitSync } from "@/lib/rate-limit";
import { logEvent } from "@/lib/obs";
import { semanticSearch, type SearchKind } from "@/lib/semantic-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: SearchKind[] = ["project", "invoice", "comment", "task"];

export async function GET(req: Request) {
  const key = req.headers.get("x-api-key") ?? req.headers.get("authorization") ?? "anon";
  const rl = checkRateLimitSync(`v1:search:${key}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return Response.json(
      { success: false, errorKey: "errors.rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  const g = guardApiKey(req, "read");
  if (!g.ok) return g.response;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return Response.json(
      { success: false, errorKey: "errors.validation_failed", fields: ["q"] },
      { status: 400 },
    );
  }
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam && (KINDS as string[]).includes(kindParam) ? (kindParam as SearchKind) : undefined;
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 50);
  try {
    const results = await semanticSearch(prisma, q, { kind, projectId, limit });
    return Response.json({ success: true, data: results });
  } catch (e) {
    logEvent("error", "v1 search failed", { message: e instanceof Error ? e.message : String(e) });
    return Response.json({ success: false, errorKey: "errors.internal" }, { status: 500 });
  }
}
