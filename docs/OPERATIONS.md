# OPERATIONS — Veritas (wave integrasi)

Panduan deploy DB, backfill, cron, backup/restore + daftar PENDING.
Semua perintah dari root `src/` kecuali disebut lain.

## 1. Migrate (urutan — JANGAN loncat)

Butuh `DIRECT_URL` reachable (lihat `.env.example`). Lalu:

```
npx prisma migrate deploy
```

Urutan folder `prisma/migrations/` (diterapkan berurutan otomatis):

1. `20260626061802_init_rebase` — base (User, Project, Invoice, Milestone, Handsout…)
2. `20260629151221_add_provider_field_invoice` — kolom provider invoice
3. `20260713000000_add_escrow` — Escrow + EscrowEvent
4. `20260822000000_sync_schema_drift` — sinkron drift schema
5. `20261002000000_f1_share_token` — Project.access_key + ProjectShareToken
6. `20261002000001_f2_dispute_comment` — Comment + Dispute
7. `20261002000002_f4_payout_termin` — Invoice milestone_id/number/type + Payout
8. `20261002000003_f5_f12_models` — Proposal/Contract/Lead/Review/Retainer/Expense/Task/Attachment/ActivityEvent/TimeEntry/ServicePackage/Referral/Coupon/Workspace/Member/ClientCompany/Ticket/HandoverNote
9. `20261002000004_wave_integrasi` — **BARU**: NotifyLog + FreelancerSetting + User.phone + FreelancerProfile bio/skills/hourlyRate/waNumber + Project.workspaceId + Ticket.assignee

Dev tanpa DB reachable: `npx prisma db push` (tidak untuk prod).
Sesudah migrate: `npx prisma generate` (client ada di `generated/prisma/`).

## 2. Backfill scripts

| Script | Perintah | Status |
|---|---|---|
| `scripts/backfill-access-key.ts` | `npx tsx scripts/backfill-access-key.ts` | WAJIB saat DB reachable (F1) |
| Clerk role → privateMetadata | Dashboard Clerk / API: salin `publicMetadata.role` → `privateMetadata.role` per user, lalu hapus dari public | WAJIB sebelum/sesudah deploy hardening F7 — akun lama tanpa private role diarahkan `/onboarding` ulang |
| `FreelancerSetting` | tidak perlu backfill (fallback env otomatis) | opsional: isi via halaman settings |
| `NotifyLog` | tidak perlu backfill (append-only) | — |

## 3. Cron setup (Vercel)

`vercel.json` → `crons` (sudah terisi, jangan hapus):

| Path | Jadwal | Fungsi |
|---|---|---|
| `/api/cron/reminders` | `0 7 * * *` (07:00 harian) | reminder H-3/H+0/H+1 via Resend/WA |
| `/api/cron/auto-release` | `30 2 * * *` (02:30 harian) | rilis escrow diam > N hari + tanpa dispute OPEN |
| `/api/cron/retainer` | `0 3 1 * *` (tgl 1, 03:00) | generate invoice RETAINER bulanan |

Syarat: set env `CRON_SECRET` di Vercel (guard Bearer; tanpa itu semua cron = 401).
Verifikasi tanpa kirim: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/<nama>?dryRun=1`.
Dashboard kiriman: `NotifyLog` (query by template + sentAt).

## 4. Backup / restore

- Backup 1-perintah: `DATABASE_URL=... ./scripts/backup.sh [out-dir]` → `tmp/backups/veritas-<stamp>.dump.gz` (+ verifikasi `pg_restore --list`).
- Restore: `pg_restore --clean --if-exists -d "$DATABASE_URL" <file>`.
- Supabase: Dashboard > Database > Backups > Restore (alternatif).
- Jadwal harian + retensi 30 hari + uji restore berkala = PENDING (lihat bawah).

## 5. PENDING (butuh DB / kredensial / aksi manusia)

- [ ] `prisma migrate deploy` + backfill access-key — butuh DB reachable (`DIRECT_URL`).
- [ ] Clerk privateMetadata backfill akun lama (di atas) — butuh akses dashboard Clerk.
- [ ] `RESEND_API_KEY` — tanpa ini email = stub log (dev), tidak terkirim.
- [ ] `WA_API_KEY` (+ `WA_PROVIDER=fonnte|wablas`) — tanpa ini WA = stub log.
- [ ] User.phone (klien) + FreelancerProfile.waNumber — diisi via UI/onboarding; reminder WA skip bila kosong.
- [ ] VAPID keys (`VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT`) + `npm i web-push` — push F7 (milik agen F13; DILARANG disentuh wave ini).
- [ ] `UPSTASH_REDIS_REST_URL/TOKEN` — tanpa ini rate-limit = in-memory fallback.
- [ ] `AI_API_KEY` — tanpa ini fitur AI = stub elegan.
- [ ] Backup harian terjadwal + retensi + uji restore.
- [ ] Halaman log dashboard NotifyLog + halaman audit log + Jurnal/Xero CSV + PNG 192/512 + antre offline — milik agen F13 / iterasi berikut.
