import { hc } from "hono/client";
import type { AppType } from "@/app/api/[...route]/route";

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000") as string;

export const client: ReturnType<typeof hc<AppType>> = hc<AppType>(baseUrl);
