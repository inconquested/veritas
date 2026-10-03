"use client";

import { useCallback, useEffect, useState } from "react";
import type { PushPayload } from "@/lib/push";
import { loadQueue, replayQueue, saveQueue, type QueuedAction } from "@/lib/offline-queue";

/**
 * F13 SyncStatus: indikator online/offline + antrean + tombol sinkron.
 * Push reuse: hanya tipe `PushPayload` dari lib/push.ts (read-only, tanpa
 * menyentuh file F7). Notifikasi push aktual dikirim server via sendPush.
 */
export function SyncStatus({ onPushPreview }: { onPushPreview?: (p: PushPayload) => void }) {
  const [online, setOnline] = useState<boolean>(true);
  const [pending, setPending] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);

  const refresh = useCallback(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setPending(loadQueue().length);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    const t = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.clearInterval(t);
    };
  }, [refresh]);

  async function syncNow() {
    const queue: QueuedAction[] = loadQueue();
    if (queue.length === 0 || syncing) return;
    setSyncing(true);
    try {
      const res = await replayQueue(queue, async (action) => {
        try {
          const r = await fetch(action.url, {
            method: action.method ?? "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(action.payload),
          });
          return r.ok;
        } catch {
          return false;
        }
      });
      saveQueue(res.remaining);
      setPending(res.remaining.length);
      if (res.sent.length > 0) {
        onPushPreview?.({
          title: "Antrean terkirim",
          body: `${res.sent.length} aksi offline berhasil disinkron.`,
        });
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: online ? "#16a34a" : "#dc2626" }}
        aria-hidden
      />
      <span>{online ? "Online" : "Offline"}</span>
      {pending > 0 ? <span>· {pending} antre</span> : <span>· sinkron</span>}
      {pending > 0 && online ? (
        <button type="button" onClick={syncNow} disabled={syncing} className="underline">
          {syncing ? "Menyinkron…" : "Sinkron sekarang"}
        </button>
      ) : null}
    </div>
  );
}
