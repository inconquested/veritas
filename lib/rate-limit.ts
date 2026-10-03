/**
 * F7 shared rate limiter — single store for every call-site (API + portal).
 *
 * - `checkRateLimitSync`: pure in-memory fixed-window + exponential backoff.
 * - `checkRateLimit`: same, but tries Upstash Redis (REST) when
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set so limits hold
 *   across isolates; any failure falls back to memory (never fails closed).
 *
 * TODO(wave integrasi): persist strikes/blockedUntil in Redis too (saat ini
 * hanya counter global yang shared; backoff strikes tetap per-isolate).
 */

export type RateLimitResult = { ok: boolean; retryAfterSec: number };

export type RateLimitOptions = {
  limit?: number;
  windowMs?: number;
  /** false = fixed window tanpa backoff (portal publik). */
  baseBackoffMs?: number | false;
  maxBackoffMs?: number;
  idleResetMs?: number;
};

type Entry = {
  count: number;
  resetAt: number;
  blockedUntil: number;
  strikes: number;
  lastSeen: number;
};

const store = new Map<string, Entry>();

const DEFAULTS = {
  limit: 60,
  windowMs: 60_000,
  baseBackoffMs: 2_000 as number | false,
  maxBackoffMs: 60_000,
  idleResetMs: 10 * 60_000,
};

/** Test-only: clear the shared store. */
export function __resetRateLimitForTests(): void {
  store.clear();
}

/** Fixed-window + exponential backoff. Namespaces are part of `key`. */
export function checkRateLimitSync(
  key: string,
  opts: RateLimitOptions = {},
): RateLimitResult {
  const limit = opts.limit ?? DEFAULTS.limit;
  const windowMs = opts.windowMs ?? DEFAULTS.windowMs;
  const baseBackoffMs = opts.baseBackoffMs ?? DEFAULTS.baseBackoffMs;
  const maxBackoffMs = opts.maxBackoffMs ?? DEFAULTS.maxBackoffMs;
  const idleResetMs = opts.idleResetMs ?? DEFAULTS.idleResetMs;

  const now = Date.now();
  const stale = store.get(key);
  if (stale && now - stale.lastSeen > idleResetMs) store.delete(key);

  const current = store.get(key) ?? {
    count: 0,
    resetAt: now + windowMs,
    blockedUntil: 0,
    strikes: 0,
    lastSeen: now,
  };
  current.lastSeen = now;

  if (current.blockedUntil > now) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((current.blockedUntil - now) / 1000),
    };
  }

  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + windowMs;
  }
  current.count += 1;

  if (current.count > limit) {
    if (baseBackoffMs === false) {
      store.set(key, current);
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }
    const backoff = Math.min(baseBackoffMs * 2 ** current.strikes, maxBackoffMs);
    current.strikes += 1;
    current.blockedUntil = now + backoff;
    store.set(key, current);
    return { ok: false, retryAfterSec: Math.ceil(backoff / 1000) };
  }

  if (store.size > 10_000) {
    for (const [k, v] of store) {
      if (now - v.lastSeen > idleResetMs) store.delete(k);
    }
  }
  store.set(key, current);
  return { ok: true, retryAfterSec: 0 };
}

function upstashEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function upstashIncr(
  fetchImpl: typeof fetch,
  env: { url: string; token: string },
  key: string,
  windowSec: number,
): Promise<number | null> {
  const res = await fetchImpl(
    `${env.url}/incr/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${env.token}` } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: number };
  if (typeof json.result !== "number") return null;
  if (json.result === 1) {
    await fetchImpl(`${env.url}/expire/${encodeURIComponent(key)}/${windowSec}`, {
      headers: { Authorization: `Bearer ${env.token}` },
    }).catch(() => null);
  }
  return json.result;
}

async function upstashTtl(
  fetchImpl: typeof fetch,
  env: { url: string; token: string },
  key: string,
): Promise<number | null> {
  const res = await fetchImpl(`${env.url}/ttl/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${env.token}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: number };
  return typeof json.result === "number" && json.result > 0 ? json.result : null;
}

/**
 * Async entry point: Upstash counter when configured, memory otherwise.
 * Remote count is authoritative; local strikes still add backoff layering.
 */
export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<RateLimitResult> {
  const env = upstashEnv();
  if (!env) return checkRateLimitSync(key, opts);

  const limit = opts.limit ?? DEFAULTS.limit;
  const windowMs = opts.windowMs ?? DEFAULTS.windowMs;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    const count = await upstashIncr(fetchImpl, env, `veritas:rl:${key}`, windowSec);
    if (count === null) return checkRateLimitSync(key, opts);
    if (count <= limit) {
      const local = store.get(key);
      const now = Date.now();
      if (local && local.blockedUntil > now) {
        return {
          ok: false,
          retryAfterSec: Math.ceil((local.blockedUntil - now) / 1000),
        };
      }
      return { ok: true, retryAfterSec: 0 };
    }
    const ttl = await upstashTtl(fetchImpl, env, `veritas:rl:${key}`);
    const local = checkRateLimitSync(`__remote-block:${key}`, {
      ...opts,
      limit: 0,
      baseBackoffMs: opts.baseBackoffMs ?? DEFAULTS.baseBackoffMs,
    });
    return {
      ok: false,
      retryAfterSec: Math.max(ttl ?? windowSec, local.retryAfterSec),
    };
  } catch {
    return checkRateLimitSync(key, opts);
  }
}
