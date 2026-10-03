/**
 * F13 offline queue: antre komentar/aksi saat offline, replay FIFO saat online.
 *
 * Pure + isomorphic: inti antrean tanpa DOM (testable di node), lapisan
 * localStorage hanya aktif bila `window` ada. Kirim aktual dilakukan `sender`
 * milik caller (fetch POST), sehingga lib ini tanpa I/O jaringan.
 *
 * Push: JANGAN duplikasi lib/push.ts F7 — server yang mengeksekusi hasil
 * replay memanggil `sendPush` dari "@/lib/push" (read-only reuse, file ini
 * tidak diedit). Di klien cukup `import type { PushPayload }` bila butuh tipe.
 *
 * TODO: Background Sync API (`navigator.serviceWorker.ready.then(sync.register)`)
 * bila browser mendukung; v1 cukup replay manual + tombol SyncStatus.
 */

export type QueuedActionKind = "comment" | "task-update" | "generic";

export type QueuedAction = {
  id: string;
  kind: QueuedActionKind;
  /** Endpoint relatif, mis. "/api/comments". */
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
};

const STORAGE_KEY = "veritas:offline-queue:v1";
const MAX_ITEMS = 100;

function uid(): string {
  try {
    const c = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
    if (c?.randomUUID) return c.randomUUID();
  } catch { /* abaikan */ }
  return `q_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function createAction(
  kind: QueuedActionKind,
  url: string,
  payload: Record<string, unknown>,
  method: QueuedAction["method"] = "POST",
): QueuedAction {
  return { id: uid(), kind, url, method, payload, createdAt: new Date().toISOString(), attempts: 0 };
}

/** Tambah ke ekor (FIFO). Cap 100 — item terlama dibuang bila penuh. */
export function enqueue(queue: QueuedAction[], action: QueuedAction): QueuedAction[] {
  const next = [...queue, action];
  return next.length > MAX_ITEMS ? next.slice(next.length - MAX_ITEMS) : next;
}

/** Ambil kepala tanpa menghapus bila antrean kosong -> null. */
export function peek(queue: QueuedAction[]): QueuedAction | null {
  return queue.length > 0 ? queue[0] : null;
}

/** Keluarkan kepala (dipakai setelah kirim sukses). */
export function dequeue(queue: QueuedAction[]): { head: QueuedAction | null; rest: QueuedAction[] } {
  if (queue.length === 0) return { head: null, rest: [] };
  const [head, ...rest] = queue;
  return { head, rest };
}

export type SendFn = (action: QueuedAction) => Promise<boolean>;

export type ReplayResult = {
  sent: QueuedAction[];
  failed: QueuedAction | null;
  remaining: QueuedAction[];
};

/**
 * Replay FIFO: kirim berurutan via `sender`; berhenti di gagal pertama
 * (attempts+1) agar urutan tidak lompat. Kembalikan sisa antrean.
 */
export async function replayQueue(queue: QueuedAction[], sender: SendFn): Promise<ReplayResult> {
  const remaining = [...queue];
  const sent: QueuedAction[] = [];
  while (remaining.length > 0) {
    const head = remaining[0];
    let ok = false;
    try {
      ok = await sender(head);
    } catch {
      ok = false;
    }
    if (!ok) {
      head.attempts += 1;
      return { sent, failed: head, remaining };
    }
    remaining.shift();
    sent.push(head);
  }
  return { sent, failed: null, remaining };
}

/** localStorage helpers — no-op di SSR/node (return default aman). */
export function loadQueue(): QueuedAction[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedAction[];
    return Array.isArray(parsed) ? parsed.filter((a) => a && a.id && a.url) : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: QueuedAction[]): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_ITEMS)));
  } catch { /* kuota penuh -> abaikan */ }
}

export function clearQueue(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* abaikan */ }
}

export const __offlineQueueTest = { STORAGE_KEY, MAX_ITEMS };
