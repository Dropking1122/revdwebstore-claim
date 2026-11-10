# 📘 BLUEPRINT EKSEKUSI INTEGRASI API: WEBSTORE ↔ TELEGRAM STORE BOT

Dokumen ini adalah **panduan teknis implementasi** untuk menyinkronkan produk akun digital dan inventori stok dari **Telegram Store Bot** (`telebot-order`) ke **Webstore Claim** (`sawit.revd.dev`) melalui REST API Bridge.

---

## 1. Ringkasan Arsitektur & Lingkungan

| Parameter | Layanan A: Telegram Store Bot | Layanan B: Webstore & Claim |
| :--- | :--- | :--- |
| **Direktori** | `/root/telegram-store-bot` | `/root/revdwebstore-claim` |
| **Proses PM2** | `telebot-order` (ID 8) | `revdwebstore-claim` (ID 11) |
| **Port Internal** | `5050` | `5090` |
| **Domain Publik** | Dashboard Internal / Bot TG | `https://sawit.revd.dev` |
| **Database** | PostgreSQL: `revd_order_5ukn1l4z` | PostgreSQL: `revdwebstore_claim` |
| **Peran** | **Master Data Produk & Stok Akun** | **Frontend Toko, Klaim Gratis & Auth** |

---

## 2. Alur Transaksi & Sinkronisasi Data

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│ Web Store (sawit.revd.dev:5090) │                 │ Telegram Bot Order (Port 5050)  │
└────────────────┬────────────────┘                 └────────────────┬────────────────┘
                 │                                                   │
                 │ 1. GET /api/v1/external/products                  │
                 │    Header: x-bridge-key: <BRIDGE_SECRET>          │
                 │ ─────────────────────────────────────────────────>│
                 │                                                   │
                 │    <-- Return: Daftar produk akun, varian,        │
                 │                harga jual & kuota stok aktif      │
                 │                                                   │
                 │ (Pengguna order & scan QRIS di sawit.revd.dev)   │
                 │                                                   │
                 │ 2. POST /api/v1/external/orders/fulfill           │
                 │    Header: x-bridge-key: <BRIDGE_SECRET>          │
                 │    Payload: { productId, variantId, orderCode,    │
                 │               customerName, customerPhone }       │
                 │ ─────────────────────────────────────────────────>│
                 │                                                   │
                 │    (Alokasi 1 digital_product_keys via FOR UPDATE │
                 │     SKIP LOCKED, kurangi stok, notif TG admin)    │
                 │                                                   │
                 │    <-- Return: { success: true, accountData }     │
                 │                                                   │
                 │ 3. Simpan data akun ke tabel orders lokal         │
                 │    dan tampilkan langsung di layar / tab riwayat  │
                 │                                                   │
```

---

## 3. Langkah Eksekusi Bagian 1: Telegram Store Bot (Port 5050)

### File Target: `/root/telegram-store-bot/apps/server/src/routes/external-api.ts` (BARU)
Buat route baru khusus konsumsi API eksternal tanpa terhalang middleware session cookie:

```typescript
import { Router, type Request, type Response } from "express";
import { db, productsTable, productVariantsTable, digitalProductKeysTable, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { sendTelegramOrderChannelNotification } from "../lib/telegram-bot";

const router = Router();

// Middleware validasi x-bridge-key
function requireBridgeKey(req: Request, res: Response, next: Function) {
  const secret = process.env.BRIDGE_API_KEY || "revd_bridge_internal_secret_2026";
  const provided = req.headers["x-bridge-key"] || req.headers["x-api-key"];
  if (!provided || provided !== secret) {
    return res.status(401).json({ success: false, error: "Akses tidak diizinkan (Invalid Bridge Key)" });
  }
  next();
}

router.use(requireBridgeKey);

/**
 * Endpoint 1: Ambil daftar produk aktif beserta varian dan sisa stok
 * GET /api/v1/external/products
 */
router.get("/products", async (_req: Request, res: Response) => {
  try {
    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        price: productsTable.price,
        imageUrl: productsTable.imageUrl,
        stock: productsTable.stock,
        isActive: productsTable.isActive,
      })
      .from(productsTable)
      .where(eq(productsTable.isActive, true));

    // Ambil varian aktif
    const variants = await db
      .select({
        id: productVariantsTable.id,
        productId: productVariantsTable.productId,
        name: productVariantsTable.name,
        price: productVariantsTable.price,
        stock: productVariantsTable.stock,
        isActive: productVariantsTable.isActive,
      })
      .from(productVariantsTable)
      .where(eq(productVariantsTable.isActive, true));

    // Gabungkan varian ke masing-masing produk
    const result = products.map((p) => ({
      ...p,
      variants: variants.filter((v) => v.productId === p.id),
    }));

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Endpoint 2: Fulfill & Pengambilan Akun Digital
 * POST /api/v1/external/orders/fulfill
 */
router.post("/orders/fulfill", async (req: Request, res: Response) => {
  const { productId, variantId, orderCode, customerName, customerPhone } = req.body;

  if (!productId) {
    return res.status(400).json({ success: false, error: "productId wajib diisi" });
  }

  try {
    let deliveredAccount = "";

    await db.transaction(async (tx) => {
      // Query ambil kunci akun yang belum dipakai
      const keyQuery = variantId
        ? sql`SELECT id, account_data FROM digital_product_keys
              WHERE product_id = ${productId}
                AND (variant_id = ${variantId} OR variant_id IS NULL)
                AND is_used = false
              ORDER BY (variant_id = ${variantId}) DESC, id ASC
              LIMIT 1 FOR UPDATE SKIP LOCKED`
        : sql`SELECT id, account_data FROM digital_product_keys
              WHERE product_id = ${productId} AND is_used = false
              ORDER BY id ASC
              LIMIT 1 FOR UPDATE SKIP LOCKED`;

      const result = await tx.execute<{ id: number; account_data: string }>(keyQuery);
      const key = result.rows[0];

      if (!key) {
        throw new Error("Stok akun habis");
      }

      // Tandai akun telah terpakai
      await tx
        .update(digitalProductKeysTable)
        .set({ isUsed: true, deliveredAt: new Date() })
        .where(eq(digitalProductKeysTable.id, key.id));

      // Kurangi stok di tabel varian dan produk
      if (variantId) {
        await tx.execute(sql`
          UPDATE product_variants SET stock = GREATEST(stock - 1, 0) WHERE id = ${variantId}
        `);
      }
      await tx.execute(sql`
        UPDATE products SET stock = GREATEST(stock - 1, 0) WHERE id = ${productId}
      `);

      deliveredAccount = key.account_data;
    });

    res.json({
      success: true,
      data: {
        accountData: deliveredAccount,
        orderCode,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
```

### Pendaftaran Router di Express
Edit berkas `/root/telegram-store-bot/apps/server/src/app.ts`:
Tambahkan rute external sebelum `requireAuth`:
```typescript
import externalApiRouter from "./routes/external-api";
// Daftarkan di /api/v1/external
app.use("/api/v1/external", externalApiRouter);
```

### Tambahkan Variabel Environment
Di file `/root/telegram-store-bot/.env`:
```ini
BRIDGE_API_KEY=revd_bridge_internal_secret_2026
```

### Build & Reload Bot Telegram
```bash
cd /root/telegram-store-bot/apps/server
node build.mjs
pm2 reload telebot-order
```

---

## 4. Langkah Eksekusi Bagian 2: Webstore Claim (Port 5090)

### File Target: `/root/revdwebstore-claim/server.js`

1. **Konfigurasi Environment & Helper DB Setting**:
   Tambahkan nilai default pada tabel `site_settings` di database `revdwebstore_claim`:
   ```sql
   INSERT INTO site_settings (key, value) VALUES
     ('bot_api_url', 'http://127.0.0.1:5050'),
     ('bot_api_key', 'revd_bridge_internal_secret_2026')
   ON CONFLICT (key) DO NOTHING;
   ```

2. **Gabungkan Katalog di Endpoint `GET /api/products`**:
   - Ambil produk lokal (klaim promosi/gratis).
   - Fetch produk dari `GET http://127.0.0.1:5050/api/v1/external/products` dengan header `x-bridge-key`.
   - Normalisasi objek produk agar memiliki field seragam (`id`, `name`, `price`, `stock`, `variants`, `is_paid = true`).
   - Kembalikan gabungan keduanya ke antarmuka web.

3. **Eksekusi Pengambilan Akun saat QRIS Lunas (`GET /api/orders/:order_id/status`)**:
   Saat status transaksi diubah menjadi `paid`:
   - Jika pesanan adalah produk eksternal (bot), kirim `POST http://127.0.0.1:5050/api/v1/external/orders/fulfill` dengan payload order.
   - Simpan `accountData` yang diterima ke kolom `claimed_content` di tabel `orders` lokal.
   - Set status order menjadi `paid` dan tandai selesai.

4. **Kirim Notifikasi ke Telegram Admin**:
   Gunakan helper pengiriman pesan ke Telegram Admin (`TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHANNEL` / Chat ID Admin `@ValltzID`) berisi detail pembelian, nama produk, nominal pembayaran, dan nomor WhatsApp pembeli.

---

## 5. Langkah Eksekusi Bagian 3: Antarmuka & Riwayat (Frontend)

1. **Gabungkan Pesanan Berbayar ke Tab Riwayat (`public/js/app.js`)**:
   - Di endpoint `/api/history`, lakukan `UNION` atau query ganda antara `claim_logs` (klaim promosi) dan `orders` (pembelian berbayar berstatus `paid`).
   - Di tampilan tab Riwayat, tampilkan badge pembeda yang jelas:
     - `[PROMO GRATIS]` untuk klaim free.
     - `[STORE RESMI]` untuk akun berbayar (bisa diklik untuk menyalin username/password/lisensi).

2. **Input Kode Kupon di Modal Checkout**:
   - Tambahkan input `#order-coupon-input` di form pembayaran modal QRIS.
   - Endpoint `/api/orders/create` memotong nominal bayar sesuai persentase kupon promo (misal diskon 10% dari kode `CLAIMPROMO5`).

---

## 6. Checklist Pengujian & Verifikasi (Verification Gates)

| No | Tes | Perintah / Prosedur | Kriteria Lolos |
| :--- | :--- | :--- | :--- |
| 1 | Tes Bridge API Port 5050 | `curl -s -H "x-bridge-key: revd_bridge_internal_secret_2026" http://127.0.0.1:5050/api/v1/external/products` | JSON `success: true` berisi daftar Canva, Capcut, dll. |
| 2 | Tes Katalog Webstore | `curl -s https://sawit.revd.dev/api/products` | Menampilkan produk gratis + produk berbayar dari bot |
| 3 | Tes Flow Order & QRIS | Buat order via UI katalog berbayar di `sawit.revd.dev` | Modal QRIS muncul dengan nominal yang sesuai |
| 4 | Tes Riwayat Akun | Buka tab Riwayat di browser `https://sawit.revd.dev/` | Menampilkan riwayat klaim gratis dan transaksi berbayar |

---

## 7. Rollback & Troubleshooting

- **Jika Build `telegram-store-bot` Error**:
  Periksa log build di `/root/telegram-store-bot/apps/server/build.mjs`. Pastikan module Drizzle di-import dari `@workspace/db`.
- **Jika Webstore Gagal Terhubung ke Port 5050**:
  Pastikan proses `telebot-order` berstatus `online` di `pm2 list` dan port 5050 merespons `curl http://127.0.0.1:5050/api/healthz`.
- **Fallback Aman**:
  Jika API Bot Telegram offline atau tidak dapat dijangkau, endpoint `/api/products` di webstore harus tetap menyajikan produk klaim gratis lokal tanpa membuat halaman web blank/crash (menggunakan blok `try/catch` dengan fallback data lokal).
