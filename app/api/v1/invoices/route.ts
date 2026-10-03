/**
 * F13 Public API: GET/POST /v1/invoices (API key, tanpa Clerk).
 * GET list/detail (?id=), scope read. POST create minimal, scope write.
 * TODO(DB): number/termin otomatis + nextInvoiceNumber saat wave integrasi.
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
  const r = checkRateLimitSync(`v1:invoices:${key}`, { limit: 60, windowMs: 60_000 });
  if (!r.ok) {
    return Response.json(
      { success: false, errorKey: "errors.rate_limited" },
      { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
    );
  }
  return null;
}

const PAYMENT_METHODS = new Set([
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "STRIPE",
  "PAYPAL",
  "XENDIT",
  "MIDTRANS",
  "CASH",
  "OTHER",
]);

export async function GET(req: Request) {
  const rl = rateLimited(req);
  if (rl) return rl;
  const g = guardApiKey(req, "read");
  if (!g.ok) return g.response;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const projectId = url.searchParams.get("project_id");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 50);
  try {
    if (id) {
      const row = await prisma.invoice.findUnique({ where: { id } });
      if (!row) return Response.json({ success: false, errorKey: "errors.notExist" }, { status: 404 });
      return Response.json({ success: true, data: toJsonSafe(row) });
    }
    const rows = await prisma.invoice.findMany({
      where: projectId ? { project_id: projectId } : undefined,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ success: true, data: toJsonSafe(rows) });
  } catch (e) {
    logEvent("error", "v1 invoices GET failed", { message: e instanceof Error ? e.message : String(e) });
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
  const projectId = typeof body.project_id === "string" ? body.project_id : "";
  const freelancerId = typeof body.freelancerId === "string" ? body.freelancerId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
  const amountRaw = body.amount;
  const amount = typeof amountRaw === "number" ? BigInt(Math.trunc(amountRaw)) : typeof amountRaw === "string" && /^\d+$/.test(amountRaw.trim()) ? BigInt(amountRaw.trim()) : null;
  const method = typeof body.payment_method === "string" ? body.payment_method : "BANK_TRANSFER";
  const dueRaw = typeof body.due_date === "string" ? body.due_date : "";
  const due = dueRaw ? new Date(dueRaw) : null;
  if (!projectId || !freelancerId || !title || !clientName || amount === null || amount <= 0 || !due || Number.isNaN(due.getTime())) {
    return Response.json(
      { success: false, errorKey: "errors.validation_failed", fields: ["project_id", "freelancerId", "title", "clientName", "amount", "due_date"] },
      { status: 400 },
    );
  }
  if (!PAYMENT_METHODS.has(method)) {
    return Response.json({ success: false, errorKey: "errors.validation_failed", fields: ["payment_method"] }, { status: 400 });
  }
  try {
    const row = await prisma.invoice.create({
      data: {
        project_id: projectId,
        freelancerId,
        clientName: clientName.slice(0, 255),
        title: title.slice(0, 255),
        notes: typeof body.notes === "string" ? body.notes : null,
        amount,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment_method: method as any,
        due_date: due,
      },
    });
    return Response.json({ success: true, data: toJsonSafe(row) }, { status: 201 });
  } catch (e) {
    logEvent("error", "v1 invoices POST failed", { message: e instanceof Error ? e.message : String(e) });
    return Response.json({ success: false, errorKey: "errors.invoice.creation_failed" }, { status: 500 });
  }
}
