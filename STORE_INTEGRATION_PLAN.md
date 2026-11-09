# 📐 RANCANGAN INTEGRASI STORE, GOOGLE AUTH, TELEGRAM BOT, & SISTEM KLAIM PROMOSI

**Status**: Draft Disetujui  
**Tanggal**: 1 November 2026  
**Domain Terkait**: `revdstore.app` (Port 5050), `sawit.revd.dev` (Port 5080), Internal PG (Port 7000)

---

## 1. Arsitektur Terpadu (Unified Architecture)

Sistem menggabungkan ekosistem **Toko Berbayar (Store)** dan **Klaim Akun Gratis (Promosi)** dalam satu platform backend dan basis data terkoordinasi:

```
                          ┌───────────────────────────┐
                          │   Pengguna / Calon Buyer  │
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
┌──────────────────────────────┐                          ┌──────────────────────────────┐
│       🎁 ZONA PROMOSI         │                          │        🛒 ZONA STORE          │
│        (Klaim Gratis)        │                          │      (Produk Berbayar)       │
├──────────────────────────────┤                          ├──────────────────────────────┤
│ • Bebas tanpa bayar (Rp 0)   │                          │ • Akun Private / Garansi     │
│ • Cooldown harian + Device ID│                          │ • Guest Checkout via QRIS    │
│ • Syarat Join Channel TG     │                          │ • Pengiriman Stok Otomatis   │
│ • Upselling ke Store         │                          │ • Opsi Login Google/Telegram │
└──────────────┬───────────────┘                          └──────────────┬───────────────┘
               │                                                         │
               └────────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │      Database PostgreSQL (Shared/Linked)      │
                    │   - products, variants, digital_keys          │
                    │   - orders (paid & free claims)               │
                    │   - customer_profiles (Google ID, TG Chat ID) │
                    └───────────────────────┬───────────────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
┌─────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
│     Payment Gateway (Port 7000)         │   │      Telegram Bot (@revdstore_bot)      │
│  - ShopeePay Dynamic QRIS               │   │  - Delivery Akun / Notifikasi Realtime  │
│  - Instant Settlement via Webhook       │   │  - Validasi Syarat Join Channel         │
└─────────────────────────────────────────┘   └─────────────────────────────────────────┘
```

---

## 2. Strategi Produk Promosi / Gratisan (Growth Loop)

Produk gratis berfungsi sebagai **Lead Magnet** untuk menarik pengunjung dan mengonversinya menjadi pembeli di Store berbayar.

### A. Mekanisme & Syarat Klaim (Social Gate)
1. **Force Subscribe Channel Telegram**:
   - Untuk mengklaim, pengunjung diarahkan untuk bergabung ke Channel Telegram resmi `@revdstore`.
   - Bot memverifikasi keanggotaan pengguna via API Telegram (`getChatMember`).
2. **Anti-Abuse Guard**:
   - Mempertahankan sistem advisory lock, cooldown harian, IP, dan Device Fingerprinting agar stok promosi terdistribusi merata dan tidak diborong bot.

### B. Konversi dari Promosi ke Pembelian (Upselling & Retention)
1. **Banner Rekomendasi di Hasil Klaim**:
   - Begitu klaim gratis sukses, modal menampilkan opsi:
     > *"Akun gratis ini akun bersama/shared. Mau akun privat 100% milik Anda sendiri & bergaransi? Beli langsung di Store kami mulai Rp 5.000 via QRIS ShopeePay."*
2. **Kupon Diskon Otomatis**:
   - Setiap pengguna yang menyelesaikan klaim gratis mendapatkan voucher diskon belanja (misal `CLAIMPROMO5` - potongan Rp 1.000 / 10%) yang dapat langsung digunakan di tab Store.

---

## 3. Struktur Data Terintegrasi (PostgreSQL)

```sql
-- Penanda pada tabel products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS price INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_badge VARCHAR(50); -- 'GRATIS / PROMO', 'BEST SELLER', dll.

-- Tabel Pengguna (Menghubungkan Web Guest, Google Auth, dan Telegram)
CREATE TABLE IF NOT EXISTS customer_profiles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email VARCHAR(255),
  google_id VARCHAR(128) UNIQUE,
  telegram_chat_id BIGINT UNIQUE,
  telegram_username VARCHAR(100),
  balance NUMERIC(12,2) DEFAULT 0,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Pesanan & Riwayat Transaksi (Store & Klaim)
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_code TEXT UNIQUE,
  order_type VARCHAR(20) DEFAULT 'paid',     -- 'paid' (store) atau 'free_claim' (promosi)
  user_token VARCHAR(128),                   -- Token browser tamu
  customer_id INT REFERENCES customer_profiles(id),
  product_id INT NOT NULL,
  total_amount NUMERIC(12,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',      -- 'unpaid', 'paid', 'free'
  payment_method TEXT,                       -- 'qris_shopeepay', 'free'
  qris_string TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 4. Alur Pembeli & Riwayat (Guest -> Google -> Telegram)

1. **Guest Mode**: Pengguna tidak dipaksa login untuk belanja atau klaim gratis. Semua aktivitas dicatat berdasarkan `user_token` browser lokal.
2. **Login Google Kapan Saja**: Jika pengguna klik "Login Google", seluruh riwayat (klaim gratis dan pembelian berbayar) yang memiliki `user_token` sama otomatis di-update ke akun Google tersebut.
3. **Integrasi Bot Telegram**:
   - Pembelian via Web dapat mengirimkan notifikasi ke Telegram pembeli via bot `@revdstore_bot`.
   - Admin menerima rekapan transaksi dan pantauan stok langsung di grup/chat Telegram admin.
