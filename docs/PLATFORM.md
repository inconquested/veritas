# PLATFORM.md — Veritas F13: Public API, White-Label, Offline, Observability

> v1 tanpa-schema: semua DB-backed plan diganti versi env/in-memory + TODO jujur
> agar tanpa migrasi. Pemilik schema.prisma (agen integrasi) yang mem-persist-kan.

## 1. Public API (`/api/v1/*`)

Auth: `Authorization: Bearer <key>` (utama) atau `x-api-key: <key>`.
Key terdaftar di env `VERITAS_API_KEY` (csv). Scope via prefix:

- mengandung `write` (case-insensitive, mis. `vr_live_write_xxx`) → `write` (bisa GET+POST)
- selain itu → `read` (GET saja; POST → 403 `errors.api_key.forbidden`)

Tanpa key/salah → 401. Rate-limit 60/mnt per key → 429 + `Retry-After`.

TODO(DB): model `ApiKey { workspaceId, name, keyHash, scope, revokedAt }`,
hash HMAC per key, halaman kelola + revoke di dashboard.

### OpenAPI ringkas

| Method | Path | Scope | Query/Body |
|---|---|---|---|
| GET | `/api/v1/projects` | read | `?limit=20`, `?id=` (detail) |
| POST | `/api/v1/projects` | write | `{ title, clientId, freelancerId, slug?, description? }` |
| GET | `/api/v1/invoices` | read | `?limit=20`, `?id=`, `?project_id=` |
| POST | `/api/v1/invoices` | write | `{ project_id, freelancerId, title, clientName, amount, payment_method, due_date, notes? }` |
| GET | `/api/v1/escrow` | read | `?limit=20`, `?id=` (+events) |
| POST | `/api/v1/escrow` | write | `{ invoiceId, provider, amount, currency }` (hanya INITIALIZED; transisi via EscrowService F0) |
| GET | `/api/v1/search` | read | `?q=`, `?project_id=`, `?kind=project\|invoice\|comment\|task`, `?limit=` |

`amount` boleh number/string digit (disimpan BigInt, dibaca sebagai string).
`payment_method`: BANK_TRANSFER|CREDIT_CARD|DEBIT_CARD|STRIPE|PAYPAL|XENDIT|MIDTRANS|CASH|OTHER.
`currency`: USD|INR|IDR|GBP|EUR|CNY|JPY|KRW|CAD|AUD.

### Contoh cURL

```bash
BASE=http://localhost:3000
READ=vr_live_read_xxx
WRITE=vr_live_write_xxx

# list + detail
curl -H "Authorization: Bearer $READ" "$BASE/api/v1/projects?limit=5"
curl -H "Authorization: Bearer $READ" "$BASE/api/v1/projects?id=<projectId>"

# create project (write)
curl -X POST -H "Authorization: Bearer $WRITE" -H "content-type: application/json" \
  -d '{"title":"Website UMKM","clientId":"<uuid>","freelancerId":"<uuid>"}' \
  "$BASE/api/v1/projects"

# invoices + escrow
curl -H "Authorization: Bearer $READ" "$BASE/api/v1/invoices?project_id=<projectId>"
curl -X POST -H "Authorization: Bearer $WRITE" -H "content-type: application/json" \
  -d '{"project_id":"<pid>","freelancerId":"<fid>","title":"Termin 1","clientName":"PT Maju","amount":"1500000","payment_method":"BANK_TRANSFER","due_date":"2026-11-01T00:00:00Z"}' \
  "$BASE/api/v1/invoices"
curl -X POST -H "Authorization: Bearer $WRITE" -H "content-type: application/json" \
  -d '{"invoiceId":"<inv>","provider":"XENDIT","amount":"1500000","currency":"IDR"}' \
  "$BASE/api/v1/escrow"

# search
curl -H "Authorization: Bearer $READ" "$BASE/api/v1/search?q=revisi&limit=10"

# Postman: import public/postman-collection.json, isi {{baseUrl}}, {{readKey}}, {{writeKey}}.
```

### Webhook keluar (sudah ada, F7)

Event `invoice.paid` / `escrow.released`, HMAC-SHA256 (`OUTBOUND_WEBHOOK_SECRET`),
retry 3x backoff. Template Zapier/Make: lihat `lib/outbound-webhook.ts` +
`GET /api/webhooks/outbound`. TODO F13 lanjutan: event `*.created/updated/paid/released`
+ log retry persisten (saat ini stub bila `OUTBOUND_WEBHOOK_URL` kosong).

## 2. White-label

`lib/whitelabel.ts`: `resolveBrand(host)` dari header `x-forwarded-host`/`host` +
env `WHITELABEL_JSON`:

```json
{ "default": {"name":"Veritas"},
  "portal.studio.com": {"name":"Studio Maju","logoUrl":"https://.../logo.png",
    "primaryColor":"#0f766e","accentColor":"#f59e0b",
    "fromEmail":"halo@studio.com","hideVeritasBadge":true} }
```

`primaryColor`/`accentColor` harus hex `#rrggbb` (fallback default bila invalid).
Komponen: `components/brand-header.tsx` (`<BrandHeader brand portalUrl/>`).
Badge "Powered by Veritas" hilang hanya bila `hideVeritasBadge=true` DAN flag
`white-label` aktif (`canHideBadge`, contoh pemakaian feature flag F13).

TODO(infra, custom domain — butuh agen infra, BUKAN kode ini):
CNAME `portal.studio.com` → app, verifikasi DNS TXT, sertifikat wildcard/edge,
mapping domain→workspace di DB + kirim email "dari studio" (SPF/DKIM per domain).

## 3. Mobile offline + push

- `lib/offline-queue.ts`: `enqueue` (cap 100, FIFO), `replayQueue(queue, sender)`
  berhenti di gagal pertama agar urutan tidak lompat, `loadQueue/saveQueue`
  (localStorage `veritas:offline-queue:v1`, no-op di SSR).
- `public/sw.js`: block F13 (ditambah, bukan tulis ulang) — cache GET
  `/api/v1/projects|invoices|search` (network-first, fallback cache) di atas
  cache `/p/*` F7 yang dipertahankan.
- `components/sync-status.tsx`: `<SyncStatus/>` — dot online/offline, jumlah
  antrean, tombol "Sinkron sekarang" (POST ulang tiap aksi via fetch).
- Push: reuse `lib/push.ts` F7 (read-only — file itu TIDAK disentuh; klien hanya
  `import type { PushPayload }`). Pengiriman tetap server-side via `sendPush`.

Alur airplane-mode: offline → komentar masuk antrean → online → `replayQueue`
atau tombol Sync → terkirim berurutan.

## 4. Observability + feature flag

- `lib/obs.ts`: `logEvent(level, msg, fields)` — satu baris JSON ke stdout
  (siap Vercel/LogDrain), PII disensor via `lib/redact.ts` (email/telepon/rekening
  + key `password|secret|token|api-key|authorization` → `[disensor]`).
  `recordError/errorCount/errorSummary` — counter per menit, jendela 10 mnt,
  in-memory (reset tiap deploy = trade-off v1).
- Sentry (dokumen, tanpa SDK baru): set `SENTRY_DSN`, bungkus `logEvent("error")`
  dengan forward ke Sentry di wave integrasi; v1 cukup `errorSummary()` untuk
  dashboard mini + alert ambang (`last5m > N` → WA via notify-service F3).
  TODO: `@sentry/nextjs` + source-maps + sampling + halaman dashboard error rate.
- `lib/flags.ts`: `isEnabled("nama-flag")` dari env `VERITAS_FLAGS=csv`
  (`"public-api,white-label,semantic-search"`; `nama=0/false/off` = mati).
  Flag dikenal: public-api, white-label, offline-queue, semantic-search, push, sentry.
  Contoh pakai: `canHideBadge()` (white-label) + `<BrandHeader/>`. JANGAN edit
  file AI untuk flag — helper + test cukup (sesuai batasan F13).

## 5. Semantic search

`lib/semantic-search.ts` + `GET /v1/search` (guard API key, scope read).
v1: kandidat Prisma `contains(mode: insensitive)` atas Project/Invoice/Comment/Task
+ ranking token-overlap (judul 3x, body 1x, bonus frasa +2), filter
`projectId/kind/limit(≤50)`. TODO(embedding): kolom `embedding pgvector` +
index HNSW + re-rank cosine (F8 menunda ke F13 — tetap TODO sampai ada migrasi).

## 6. Backup (1 perintah)

`scripts/backup.sh` — `pg_dump` (custom+gz) + verifikasi + instruksi upload
(Supabase/S3/rclone). Lihat header script. Restore: `pg_restore -d "$DATABASE_URL"`.
TODO: jadwal harian (Vercel Cron/scheduler) + retensi + runbook restore teruji.
