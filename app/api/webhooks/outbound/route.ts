/**
 * F7 webhook keluar: GET = dokumentasi (event, header, contoh payload,
 * langkah Zapier/Make); POST = picu 1 event (stub bila OUTBOUND_WEBHOOK_URL
 * kosong). Hanya ke URL env/allowlist — tidak menerima URL arbitrary
 * (anti-SSRF). Dipanggil server-side saat invoice.paid / escrow.released.
 */
import {
  OUTBOUND_EVENTS,
  buildOutboundEnvelope,
  isOutboundEvent,
  sendOutboundWebhook,
} from "@/lib/outbound-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXAMPLE: Record<string, unknown> = {
  "invoice.paid": {
    invoiceId: "inv_1",
    amount: "1500000",
    currency: "IDR",
    projectId: "prj_1",
    portalUrl: "https://app.example.com/p/tok-123",
  },
  "escrow.released": {
    invoiceId: "inv_1",
    amount: "1500000",
    currency: "IDR",
    projectId: "prj_1",
    releasedAt: "2026-10-02T10:00:00.000Z",
  },
};

export async function GET() {
  return Response.json({
    events: OUTBOUND_EVENTS,
    headers: ["content-type: application/json", "x-veritas-event", "x-veritas-signature"],
    signature: "hex HMAC-SHA256 dari raw body, secret = OUTBOUND_WEBHOOK_SECRET",
    zapier: "Webhooks by Zapier → Catch Hook → paste URL ke OUTBOUND_WEBHOOK_URL → Test → pakai field data.*",
    make: "Webhooks → Custom webhook → copy URL ke OUTBOUND_WEBHOOK_URL → Run once → kirim 1 event untuk imprin struktur",
    example: {
      id: "wh_9f3a1b2c",
      event: "invoice.paid",
      occurredAt: "2026-10-02T10:00:00.000Z",
      data: EXAMPLE["invoice.paid"],
    },
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, errorKey: "errors.validation_failed" }, { status: 400 });
  }
  const { event, data } = (body ?? {}) as { event?: unknown; data?: unknown };
  if (!isOutboundEvent(event) || typeof data !== "object" || data === null) {
    return Response.json(
      { success: false, errorKey: "errors.validation_failed", events: OUTBOUND_EVENTS },
      { status: 400 },
    );
  }
  try {
    const { envelope, signature } = buildOutboundEnvelope(event, data as Record<string, unknown>);
    const sent = await sendOutboundWebhook({ event, data: data as Record<string, unknown> });
    return Response.json({ success: sent.ok, envelope, signature, delivery: sent });
  } catch (e) {
    return Response.json(
      { success: false, errorKey: "errors.internal", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
