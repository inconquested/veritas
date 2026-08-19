import { Hono } from "hono";
import { handle } from "hono/vercel";
import { projectsApp } from "./projects";
import { invoicesApp } from "./invoices";
import { escrowApp } from "./escrow";

const app = new Hono({ strict: false }).basePath("/api/v1");

type RateLimitEntry = {
  count: number;
  resetAt: number;
  blockedUntil: number;
  strikes: number;
  lastSeen: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const RATE_BASE_BACKOFF_MS = 2_000;
const RATE_MAX_BACKOFF_MS = 60_000;
const RATE_IDLE_RESET_MS = 10 * 60_000;

function requestIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

app.use("*", async (c, next) => {
  const now = Date.now();
  const ip = requestIp(c.req.raw);
  const entry = rateLimitStore.get(ip);

  if (entry && now - entry.lastSeen > RATE_IDLE_RESET_MS) {
    rateLimitStore.delete(ip);
  }

  const current = rateLimitStore.get(ip) ?? {
    count: 0,
    resetAt: now + RATE_WINDOW_MS,
    blockedUntil: 0,
    strikes: 0,
    lastSeen: now,
  };

  current.lastSeen = now;

  if (current.blockedUntil > now) {
    const retryAfter = Math.ceil((current.blockedUntil - now) / 1000);
    c.header("Retry-After", String(retryAfter));
    return c.json(
      {
        success: false,
        errorKey: "errors.rate_limited",
        message: `Too many requests. Try again in ${retryAfter}s.`,
      },
      429,
    );
  }

  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + RATE_WINDOW_MS;
  }

  current.count += 1;

  if (current.count > RATE_LIMIT) {
    const backoff = Math.min(
      RATE_BASE_BACKOFF_MS * 2 ** current.strikes,
      RATE_MAX_BACKOFF_MS,
    );
    current.strikes += 1;
    current.blockedUntil = now + backoff;
    rateLimitStore.set(ip, current);
    c.header("Retry-After", String(Math.ceil(backoff / 1000)));
    return c.json(
      {
        success: false,
        errorKey: "errors.rate_limited",
        message: `Too many requests. Try again in ${Math.ceil(backoff / 1000)}s.`,
      },
      429,
    );
  }

  if (rateLimitStore.size > 10_000) {
    for (const [key, value] of rateLimitStore) {
      if (now - value.lastSeen > RATE_IDLE_RESET_MS) rateLimitStore.delete(key);
    }
  }

  rateLimitStore.set(ip, current);
  return next();
});

app.onError((err, c) => {
  console.error("API error", { path: c.req.path, message: err.message });
  return c.json({ success: false, errorKey: "errors.internal" }, 500);
});

app.get("/hello", (c) => {
  return c.json({
    message: "Hello from Hono!",
  });
});

const routes = app
  .route("/projects", projectsApp)
  .route("/invoices", invoicesApp)
  .route("/escrow", escrowApp);

export const runtime = "edge";

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;
