/**
 * F13 Public API: GET/POST /v1/escrow (API key, tanpa Clerk).
 * GET list/detail (?id=), scope read. POST hold minimal
 * { invoiceId, provider, amount, currency }, scope write.
 * Transisi status TETAP via EscrowService (F0) — endpoint ini hanya create
 * INITIALIZED; release/refund/dispute lewat alur existing.
 * TODO(DB): scope per-workspace + idempotencyKey client-supplied.
 */
import prisma from "@/lib/prisma";
import { guardApiKey } from "@/lib/api-key";
import { checkRateLimitSync } from "@/lib/rate-limit";
import { logEvent } from "@/lib/obs";
import { toJsonSafe } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rateLimited(req: Request): Response | null {
  const key = req.headers.get("x-api-key") ?? req.headers.get("authorization") ?? "anon";
  const r = checkRateLimitSync(`v1:escrow:${key}`, { limit: 60, windowMs: 60_000 });
  if (!r.ok) {
    return Response.json(
      { success: false, errorKey: "errors.rate_limited" },
      { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
    );
  }
  return null;
}

const CURRENCIES = new Set(["USD", "INR", "IDR", "GBP", "EUR", "CNY", "JPY", "KRW", "CAD", "AUD"]);

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
      const row = await prisma.escrow.findUnique({ where: { id }, include: { events: true } });
      if (!row) return Response.json({ success: false, errorKey: "errors.notExist" }, { status: 404 });
      return Response.json({ success: true, data: toJsonSafe(row) });
    }
    const rows = await prisma.escrow.findMany({ take: limit, orderBy: { createdAt: "desc" } });
    return Response.json({ success: true, data: toJsonSafe(rows) });
  } catch (e) {
    logEvent("error", "v1 escrow GET failed", { message: e instanceof Error ? e.message : String(e) });
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
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : "";
  const provider = typeof body.provider === "string" ? body.provider.trim().slice(0, 64) : "";
  const amountRaw = body.amount;
  const amount = typeof amountRaw === "number" ? BigInt(Math.trunc(amountRaw)) : typeof amountRaw === "string" && /^\d+$/.test(amountRaw.trim()) ? BigInt(amountRaw.trim()) : null;
  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "IDR";
  if (!invoiceId || !provider || amount === null || amount <= 0 || !CURRENCIES.has(currency)) {
    return Response.json(
      { success: false, errorKey: "errors.validation_failed", fields: ["invoiceId", "provider", "amount", "currency"] },
      { status: 400 },
    );
  }
  try {
    const row = await prisma.escrow.create({
      data: {
        invoiceId,
        provider,
        amount,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currency: currency as any,
      },
    });
    return Response.json({ success: true, data: toJsonSafe(row) }, { status: 201 });
  } catch (e) {
    logEvent("error", "v1 escrow POST failed", { message: e instanceof Error ? e.message : String(e) });
    return Response.json({ success: false, errorKey: "errors.escrow.creation_failed" }, { status: 500 });
  }
}
