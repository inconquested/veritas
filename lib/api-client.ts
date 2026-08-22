import { hc } from "hono/client";
import type { AppType } from "@/app/api/[...route]/route";

// Origin only: hc appends the typed route paths, which already include the
// /api/v1 basePath. Passing NEXT_PUBLIC_API_URL (which ends in /api/v1) makes
// every request a doubled /api/v1/api/v1/... that 404s.
const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000") as string;

export const client: ReturnType<typeof hc<AppType>> = hc<AppType>(baseUrl);
