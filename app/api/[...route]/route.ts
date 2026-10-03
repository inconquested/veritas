import { Hono } from "hono";
import { handle } from "hono/vercel";
import { checkRateLimit } from "@/lib/rate-limit";
import { projectsApp } from "./projects";
import { invoicesApp } from "./invoices";
import { escrowApp } from "./escrow";

const app = new Hono({ strict: false }).basePath("/api/v1");

function requestIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// F7: shared limiter (lib/rate-limit) — 60 req/mnt + exponential backoff,
// Upstash Redis when UPSTASH_* env present, memory fallback otherwise.
app.use("*", async (c, next) => {
  const ip = requestIp(c.req.raw);
  const limit = await checkRateLimit(`api:${ip}`);
  if (!limit.ok) {
    c.header("Retry-After", String(limit.retryAfterSec));
    return c.json(
      {
        success: false,
        errorKey: "errors.rate_limited",
        message: `Too many requests. Try again in ${limit.retryAfterSec}s.`,
      },
      429,
    );
  }
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

// Node runtime required: @prisma/adapter-pg uses node-postgres (TCP), which
// cannot load in the edge runtime — every DB route 500s there and the lazy
// user provisioning in auth-context never runs.
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;
