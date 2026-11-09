# 🌐 PANDUAN ARSITEKTUR MULTI-SERVER (DISTRIBUTED SETUP)

Dokumen ini adalah standar arsitektur agar seluruh layanan (**Web Store/Claim**, **Telegram Bot**, dan **Payment Gateway**) siap dijalankan pada **1 server** maupun **terpisah di beberapa server berbeda** tanpa perlu merombak kode.

---

## 1. Prinsip Utama: Zero Hardcoded Localhost

Semua komunikasi antar-layanan wajib menggunakan **Environment Variables (`.env`)**.

| Variabel | Jika 1 Server (Localhost) | Jika Beda Server (Multi-Server) |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://user:pass@127.0.0.1:5432/dbname` | `postgresql://user:pass@IP_DB_SERVER:5432/dbname?sslmode=require` |
| `PG_HUB_URL` | `http://127.0.0.1:7000` | `https://pg.revdstore.app` atau `http://IP_PG:7000` |
| `PG_API_KEY` | `pg_live_revd_master` | Token API Key acak minimal 32 karakter |
| `WEB_STORE_URL` | `http://127.0.0.1:5080` | `https://sawit.revd.dev` |
| `TELEGRAM_BOT_API_URL`| `http://127.0.0.1:5050` | `https://revdstore.app` |

---

## 2. Pengamanan Komunikasi Antar-Server

Ketika layanan berada di server yang terpisah dan melintasi jaringan internet publik:

```
┌────────────────────────┐                    ┌────────────────────────┐
│  Server A: Web Store   │                    │  Server B: Payment GW  │
│    (sawit.revd.dev)    │                    │   (pg.revdstore.app)   │
└───────────┬────────────┘                    └───────────┬────────────┘
            │                                             │
            │  1. Create QRIS (Header: x-api-key + TLS)    │
            │────────────────────────────────────────────>│
            │                                             │
            │  2. Webhook Settlement (HMAC-SHA256 Sig)    │
            │<────────────────────────────────────────────│
```

1. **Autentikasi Header (`x-api-key`)**:
   - Setiap permintaan REST API antar server wajib menyertakan API Key terenkripsi pada header HTTP.
2. **Validasi Signature Webhook (HMAC-SHA256)**:
   - Saat Payment Gateway mengirimkan status bayar ke Web Store, payload ditandatangani menggunakan *secret key* bersama.
   - Web Store memvalidasi `crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex')` sebelum melepas stok barang. Ini mencegah serangan *spoofing* / injeksi fake webhook.
3. **Idempotency Guard**:
   - Jika terjadi network timeout antar server dan webhook terkirim 2 kali, server penerima memeriksa apakah `order_id` sudah berstatus `paid`. Jika sudah, respon `200 OK` tanpa mengeluarkan stok ganda.
4. **Firewall (UFW)**:
   - Port 5432 (PostgreSQL) atau port API internal hanya dibuka secara spesifik untuk IP server pasangannya:
     ```bash
     ufw allow from IP_SERVER_A to any port 5432 proto tcp
     ```

---

## 3. Pilihan Model Basis Data (Multi-Server)

### Model 1: Database Terpusat (Central DB)
- **Konsep**: PostgreSQL ditempatkan di salah satu server (misal Server Bot/Utama) dengan port 5432 dibuka khusus untuk IP Server Web Store.
- **Kelebihan**: Data stok, order, dan user langsung sinkron 100% *real-time* tanpa perlu integrasi sinkronisasi tambahan.
- **Rekomendasi**: Opsi paling sederhana dan handal untuk arsitektur 2–3 server.

### Model 2: Database Terpisah + REST Contract
- **Konsep**: Masing-masing server memiliki database lokal sendiri. Komunikasi hanya dilakukan via REST API:
  - Web Store memanggil `POST /api/v1/orders` ke Server Bot untuk reservasi stok.
  - Payment Gateway mengirim webhook ke Web Store untuk penyelesaian transaksi.
- **Kelebihan**: Tidak ada port database yang terekspos keluar. Server web tetap bisa beroperasi meski server lain sedang restart.
