// Fixed-window rate limit for the public magic-link portal (30 req/mnt).
// Delegates to the shared limiter (lib/rate-limit) so API + portal share one
// store. TODO(F7 wave integrasi): Upstash Redis via env UPSTASH_* (handled in
// lib/rate-limit when env present; currently in-memory fallback).
import { checkRateLimitSync } from "./rate-limit";

const LIMIT = 30;
const WINDOW_MS = 60_000;

export function portalRateLimit(key: string): {
  ok: boolean;
  retryAfterSec: number;
} {
  return checkRateLimitSync(`portal:${key}`, {
    limit: LIMIT,
    windowMs: WINDOW_MS,
    baseBackoffMs: false,
  });
}
