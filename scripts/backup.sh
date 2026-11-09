#!/usr/bin/env bash
# ==============================================================================
# REVDSTORE CLAIM HUB - DATABASE BACKUP SCRIPT
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups"
ENV_FILE="$PROJECT_ROOT/.env"

mkdir -p "$BACKUP_DIR"

# Read DATABASE_URL from .env
if [ -f "$ENV_FILE" ]; then
  # Extract DATABASE_URL handling special characters safely
  DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
else
  echo "[ERROR] File .env tidak ditemukan di $PROJECT_ROOT" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL tidak terdefinisi di file .env" >&2
  exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="revdstore_claim_backup_${TIMESTAMP}.sql.gz"
OUTPUT_FILE="$BACKUP_DIR/$FILENAME"

COMPRESS=true
for arg in "$@"; do
  if [ "$arg" == "--plain" ]; then
    COMPRESS=false
    FILENAME="revdstore_claim_backup_${TIMESTAMP}.sql"
    OUTPUT_FILE="$BACKUP_DIR/$FILENAME"
  fi
done

if [ "$COMPRESS" = true ]; then
  pg_dump "$DATABASE_URL" --clean --if-exists | gzip > "$OUTPUT_FILE"
else
  pg_dump "$DATABASE_URL" --clean --if-exists > "$OUTPUT_FILE"
fi

FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

# Retention policy: remove backups older than 14 days
find "$BACKUP_DIR" -type f -name "revdstore_claim_backup_*.sql*" -mtime +14 -delete 2>/dev/null || true

echo "[SUCCESS] Backup berhasil dibuat: $FILENAME ($FILE_SIZE)"
echo "$OUTPUT_FILE"
