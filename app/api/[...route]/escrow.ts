import { Hono } from "hono";
import { escrowService } from "@/services/escrow-service";
import { EscrowError } from "@/services/vendor/payment/escrow-core";
import {
  EscrowActionInputSchema,
  EscrowManualActionSchema,
  EscrowWebhookSchema,
  WEBHOOK_ACTION,
} from "@/schemas";
import { formatZodIssues, toJsonSafe } from "@/lib/utils";

const escrowApp = new Hono({ strict: false });

// EscrowError.code -> HTTP status. Everything else is a generic 400 so we never
// leak internals or stack traces to the caller.
const STATUS: Record<EscrowError["code"], number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  MISSING_INIT: 400,
};

function errorResponse(error: unknown) {
  if (error instanceof EscrowError) {
    return { status: STATUS[error.code], body: { success: false, errorKey: `errors.escrow.${error.code.toLowerCase()}`, message: error.message } };
  }
  return { status: 400 as number, body: { success: false, errorKey: "errors.escrow.failed" } };
}

escrowApp.get("/:invoiceId", async (c) => {
  const invoiceId = c.req.param("invoiceId");
  const role = await escrowService.resolveActor(invoiceId);
  if (!role) {
    return c.json({ success: false, errorKey: "errors.escrow.forbidden" }, 403);
  }
  const state = await escrowService.getState(invoiceId);
  return c.json({ success: true, data: state ? toJsonSafe(state) : null });
});

escrowApp.post("/:invoiceId/initialize", async (c) => {
  const invoiceId = c.req.param("invoiceId");
  const role = await escrowService.resolveActor(invoiceId);
  if (!role) {
    return c.json({ success: false, errorKey: "errors.escrow.forbidden" }, 403);
  }
  try {
    const body = await parseBody(c);
    const parsed = EscrowActionInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, errorKey: "errors.validation_failed", issues: formatZodIssues(parsed.error.issues) },
        400,
      );
    }
    const key = parsed.data.idempotencyKey ?? `init:${invoiceId}`;
    const result = await escrowService.initialize(invoiceId, role, key);
    return c.json({ success: true, data: toJsonSafe(result) });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status as never);
  }
});

// Single handler for release / dispute / refund.
escrowApp.post("/:invoiceId/:action", async (c) => {
  const invoiceId = c.req.param("invoiceId");
  const actionParsed = EscrowManualActionSchema.safeParse(c.req.param("action"));
  if (!actionParsed.success) {
    return c.json({ success: false, errorKey: "errors.escrow.unknown_action" }, 404);
  }
  const role = await escrowService.resolveActor(invoiceId);
  if (!role) {
    return c.json({ success: false, errorKey: "errors.escrow.forbidden" }, 403);
  }
  try {
    const body = await parseBody(c);
    const parsed = EscrowActionInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, errorKey: "errors.validation_failed", issues: formatZodIssues(parsed.error.issues) },
        400,
      );
    }
    const action = actionParsed.data;
    const key = parsed.data.idempotencyKey ?? `${action}:${invoiceId}`;
    const result = await escrowService.transition(action, invoiceId, role, key, {
      reason: parsed.data.reason,
      actorRole: role,
    });
    return c.json({ success: true, data: toJsonSafe(result) });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status as never);
  }
});

// Gateway webhook. Signature-verified (HMAC over the raw body), unauthenticated
// otherwise, and idempotent on the provider event id.
escrowApp.post("/webhook", async (c) => {
  const raw = await c.req.text();

  if (!(await verifySignature(raw, c.req.header("x-escrow-signature")))) {
    return c.json({ success: false, errorKey: "errors.escrow.bad_signature" }, 401);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return c.json({ success: false, errorKey: "errors.validation_failed" }, 400);
  }

  const parsed = EscrowWebhookSchema.safeParse(json);
  if (!parsed.success) {
    return c.json(
      { success: false, errorKey: "errors.validation_failed", issues: formatZodIssues(parsed.error.issues) },
      400,
    );
  }

  try {
    const { eventId, invoiceId, type } = parsed.data;
    const action = WEBHOOK_ACTION[type];
    const result = await escrowService.transition(action, invoiceId, "SYSTEM", `webhook:${eventId}`, {
      webhookType: type,
    });
    return c.json({ success: true, data: toJsonSafe(result) });
  } catch (error) {
    // A webhook that arrives out of order (e.g. dispute after release) is an
    // invalid transition, not a server fault — ack with 409 so the gateway
    // doesn't hammer us with retries, but don't 500.
    const { status, body } = errorResponse(error);
    return c.json(body, status as never);
  }
});

async function parseBody(c: { req: { text: () => Promise<string> } }): Promise<unknown> {
  const raw = await c.req.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    // Return a sentinel that will fail schema validation rather than throwing.
    return { __invalid: true };
  }
}

// HMAC-SHA256 of the raw body, compared constant-time-ish against the header.
// Fails closed: no secret configured or no header => rejected.
async function verifySignature(raw: string, signature?: string): Promise<boolean> {
  const secret = process.env.ESCROW_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expected, signature.trim().toLowerCase());
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export { escrowApp };
