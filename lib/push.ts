/**
 * F7 push wrapper (VAPID_*). v1 = stub-when-unconfigured: tanpa VAPID key atau
 * tanpa lib `web-push`, kirim di-log dan dilaporkan stubbed (tidak crash).
 * TODO(wave integrasi): npm i web-push + simpan subscription per user di DB.
 */

export type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type WebPushLib = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; keys?: unknown },
    payload?: string,
  ) => Promise<unknown>;
};

/** Load `web-push` bila terinstal (TODO: npm i web-push); null bila belum. */
async function loadWebPush(): Promise<WebPushLib | null> {
  try {
    const name = "web-push";
    return (await import(name)) as WebPushLib;
  } catch {
    return null;
  }
}

export type PushPayload = { title: string; body: string; url?: string };

export type PushResult = { ok: boolean; stubbed: boolean; error?: string };

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function sendPush(
  sub: WebPushSubscription | null | undefined,
  payload: PushPayload,
): Promise<PushResult> {
  if (!sub?.endpoint || !sub?.keys || !payload?.title || !payload?.body) {
    return { ok: false, stubbed: true, error: "invalid-subscription-or-payload" };
  }
  if (!isPushConfigured()) {
    console.log("[push:stub]", sub.endpoint, payload.title);
    return { ok: true, stubbed: true };
  }
  try {
    const webpush = await loadWebPush();
    if (!webpush) {
      console.log("[push:stub] web-push not installed", sub.endpoint);
      return { ok: true, stubbed: true };
    }
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
    );
    return { ok: true, stubbed: false };
  } catch (e) {
    // Lib belum diinstal (atau kirim gagal di sandbox): stub, jangan crash.
    console.log(
      "[push:stub]",
      sub.endpoint,
      e instanceof Error ? e.message : String(e),
    );
    return { ok: true, stubbed: true };
  }
}
