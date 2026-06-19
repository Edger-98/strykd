#!/usr/bin/env bash
#
# Strykd Postgres backup — gzipped pg_dump with local rotation.
# Installed as a daily cron job (see the cron.d block in this repo / below).
#
# Restore (DESTRUCTIVE — drops and recreates current data):
#   gunzip -c /home/ubuntu/backups/strykd-YYYYMMDDTHHMMSSZ.sql.gz \
#     | docker exec -i strykd_postgres psql -U strykd -d strykd
#
# Off-site: these dumps live on the same EC2 volume as the DB, which protects
# against bad migrations / accidental deletes / corruption, NOT instance loss.
# For real DR, set BACKUP_S3_BUCKET to a PRIVATE bucket (do NOT reuse the public
# proof bucket) and add an upload step, or move Postgres to RDS with snapshots.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
CONTAINER="${PG_CONTAINER:-strykd_postgres}"
DB_USER="${PG_USER:-strykd}"
DB_NAME="${PG_DB:-strykd}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/strykd-$STAMP.sql.gz"
TMP="$FILE.partial"

# Dump from inside the container, gzip on the host. --partial then atomic move
# so a failed/interrupted dump never leaves a truncated "good" backup.
if docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$TMP"; then
  mv "$TMP" "$FILE"
  chmod 600 "$FILE"
  echo "$(date -u +%FT%TZ) backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
else
  rm -f "$TMP"
  echo "$(date -u +%FT%TZ) backup FAILED" >&2
  exit 1
fi

# Rotate: delete dumps older than the retention window.
find "$BACKUP_DIR" -name 'strykd-*.sql.gz' -mtime "+$RETAIN_DAYS" -delete
