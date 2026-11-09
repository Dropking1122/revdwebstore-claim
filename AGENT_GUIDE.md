# PANDUAN STRUKTUR CODE & ARSITEKTUR REVDSTORE-CLAIM
> Dokumen referensi untuk AI Agent dan Pengembang berikutnya agar langsung memahami arsitektur, alur kerja (workflow), dan aturan main codebase `revdstore-claim`.

---

## 1. Ringkasan Sistem & Tech Stack
- **Nama Sistem**: REVDSTORE Digital Claim Hub
- **Fungsi Utama**: Platform web klaim produk/akun/lisensi digital gratis dengan sistem proteksi anti-abuse, cooldown batch, dan panel pengelola (admin).
- **Domain Produksi**: `sawit.revd.dev` (Nginx Reverse Proxy -> Node.js `127.0.0.1:5080`)
- **Tech Stack**:
  - **Backend**: Node.js v20+, Express.js 5.x (Native CommonJS, tanpa framework berat).
  - **Database**: PostgreSQL (`pg` Connection Pool), schema di `init_db.sql`.
  - **Frontend**: Vanilla HTML5, CSS3 Neobrutalism, Vanilla JS (`app.js` & `admin.js`).
  - **Daemon/Process**: PM2 (`revdstore-claim`), systemd, Cronjob (`/etc/cron.d/revdstore-backup`).

---

## 2. Struktur Direktori & File

```
/root/revdstore-claim/
├── .env                  # Konfigurasi environment (PORT, DB, SECRET_PATH, PASSWORD) [Mode 0600]
├── .env.example          # Template environment untuk deployment baru
├── .gitignore            # Mengabaikan node_modules, .env, backups/*.sql*, *.bak
├── package.json          # Dependensi minimal (express, pg, multer, cookie-parser, express-rate-limit)
├── db.js                 # Inisialisasi pool PostgreSQL (max: 20 koneksi)
├── init_db.sql           # DDL Skema database PostgreSQL lengkap dengan index
├── install.sh            # Skrip instalasi interaktif + TMUX wrapper untuk server baru/migrasi
├── server.js             # Monolitik server backend (~1.100 baris): API publik, admin, SSR meta tags
├── private/
│   └── admin.html        # UI Panel Admin (Hanya disajikan via ADMIN_SECRET_PATH)
├── public/
│   ├── index.html        # UI Landing Page & Modal Klaim
│   ├── css/
│   │   └── style.css     # Neobrutalism CSS theme (Dark Mode, high contrast, Space Grotesk)
│   ├── js/
│   │   ├── app.js        # Logika klien pengguna: fingerprinting, token, klaim, riwayat, tabs
│   │   └── admin.js      # Logika klien admin: CRUD produk, item batch, logs, backup & restore
│   └── uploads/          # Direktori berkas citra statis (logo, banner, icon produk)
├── scripts/
│   ├── backup.sh         # Skrip dump pg_dump (kompresi .sql.gz, rotasi retensi 14 hari)
│   └── restore.sh        # Skrip restore database via psql gunzip
├── backups/              # Direktori penyimpanan snapshot backup harian & manual
├── AUDIT_REPORT.md       # Catatan temuan audit historis
└── AGENT_GUIDE.md        # Dokumen ini (Handbook agen berikutnya)
```

---

## 3. Skema Data (PostgreSQL)

```sql
-- 1. products: Data master kategori/tipe produk yang dapat diklaim
products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    badge_text VARCHAR(50) DEFAULT 'GRATIS',
    item_type VARCHAR(20) DEFAULT 'account',  -- 'account' | 'voucher' | 'license' | 'link'
    icon VARCHAR(100) DEFAULT '🎁',
    color_theme VARCHAR(50) DEFAULT 'yellow',
    image_url TEXT,
    cooldown_days INT DEFAULT 0,              -- 0 = Klaim 1x selamanya; >0 = jeda hari per batch
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. product_items: Stok isi akun/lisensi mentah per produk
product_items (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    content TEXT NOT NULL,                    -- Konten kredensial (e.g. email:pass atau link)
    notes TEXT,                               -- Catatan/instruksi login khusus
    max_claims INT DEFAULT 1,                 -- Kapasitas klaim (1 = eksklusif, >1 = shared)
    current_claims INT DEFAULT 0,             -- Berapa kali item ini telah diklaim
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_current_claims_limit CHECK (current_claims <= max_claims)
);

-- 3. claim_logs: Audit trail setiap transaksi klaim yang berhasil
claim_logs (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    item_id INT REFERENCES product_items(id) ON DELETE SET NULL,
    user_token VARCHAR(128) NOT NULL,         -- Token unik pengguna (disimpan di cookie & localStorage)
    ip_address VARCHAR(64) NOT NULL,          -- IP publik pengguna (Nginx real-ip)
    device_id VARCHAR(64),                    -- Canvas/WebGL device fingerprint
    user_agent TEXT,
    claimed_content TEXT NOT NULL,            -- Snapshot konten saat klaim (tetap ada meski item dihapus)
    claimed_notes TEXT,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. site_settings: Pengaturan dinamis konfigurasi web (Key-Value)
site_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. admin_logs: Audit log aktivitas sensitif panel admin
admin_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 4. Alur Kerja Inti (Core Workflows)

### A. Alur Klaim Pengguna (Public Claim Flow)
1. **Identitas Pengguna**:
   - Di sisi klien (`app.js`), pengguna diidentifikasi menggunakan kombinasi:
     - `USER_TOKEN`: UUID acak tersimpan di `localStorage` & cookie `user_claim_token`.
     - `DEVICE_ID`: Hash kanvas HTML5 + WebGL renderer + screen geometry (anti-incognito).
     - `Client IP`: Didapatkan server melalui header `X-Real-IP` dari Nginx.
2. **Endpoint `POST /api/claim`**:
   - Terpasang middleware `claimLimiter` (maksimal 10 klaim per menit per IP).
   - Membuka transaksi database (`BEGIN`).
   - **Advisory Lock**: Mengambil lock transaksional PostgreSQL:
     ```sql
     SELECT pg_advisory_xact_lock(hashtext('claim_user_' || $1 || '_' || $2)),
            pg_advisory_xact_lock(hashtext('claim_ip_' || $1 || '_' || $3)),
            pg_advisory_xact_lock(hashtext('claim_dev_' || $1 || '_' || COALESCE($4, $2)))
     ```
     *Tujuan*: Mencegah race condition TOCTOU dari pengguna yang mengirim request paralel bersamaan.
3. **Pengecekan Cooldown Anti-Abuse**:
   - Mengecek `claim_logs` apakah `user_token`, `ip_address`, atau `device_id` sudah pernah mengklaim produk ini.
   - **Logika Cooldown Batch**:
     - Jika `cooldown_days == 0`: Hanya boleh 1x klaim selamanya.
     - Jika `cooldown_days > 0`: Masa aktif dihitung dari `item_created_at + cooldown_days`. Pengguna hanya dilarang klaim selama batch tersebut masih berjalan; jika batch baru sudah diposting dan masa batch lama habis, pengguna bisa klaim lagi.
4. **Alokasi Stok & Deduplikasi**:
   - Menjalankan `SELECT ... FROM product_items WHERE product_id = $1 AND is_active = true AND current_claims < max_claims ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`.
   - Menginkrementasi `current_claims = current_claims + 1`.
   - Mencatat ke `claim_logs` lengkap dengan snapshot isi akun.
   - `COMMIT` transaksi dan mengembalikan data akun ke klien.

### B. Alur Autentikasi & Panel Admin
1. **Rute Tersembunyi (Obfuscation)**:
   - Panel admin tidak dapat diakses di `/admin` (rute ini sengaja merespons 404).
   - Disajikan secara dinamis pada `ADMIN_SECRET_PATH` (default: `/revd-manage-gate` sesuai isi `.env`).
2. **Login & Session Management**:
   - Endpoint `POST /api/admin/login` dilindungi `adminLoginLimiter` (max 5 gagal / 15 menit).
   - Membandingkan token/password menggunakan `crypto.timingSafeEqual` (`safeCompare`).
   - Membuat token sesi acak 256-bit (`crypto.randomBytes(32)`), disimpan di `activeAdminSessions` (in-memory Map dengan TTL 7 hari).
   - Mengirim cookie `admin_token` (HTTP-Only, Secure jika HTTPS, SameSite: Lax).
   - Background interval membersihkan sesi kedaluwarsa setiap 30 menit.
3. **Ganti Password/Token**:
   - `POST /api/admin/change-password` memvalidasi password lama, menulis password baru langsung ke file `.env` (dengan sanitasi newline dan permission `0600`), memperbarui `ADMIN_PASSWORD` in-memory, lalu mengosongkan seluruh sesi aktif (`activeAdminSessions.clear()`).

### C. Alur Manajemen Stok Massal (Bulk Ingestion)
- Endpoint `POST /api/admin/products/:id/items`.
- Menerima `items` (array atau teks multiline dipisah `\n`).
- Menggunakan **Multi-Row Parameterized Single Query** `INSERT INTO product_items VALUES ($1, $2, ...), ...` dalam 1 transaksi ACID, mencegah bug loop N+1.

### D. Alur Backup & Pemulihan Database
1. **Snapshot Otomatis**:
   - Cron `/etc/cron.d/revdstore-backup` memicu `scripts/backup.sh` setiap pukul 02:00 dini hari.
   - Hasil backup berupa `backups/revdstore_claim_backup_YYYYMMDD_HHMMSS.sql.gz`.
   - Retensi otomatis 14 hari (`find ... -mtime +14 -delete`).
2. **Snapshot & Restore Manual via Web**:
   - `POST /api/admin/backups/create`: Memicu `scripts/backup.sh` via `execFile`.
   - `POST /api/admin/backups/upload`: Unggah file `.sql` atau `.sql.gz` dengan validasi ekstensi & ukuran.
   - `POST /api/admin/backups/restore/:filename`: Menjalankan `scripts/restore.sh` via `spawn` dengan parameter array aman (bebas shell injection) dan flag `RESTORE_AUTO_CONFIRM=y`.

---

## 5. Security Invariants (Aturan Keras yang TIDAK Boleh Dilanggar)

1. **JANGAN Pernah Bind ke `0.0.0.0`**:
   `server.js` HARUS selalu mendengarkan pada `127.0.0.1:${PORT}`. Seluruh akses publik harus melewati Nginx Reverse Proxy agar TLS, Cloudflare Real IP, dan rate limiting perimeter tetap aktif.
2. **JANGAN Pernah Simpan Password Admin dalam Plaintext Cookie**:
   Autentikasi WAJIB menggunakan token sesi ephemeral acak (`activeAdminSessions`), bukan nilai plaintext `ADMIN_PASSWORD`.
3. **JANGAN Bypass Transaksi & Advisory Lock pada Alur Klaim**:
   Setiap alur klaim HARUS diawali dengan `BEGIN`, advisory lock PostgreSQL per user/IP/device, `FOR UPDATE` pada item, dan diakhiri `COMMIT`/`ROLLBACK`.
4. **JANGAN Pernah Interpolasikan String Shell**:
   Pemanggilan `scripts/backup.sh` atau `scripts/restore.sh` HARUS selalu menggunakan parameter array (`execFile` atau `spawn('bash', [script, arg])`), BUKAN `spawn('bash', ['-c', ...])` yang rentan command injection.
5. **JANGAN Mengizinkan Newline pada Penulisan `.env`**:
   Setiap nilai yang ditulis ke `.env` wajib dicek terhadap regex `[\r\n]` untuk mencegah korupsi format file `.env`.
6. **Pastikan File `.env` Selalu Permissions `0600`**:
   Hanya user root/owner yang boleh membaca kredensial database dan token admin.

---

## 6. Prosedur Deployment & Perintah Berguna

- **Cek Status Proses**:
  ```bash
  pm2 status revdstore-claim
  pm2 logs revdstore-claim --lines 50
  ```
- **Restart Aplikasi**:
  ```bash
  pm2 restart revdstore-claim
  ```
- **Cek Koneksi Database**:
  ```bash
  psql "$DATABASE_URL" -c "\dt"
  ```
- **Backup Manual Cepat**:
  ```bash
  bash /root/revdstore-claim/scripts/backup.sh
  ```
- **Restore Manual**:
  ```bash
  bash /root/revdstore-claim/scripts/restore.sh /root/revdstore-claim/backups/<filename>.sql.gz
  ```
