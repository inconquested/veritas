/**
 * AI service F8 — interface `complete(prompt, ctx)` + adapter
 * OpenAI-compatible + fallback stub.
 *
 * - Tanpa AI_API_KEY (atau AI gagal/timeout/limit): kembalikan template
 *   lokal, fitur nonaktif elegan — TIDAK throw.
 * - PII disensor via `lib/redact.ts` SEBELUM teks keluar server.
 * - Pemakaian dicatat via `lib/ai-budget.ts` (in-memory, TODO persist).
 *
 * Env: AI_API_KEY, AI_MODEL (default gpt-4o-mini),
 *      AI_BASE_URL (default https://api.openai.com/v1).
 */

import { redactPII } from "@/lib/redact";
import { estimateTokens, isOverLimit, recordUsage } from "@/lib/ai-budget";

export const DEFAULT_AI_MODEL = "gpt-4o-mini";
export const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
const FETCH_TIMEOUT_MS = 15_000;

export interface CompleteContext {
  /** Untuk budget per user. Tanpa userId dicatat sebagai "anonymous". */
  userId?: string;
  /** Batas output ke model (default 1024). */
  maxTokens?: number;
  /** System prompt opsional. */
  system?: string;
}

export interface CompleteResult {
  text: string;
  /** True = template lokal (AI nonaktif / gagal / limit). */
  stub: boolean;
  model: string;
}

export function aiConfig(): {
  apiKey: string;
  model: string;
  baseUrl: string;
} {
  return {
    apiKey: (process.env.AI_API_KEY ?? "").trim(),
    model: (process.env.AI_MODEL ?? "").trim() || DEFAULT_AI_MODEL,
    baseUrl: (
      process.env.AI_BASE_URL ?? ""
    ).trim().replace(/\/+$/, "") || DEFAULT_AI_BASE_URL,
  };
}

/** True jika ada key dan user belum melewati batas harian. */
export function aiEnabled(userId?: string): boolean {
  if (!aiConfig().apiKey) return false;
  if (userId && isOverLimit(userId)) return false;
  return true;
}

/**
 * Template lokal saat AI nonaktif — deterministik agar bisa di-test
 * dan diparse downstream (brief/drafter fallback ke parser murni).
 */
export function stubComplete(prompt: string): CompleteResult {
  const { text } = redactPII(prompt);
  const excerpt = text.slice(0, 500);
  return {
    text: `[AI nonaktif — draf lokal]\n${excerpt}${text.length > 500 ? "\n…" : ""}`,
    stub: true,
    model: "stub",
  };
}

async function callModel(
  redactedPrompt: string,
  ctx: CompleteContext,
  model: string,
  baseUrl: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: ctx.maxTokens ?? 1024,
      messages: [
        ...(ctx.system
          ? [{ role: "system", content: ctx.system }]
          : []),
        { role: "user", content: redactedPrompt },
      ],
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`ai_upstream_${res.status}`);
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("ai_empty_response");
  return text;
}

/**
 * Lengkapi prompt via model; selalu resolve (stub saat nonaktif/gagal).
 * Tidak pernah throw untuk kasus operasional (key kosong, limit, timeout,
 * upstream 5xx) — hanya kesalahan programmer (prompt bukan string) yang throw.
 */
export async function complete(
  prompt: string,
  ctx: CompleteContext = {},
): Promise<CompleteResult> {
  if (typeof prompt !== "string") throw new Error("errors.ai.bad_prompt");
  const { text: safe } = redactPII(prompt);
  const { apiKey, model, baseUrl } = aiConfig();
  const userId = ctx.userId ?? "anonymous";

  if (!apiKey || isOverLimit(userId)) return stubComplete(prompt);

  try {
    const text = await callModel(safe, ctx, model, baseUrl, apiKey);
    recordUsage(userId, estimateTokens(safe) + estimateTokens(text));
    return { text, stub: false, model };
  } catch {
    // ponytail: tanpa retry/backoff — v1 cukup fallback elegan, tambah saat butuh
    recordUsage(userId, estimateTokens(safe));
    return stubComplete(prompt);
  }
}
