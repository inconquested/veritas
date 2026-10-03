/**
 * Guard bersama cron F3: header `Authorization: Bearer <CRON_SECRET>`.
 * Fail-closed: tanpa secret yang cocok (atau CRON_SECRET kosong) = 401.
 */

export function cronSecret(): string {
  return process.env.CRON_SECRET ?? "";
}

export function isCronAuthorized(req: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const got = req.headers.get("authorization");
  return got === `Bearer ${secret}`;
}

export function cronUnauthorized(): Response {
  return Response.json(
    { success: false, errorKey: "errors.cron.unauthorized" },
    { status: 401 },
  );
}
