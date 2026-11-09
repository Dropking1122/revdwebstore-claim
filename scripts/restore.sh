#!/usr/bin/env bash
# ==============================================================================
# REVDSTORE CLAIM HUB - DATABASE RESTORE SCRIPT
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
else
  echo "[ERROR] File .env tidak ditemukan di $PROJECT_ROOT" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL tidak terdefinisi di .env" >&2
  exit 1
fi

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Penggunaan: $0 <path_file_backup.sql atau .sql.gz>"
  echo ""
  echo "Daftar backup yang tersedia di $PROJECT_ROOT/backups:"
  ls -lh "$PROJECT_ROOT/backups"/*.sql* 2>/dev/null || echo "(Belum ada file backup)"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[ERROR] File backup tidak ditemukan: $BACKUP_FILE" >&2
  exit 1
fi

echo "PERINGATAN: Memulihkan database akan menimpa data yang ada saat ini!"
if [[ "${RESTORE_AUTO_CONFIRM:-}" == "y" ]]; then
  CONFIRM="y"
else
  read -p "Apakah Anda yakin ingin melanjutkan? (y/N): " CONFIRM
fi
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Proses restore dibatalkan."
  exit 0
fi

echo "[INFO] Memulihkan database dari $BACKUP_FILE..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" > /dev/null
else
  psql "$DATABASE_URL" < "$BACKUP_FILE" > /dev/null
fi

echo "[SUCCESS] Database berhasil dipulihkan dari $BACKUP_FILE!"
