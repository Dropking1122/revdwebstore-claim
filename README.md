# REVDSTORE Web Claim Hub

Platform web klaim produk digital gratis & manajemen stok berbasis Neobrutalism design.

## Fitur Utama
- **Desain Neobrutalism**: Tampilan kontras tinggi, typography Space Grotesk, dan dukungan Dark Mode.
- **Announcement Ticker**: Running text pengumuman dengan efek fade gradient.
- **Sistem Anti-Abuse**: Proteksi cooldown klaim berbasis IP, Cookie Token, dan Fingerprint Perangkat (`device_id`).
- **Sistem Token/Key**: Sinkronisasi riwayat klaim lintas perangkat menggunakan Token/Key unik tanpa autentikasi rumit.
- **Panel Pengelola Terisolasi**: Rute admin rahasia (`ADMIN_SECRET_PATH`), autentikasi timing-safe token, manajemen stok massal, upload aset gambar, dan pengaturan dinamis.
- **Hardened Security**: Express trust-proxy, rate limiter login, sanitasi MIME/ekstensi upload, dan isolasi localhost bind.

## Tech Stack
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (Tanpa framework berat)
- **Process Manager**: PM2

## Setup & Instalasi Cepat (Pindah Server)

Untuk instalasi server baru atau pindah VPS secara otomatis, gunakan script installer interaktif yang sudah dilengkapi **TMUX multiplexing** dan konfigurasi domain otomatis:

```bash
git clone https://github.com/Dropking1122/revdstore-webclaim.git
cd revdstore-webclaim
bash install.sh
```

> **Catatan TMUX**: Skrip otomatis berjalan di dalam sesi tmux `revdclaim-install`. Jika koneksi SSH terputus di tengah jalan, Anda cukup menyambungkan kembali dengan: `tmux attach -t revdclaim-install`.

## Manajemen Backup & Pemulihan Database

1. **Via Panel Admin (Web UI)**:
   - Buka menu **💾 Backup Database** di panel admin.
   - Buat snapshot baru, unduh langsung file `.sql.gz` ke komputer/ponsel, atau lakukan restore langsung.

2. **Via Command Line (CLI)**:
   - Buat backup baru secara manual:
     ```bash
     bash scripts/backup.sh
     ```
   - Pulihkan database dari file backup:
     ```bash
     bash scripts/restore.sh backups/revdstore_claim_backup_YYYYMMDD_HHMMSS.sql.gz
     ```

3. **Backup Otomatis (Cron)**:
   - Terjadwal otomatis setiap hari pukul 02:00 dini hari melalui `/etc/cron.d/revdstore-backup` dengan retensi rotasi otomatis 14 hari.

## Setup Manual
1. Clone repositori:
   ```bash
   git clone https://github.com/Dropking1122/revdstore-webclaim.git
   cd revdstore-webclaim
   ```
2. Salin environment dan atur kredensial:
   ```bash
   cp .env.example .env
   ```
3. Install dependensi:
   ```bash
   npm install
   ```
4. Inisialisasi basis data:
   ```bash
   psql -U username -d revdstore_claim -f init_db.sql
   ```
5. Jalankan server:
   ```bash
   npm start
   # atau via PM2:
   pm2 start server.js --name "revdstore-claim"
   ```
