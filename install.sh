#!/usr/bin/env bash
# ==============================================================================
# REVDSTORE CLAIM HUB - AUTOMATED SERVER INSTALLER & MIGRATION SCRIPT
# ==============================================================================
# Features:
#   1. Automatic TMUX multiplexing (safe against SSH drops)
#   2. Interactive Domain & Configuration Prompt
#   3. Full Dependency Setup (Node.js LTS, PostgreSQL, Nginx, Certbot, PM2)
#   4. Database Configuration & Backup Restore Support
#   5. Dynamic Nginx Reverse Proxy with Let's Encrypt SSL
#   6. Automated Daily Database Backup Cronjob
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# 1. TMUX MULTIPLEXING WRAPPER
# ------------------------------------------------------------------------------
SESSION_NAME="revdclaim-install"

if [ -z "${TMUX:-}" ] && [ "${1:-}" != "--no-tmux" ]; then
    echo "=================================================================="
    echo "       🚀 REVDSTORE CLAIM HUB - INSTALLER SERVER BARU"
    echo "=================================================================="
    echo "Untuk mencegah instalasi gagal akibat koneksi SSH terputus,"
    echo "skrip ini akan otomatis dijalankan di dalam sesi TMUX: '$SESSION_NAME'"
    echo "=================================================================="
    
    # Ensure tmux is installed
    if ! command -v tmux &>/dev/null; then
        echo "[1/2] Menginstal tmux..."
        apt-get update -y && apt-get install -y tmux
    fi

    echo "[2/2] Membuka sesi tmux '$SESSION_NAME'..."
    sleep 1

    # Check if session already exists
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo "Sesi '$SESSION_NAME' sudah berjalan. Menyambungkan kembali (attach)..."
        exec tmux attach -t "$SESSION_NAME"
    fi

    # Create new session and launch this script with --no-tmux flag
    exec tmux new-session -s "$SESSION_NAME" "bash \"$0\" --no-tmux \"$@\"; exec bash"
fi

# ------------------------------------------------------------------------------
# 2. PRIVILEGE & ENVIRONMENT CHECK
# ------------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
    echo -e "\033[1;31m[ERROR] Skrip ini harus dijalankan sebagai root (atau sudo).\033[0m"
    exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

clear || true
echo "=================================================================="
echo "       🚀 REVDSTORE CLAIM HUB - SERVER INSTALLER & MIGRATION"
echo "=================================================================="
echo " Direktori Proyek: $PROJECT_DIR"
echo " Sesi Tmux       : ${TMUX:-Standalone / Attached}"
echo " Waktu Server    : $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================================="
echo ""

# ------------------------------------------------------------------------------
# 3. INTERACTIVE INPUTS (DOMAIN & CONFIGURATION)
# ------------------------------------------------------------------------------
echo "--- [LANGKAH 1: KONFIGURASI DOMAIN & SERVER] ---"

DOMAIN=""
while [ -z "$DOMAIN" ]; do
    read -rp "Masukkan Nama Domain (contoh: sawit.revd.dev): " INPUT_DOMAIN
    # Clean input: remove http://, https://, trailing slashes, whitespace
    CLEAN_DOMAIN=$(echo "$INPUT_DOMAIN" | sed -e 's|^https\?://||' -e 's|/.*$||' | tr -d '[:space:]')
    if [[ "$CLEAN_DOMAIN" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        DOMAIN="$CLEAN_DOMAIN"
    else
        echo -e "\033[1;31mFormat domain tidak valid! Contoh yang benar: claim.revdstore.app atau sawit.revd.dev\033[0m"
    fi
done

echo -e "\033[1;32m✓ Domain terpilih: $DOMAIN\033[0m\n"

# Port Configuration
read -rp "Masukkan Port Aplikasi [Default: 5080]: " INPUT_PORT
PORT="${INPUT_PORT:-5080}"

# Admin Secret Path
read -rp "Masukkan Secret Path Admin [Default: /revd-manage-gate]: " INPUT_SECRET_PATH
ADMIN_SECRET_PATH="${INPUT_SECRET_PATH:-/revd-manage-gate}"
if [[ ! "$ADMIN_SECRET_PATH" =~ ^/ ]]; then
    ADMIN_SECRET_PATH="/$ADMIN_SECRET_PATH"
fi

# Admin Token/Password
DEFAULT_ADMIN_PASS=$(openssl rand -hex 16 2>/dev/null || date +%s%N | sha256sum | head -c 24)
read -rp "Masukkan Token/Password Admin (kosongkan untuk generate acak): " INPUT_ADMIN_PASS
ADMIN_PASSWORD="${INPUT_ADMIN_PASS:-$DEFAULT_ADMIN_PASS}"

# Database Configuration
read -rp "Nama Database PostgreSQL [Default: revdstore_claim]: " INPUT_DB_NAME
DB_NAME="${INPUT_DB_NAME:-revdstore_claim}"

read -rp "User Database PostgreSQL [Default: revd_claim_user]: " INPUT_DB_USER
DB_USER="${INPUT_DB_USER:-revd_claim_user}"

DEFAULT_DB_PASS=$(openssl rand -hex 12 2>/dev/null || date +%s%N | md5sum | head -c 16)
read -rp "Password User Database (kosongkan untuk generate acak): " INPUT_DB_PASS
DB_PASS="${INPUT_DB_PASS:-$DEFAULT_DB_PASS}"

# Check for existing backups to restore
RESTORE_FILE=""
BACKUP_FILES=()
if [ -d "$PROJECT_DIR/backups" ]; then
    while IFS= read -r f; do
        [ -n "$f" ] && BACKUP_FILES+=("$f")
    done < <(find "$PROJECT_DIR/backups" -maxdepth 1 -name "revdstore_claim_backup_*.sql*" | sort -r || true)
fi

echo ""
echo "--- [LANGKAH 2: RESTORE DATABASE DARI BACKUP] ---"
if [ ${#BACKUP_FILES[@]} -gt 0 ]; then
    echo "Ditemukan berkas backup di folder backups/:"
    for i in "${!BACKUP_FILES[@]}"; do
        echo "  [$((i+1))] $(basename "${BACKUP_FILES[$i]}")"
    done
    echo "  [0] Instalasi Bersih Baru (Tanpa restore, gunakan init_db.sql)"
    read -rp "Pilih nomor backup yang ingin di-restore [0-${#BACKUP_FILES[@]}, Default: 0]: " RESTORE_CHOICE
    RESTORE_CHOICE="${RESTORE_CHOICE:-0}"
    if [ "$RESTORE_CHOICE" -gt 0 ] && [ "$RESTORE_CHOICE" -le "${#BACKUP_FILES[@]}" ]; then
        RESTORE_FILE="${BACKUP_FILES[$((RESTORE_CHOICE-1))]}"
        echo -e "\033[1;32m✓ Akan memulihkan database dari: $(basename "$RESTORE_FILE")\033[0m"
    else
        echo -e "\033[1;33m✓ Menggunakan skema awal baru (init_db.sql).\033[0m"
    fi
else
    read -rp "Ada berkas backup (.sql / .sql.gz) di path lain yang ingin di-restore? (kosongkan jika tidak ada): " CUSTOM_RESTORE
    if [ -n "$CUSTOM_RESTORE" ] && [ -f "$CUSTOM_RESTORE" ]; then
        RESTORE_FILE="$CUSTOM_RESTORE"
        echo -e "\033[1;32m✓ Akan memulihkan database dari: $RESTORE_FILE\033[0m"
    else
        echo "✓ Menggunakan skema awal baru (init_db.sql)."
    fi
fi

echo ""
echo "=================================================================="
echo " Konfirmasi Pengaturan:"
echo "   Domain        : $DOMAIN"
echo "   Port Aplikasi : $PORT"
echo "   Secret Path   : $ADMIN_SECRET_PATH"
echo "   Database      : $DB_NAME (User: $DB_USER)"
echo "   Restore File  : ${RESTORE_FILE:-None (Fresh Database)}"
echo "=================================================================="
read -rp "Mulai proses instalasi sekarang? (Y/n): " CONFIRM
CONFIRM="${CONFIRM:-Y}"
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Instalasi dibatalkan oleh pengguna."
    exit 0
fi

echo ""
echo "--- [LANGKAH 3: INSTALASI DEPENDENSI SISTEM] ---"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
    curl \
    wget \
    git \
    tmux \
    ufw \
    cron \
    gzip \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    postgresql \
    postgresql-contrib \
    nginx \
    certbot \
    python3-certbot-nginx \
    dnsutils

# Node.js LTS Check & Install
NODE_INSTALLED=false
if command -v node &>/dev/null; then
    NODE_MAJOR=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_MAJOR" -ge 20 ]; then
        echo -e "\033[1;32m✓ Node.js $(node -v) sudah terinstal.\033[0m"
        NODE_INSTALLED=true
    fi
fi

if [ "$NODE_INSTALLED" = false ]; then
    echo "Menginstal Node.js LTS v20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# PM2 Global Install
if ! command -v pm2 &>/dev/null; then
    echo "Menginstal PM2 process manager..."
    npm install -g pm2
fi

echo ""
echo "--- [LANGKAH 4: KONFIGURASI POSTGRESQL] ---"
systemctl enable --now postgresql

# Create Database & User
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';"

# Set password and permissions
sudo -u postgres psql -c "ALTER USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# PostgreSQL 15+ public schema grants
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO $DB_USER;" 2>/dev/null || true

# Initialize Schema or Restore Data
if [ -n "$RESTORE_FILE" ] && [ -f "$RESTORE_FILE" ]; then
    echo "Memulihkan database dari $RESTORE_FILE..."
    if [[ "$RESTORE_FILE" == *.gz ]]; then
        gunzip -c "$RESTORE_FILE" | PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" --quiet
    else
        PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -f "$RESTORE_FILE" --quiet
    fi
    echo -e "\033[1;32m✓ Restorasi database selesai.\033[0m"
else
    echo "Menginisialisasi tabel database baru dari init_db.sql..."
    PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -f "$PROJECT_DIR/init_db.sql" --quiet
    echo -e "\033[1;32m✓ Inisialisasi skema database selesai.\033[0m"
fi

echo ""
echo "--- [LANGKAH 5: KONFIGURASI APLIKASI & ENVIRONMENT] ---"
mkdir -p "$PROJECT_DIR/backups" "$PROJECT_DIR/public/uploads" "$PROJECT_DIR/scripts"
chmod 755 "$PROJECT_DIR/public/uploads" "$PROJECT_DIR/scripts"
chmod 700 "$PROJECT_DIR/backups"

# Make helper scripts executable
chmod +x "$PROJECT_DIR/scripts/backup.sh" 2>/dev/null || true
chmod +x "$PROJECT_DIR/scripts/restore.sh" 2>/dev/null || true

# Generate random secure session secret
SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s%N | sha256sum | head -c 64)

# Write .env file securely
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
cat << EOF > "$PROJECT_DIR/.env"
PORT=${PORT}
DATABASE_URL=${DATABASE_URL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_SECRET_PATH=${ADMIN_SECRET_PATH}
SESSION_SECRET=${SESSION_SECRET}
STRICT_IP_CHECK=true
BRAND_NAME=REVDSTORE
EOF
chmod 600 "$PROJECT_DIR/.env"
echo -e "\033[1;32m✓ File .env berhasil dibuat dengan izin ketat (chmod 600).\033[0m"

# Install npm dependencies
echo "Menginstal paket dependensi Node.js..."
npm install --production

echo ""
echo "--- [LANGKAH 6: KONFIGURASI REVERSE PROXY NGINX & SSL] ---"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

cat << 'EOF' > "$NGINX_CONF"
# Configuration for DOMAIN_PLACEHOLDER
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;

    client_max_body_size 15M;

    location / {
        proxy_pass http://127.0.0.1:PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standard Proxy Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Security & Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }
}
EOF

# Substitute placeholders
sed -i "s|DOMAIN_PLACEHOLDER|$DOMAIN|g" "$NGINX_CONF"
sed -i "s|PORT_PLACEHOLDER|$PORT|g" "$NGINX_CONF"

# Enable site
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMAIN"

# Test Nginx configuration
nginx -t
systemctl reload nginx
echo -e "\033[1;32m✓ Virtual Host Nginx untuk $DOMAIN berhasil diaktifkan.\033[0m"

# Check DNS Resolution before requesting SSL
echo "Memeriksa kesesuaian DNS untuk $DOMAIN..."
SERVER_PUBLIC_IP=$(curl -s -m 5 https://ifconfig.me || curl -s -m 5 https://api.ipify.org || echo "")
RESOLVED_IP=$(dig +short "$DOMAIN" | tail -n1 || echo "")

if [ -n "$SERVER_PUBLIC_IP" ] && [ "$RESOLVED_IP" = "$SERVER_PUBLIC_IP" ]; then
    echo -e "\033[1;32m✓ DNS cocok ($RESOLVED_IP). Memasang sertifikat SSL Let's Encrypt...\033[0m"
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect || {
        echo -e "\033[1;33m[PERINGATAN] Certbot gagal otomatis. Anda dapat menjalankannya nanti dengan: certbot --nginx -d $DOMAIN\033[0m"
    }
else
    echo -e "\033[1;33m[PERHATIAN] Domain $DOMAIN (IP: ${RESOLVED_IP:-tidak terdeteksi}) belum mengarah ke IP Server ($SERVER_PUBLIC_IP).\033[0m"
    echo "Setelah DNS A-Record diarahkan, aktifkan SSL dengan perintah:"
    echo -e "   \033[1;36mcertbot --nginx -d $DOMAIN\033[0m"
fi

echo ""
echo "--- [LANGKAH 7: MENJALANKAN DAEMON PM2] ---"
pm2 delete revdstore-claim 2>/dev/null || true
pm2 start server.js --name "revdstore-claim"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true
echo -e "\033[1;32m✓ Aplikasi berhasil berjalan di bawah PM2.\033[0m"

echo ""
echo "--- [LANGKAH 8: JADWAL OTOMATIS BACKUP DATABASE (CRON)] ---"
cat << EOF > /etc/cron.d/revdstore-backup
# REVDSTORE CLAIM HUB - Automated Database Backup Cron
# Runs daily at 02:00 AM server time
0 2 * * * root /bin/bash $PROJECT_DIR/scripts/backup.sh >/dev/null 2>&1
EOF
chmod 644 /etc/cron.d/revdstore-backup
echo -e "\033[1;32m✓ Jadwal backup harian otomatis (02:00 AM) berhasil dipasang di /etc/cron.d/revdstore-backup.\033[0m"

echo ""
echo "--- [LANGKAH 9: PENGATURAN FIREWALL UFW] ---"
if command -v ufw &>/dev/null; then
    ufw allow 22/tcp comment 'SSH' 2>/dev/null || true
    ufw allow 80/tcp comment 'Nginx HTTP' 2>/dev/null || true
    ufw allow 443/tcp comment 'Nginx HTTPS' 2>/dev/null || true
    ufw delete allow "$PORT/tcp" 2>/dev/null || true # Keep internal port closed
    echo -e "\033[1;32m✓ Port firewall 80, 443, dan 22 diamankan (Port $PORT terisolasi di localhost).\033[0m"
fi

echo ""
echo "=================================================================="
echo "          🎉 INSTALASI & MIGRASI BERHASIL DISELESAIKAN!          "
echo "=================================================================="
echo ""
echo " 🌐 Web Publik        : https://$DOMAIN"
echo " 🔐 Portal Admin      : https://$DOMAIN$ADMIN_SECRET_PATH"
echo " 🔑 Token Admin       : $ADMIN_PASSWORD"
echo " 📁 Lokasi Proyek     : $PROJECT_DIR"
echo " 📦 Database          : $DB_NAME (User: $DB_USER)"
echo " 💾 File Backup       : $PROJECT_DIR/backups"
echo ""
echo "------------------------------------------------------------------"
echo " 🛠️  PERINTAH PENTING PENGELOLA:"
echo "------------------------------------------------------------------"
echo " • Cek Status Aplikasi : pm2 status revdstore-claim"
echo " • Cek Log Realtime    : pm2 logs revdstore-claim"
echo " • Restart Aplikasi    : pm2 restart revdstore-claim"
echo " • Buat Backup Manual  : bash $PROJECT_DIR/scripts/backup.sh"
echo " • Restore Database    : bash $PROJECT_DIR/scripts/restore.sh <file_backup>"
echo " • Keluar dari Tmux    : Tekan 'Ctrl + b' lalu 'd'"
echo " • Buka Tmux Kembali   : tmux attach -t $SESSION_NAME"
echo "=================================================================="
echo ""
