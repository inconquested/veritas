/* F7 service worker: offline timeline portal publik (/p/*, cache-first +
 * background revalidate). TODO: PNG 192/512 (installability) + antre komentar
 * offline + sync (wave F13). */
const CACHE = "veritas-portal-v1";
const PRECACHE = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/p/") && !PRECACHE.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});

/* F13 (tambahan, bukan tulis ulang): cache GET read-only /api/v1/*
 * (projects/invoices/search) network-first + fallback cache. POST/PUT
 * tidak di-cache; antre offline ditangani lib/offline-queue.ts + SyncStatus.
 * Push reuse lib/push.ts F7 (server-side, bukan di SW ini). */
const API_CACHE = "veritas-api-v1";
const API_GET_RE = /^\/api\/v1\/(projects|invoices|search)/;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!API_GET_RE.test(url.pathname)) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(API_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
