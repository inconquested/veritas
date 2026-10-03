/**
 * F7 webhook KELUAR (outbound) — beda dari webhook inbound gateway (escrow).
 * Event: invoice.paid / escrow.released, HMAC-SHA256, retry 3x backoff.
 *
 * Setup Zapier: Trigger "Webhooks by Zapier → Catch Hook" → paste URL hasil
 * ke env OUTBOUND_WEBHOOK_URL → Test → pakai field data.* di action berikut.
 * Setup Make: tambah modul "Webhooks → Custom webhook" → copy URL ke
 * OUTBOUND_WEBHOOK_URL → "Run once" → kirim 1 event untuk imprin struktur.
 *
 * Contoh payload (invoice.paid):
 * {
 *   "id": "wh_9f3a...",
 *   "event": "invoice.paid",
 *   "occurredAt": "2026-10-02T10:00:00.000Z",
 *   "data": { "invoiceId": "inv_1", "amount": "1500000", "currency": "IDR",
 *              "projectId": "prj_1", "portalUrl": "https://app/p/tok-123" }
 * }
 * Header: content-type application/json, x-veritas-event, x-veritas-signature
 * (hex HMAC-SHA256 dari raw body dengan OUTBOUND_WEBHOOK_SECRET).
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const OUTBOUND_EVENTS = ["invoice.paid", "escrow.released"] as const;
export type OutboundEvent = (typeof OUTBOUND_EVENTS)[number];

export type OutboundEnvelope = {
  id: string;
  event: OutboundEvent;
  occurredAt: string;
  data: Record<string, unknown>;
};

export function isOutboundEvent(value: unknown): value is OutboundEvent {
  return (
    typeof value === "string" &&
    (OUTBOUND_EVENTS as readonly string[]).includes(value)
  );
}

function outboundSecret(explicit?: string): string {
  return explicit ?? process.env.OUTBOUND_WEBHOOK_SECRET ?? "";
}

/** Hex HMAC-SHA256 dari raw body. Fails closed: tanpa secret -> throw. */
export function signOutboundPayload(rawBody: string, secret?: string): string {
  const key = outboundSecret(secret);
  if (!key) throw new Error("OUTBOUND_WEBHOOK_SECRET is not configured");
  return createHmac("sha256", key).update(rawBody, "utf8").digest("hex");
}

/** Verifikasi signature penerima (timing-safe, fails closed). */
export function verifyOutboundSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret?: string,
): boolean {
  const key = outboundSecret(secret);
  if (!key || !signature) return false;
  const expected = signOutboundPayload(rawBody, key);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildOutboundEnvelope(
  event: OutboundEvent,
  data: Record<string, unknown>,
): { envelope: OutboundEnvelope; raw: string; signature: string } {
  const envelope: OutboundEnvelope = {
    id: `wh_${randomUUID().slice(0, 8)}`,
    event,
    occurredAt: new Date().toISOString(),
    data,
  };
  const raw = JSON.stringify(envelope);
  return { envelope, raw, signature: signOutboundPayload(raw) };
}

export type SendOutboundResult = {
  ok: boolean;
  attempts: number;
  stubbed: boolean;
  status?: number;
  error?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**     
 * Kirim 1 event ke URL Zapier/Make, maks 3x percobaan (backoff).
 * Tanpa URL tujuan -> stub (dokumen envelope, tidak kirim).
 */
export async function sendOutboundWebhook(opts: {
  url?: string | null;
  event: OutboundEvent;
  data: Record<string, unknown>;
  secret?: string;
  fetchImpl?: typeof fetch;
  delaysMs?: number[];
}): Promise<SendOutboundResult> {
  const url = opts.url ?? process.env.OUTBOUND_WEBHOOK_URL ?? null;
  const delaysMs = opts.delaysMs ?? [500, 1000, 2000];
  const maxAttempts = delaysMs.length + 1;
  const fetchImpl = opts.fetchImpl ?? fetch;

  const { raw, signature } = buildOutboundEnvelope(opts.event, opts.data);
  if (!url) return { ok: true, attempts: 0, stubbed: true };

  let lastError = "unknown";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-veritas-event": opts.event,
          "x-veritas-signature": signature,
        },
        body: raw,
      });
      if (res.ok) return { ok: true, attempts: attempt, stubbed: false, status: res.status };
      lastError = `http:${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    if (attempt < maxAttempts) await sleep(delaysMs[attempt - 1] ?? 0);
  }
  return { ok: false, attempts: maxAttempts, stubbed: false, error: lastError };
}
