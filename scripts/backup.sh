#!/usr/bin/env bash
# F13 backup 1-perintah: pg_dump (custom + gzip) + verifikasi.
# Pakai:  DATABASE_URL=postgres://... ./scripts/backup.sh [out-dir]
#         BACKUP_ENCRYPT_GPG=keys@example.com ./scripts/backup.sh  (opsional enkripsi)
# Upload (instruksi, bukan otomatis — isi kredensial masing-masing):
#   Supabase: dashboard > Database > Backups > Restore, atau
#             pg_restore -d "$DATABASE_URL" backupfile.dump
#   S3:       aws s3 cp "$FILE" s3://bucket/veritas/
#   rclone:   rclone copy "$FILE" remote:veritas-backup/
# Restore: pg_restore --clean --if-exists -d "$DATABASE_URL" "$FILE"
set -euo pipefail
OUT_DIR="${1:-./tmp/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"
if [ -z "${DATABASE_URL:-}" ]; then echo "DATABASE_URL kosong" >&2; exit 1; fi
command -v pg_dump >/dev/null || { echo "pg_dump tidak ditemukan (instal postgresql-client)" >&2; exit 1; }
FILE="$OUT_DIR/veritas-$STAMP.dump.gz"
pg_dump --format=custom --compress=9 "$DATABASE_URL" | gzip -9 > "$FILE"
ls -lh "$FILE"
if command -v pg_restore >/dev/null; then pg_restore --list "$FILE" >/dev/null && echo "verify: OK ($FILE)"; fi
if [ -n "${BACKUP_ENCRYPT_GPG:-}" ]; then gpg --encrypt --recipient "$BACKUP_ENCRYPT_GPG" --output "$FILE.gpg" "$FILE" && echo "encrypted: $FILE.gpg"; fi
echo "TODO: jadwal harian (cron/scheduler) + retensi 30 hari + uji restore berkala."
