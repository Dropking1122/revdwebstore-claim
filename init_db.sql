-- Schema for REVDSTORE Digital Claim Hub
-- Updated for Multi-Layer Security & Cooldown Management

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    badge_text VARCHAR(50) DEFAULT 'GRATIS',
    item_type VARCHAR(20) DEFAULT 'account',
    icon VARCHAR(100) DEFAULT '🎁',
    color_theme VARCHAR(50) DEFAULT 'yellow',
    image_url TEXT,
    cooldown_days INT DEFAULT 0,
    is_paid BOOLEAN DEFAULT false,
    price INT DEFAULT 0,
    promo_badge VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Varian Produk
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price INT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS product_items (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INT REFERENCES product_variants(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    notes TEXT,
    max_claims INT DEFAULT 1,
    current_claims INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_current_claims_limit CHECK (current_claims <= max_claims)
);

CREATE INDEX IF NOT EXISTS idx_product_items_variant_id ON product_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_product_items_available ON product_items(product_id, is_active, current_claims, max_claims);

CREATE TABLE IF NOT EXISTS claim_logs (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    item_id INT REFERENCES product_items(id) ON DELETE SET NULL,
    user_token VARCHAR(128) NOT NULL,
    ip_address VARCHAR(64) NOT NULL,
    device_id VARCHAR(64),
    user_agent TEXT,
    claimed_content TEXT NOT NULL,
    claimed_notes TEXT,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_logs_user_token ON claim_logs(user_token);
CREATE INDEX IF NOT EXISTS idx_claim_logs_ip ON claim_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_claim_logs_device_id ON claim_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_claim_logs_product_user ON claim_logs(product_id, user_token);
CREATE INDEX IF NOT EXISTS idx_claim_logs_product_ip ON claim_logs(product_id, ip_address);
CREATE INDEX IF NOT EXISTS idx_claim_logs_product_claimed_at ON claim_logs(product_id, claimed_at DESC);

CREATE TABLE IF NOT EXISTS customer_profiles (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    user_token VARCHAR(128) UNIQUE,
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

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_code TEXT UNIQUE,
    order_type VARCHAR(20) DEFAULT 'paid',
    user_token VARCHAR(128),
    customer_id INT REFERENCES customer_profiles(id),
    product_id INT NOT NULL REFERENCES products(id),
    total_amount NUMERIC(12,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    payment_method TEXT,
    qris_string TEXT,
    qr_url TEXT,
    claimed_item_id INT REFERENCES product_items(id) ON DELETE SET NULL,
    claimed_content TEXT,
    claimed_notes TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_user_token ON orders(user_token);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(payment_status);

CREATE TABLE IF NOT EXISTS site_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    details TEXT,
    ip_address VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- Default Settings Seed
INSERT INTO site_settings (key, value) VALUES
    ('site_title', 'REVDSTORE CLAIM HUB'),
    ('hero_title', 'REVDSTORE FREE'),
    ('hero_desc', 'Akses akun & aplikasi digital premium secara gratis, cepat, dan mudah.'),
    ('contact_tg', '@revdstore'),
    ('contact_ch', '@revdstore_ch'),
    ('meta_title', 'REVDSTORE - Digital Account & Premium Access Claim Hub'),
    ('meta_desc', 'Klaim akun premium gratis dan akses aplikasi digital eksklusif hanya di REVDSTORE.'),
    ('og_image', '/uploads/og-banner.png'),
    ('terms_title', 'KETENTUAN AKSES & KLAIM AKUN'),
    ('terms_content', '1 Akun Per Pengguna: Setiap pengguna (berdasarkan IP, Perangkat, dan Token) berhak mengklaim akun sesuai kuota ketersediaan.
Dilarang Mengubah Data: Akun yang dibagikan bersifat gratis untuk digunakan bersama atau personal sesuai jenisnya. Dilarang keras mengubah password, email, atau profil akun yang dibagikan.
Sistem Cooldown: Setelah mengklaim akun, Anda harus menunggu periode cooldown sebelum dapat mengklaim kembali jenis akun yang sama.
Penyalahgunaan Akses: Penggunaan skrip bot, bypass kuota, atau tindakan perusakan sistem akan mengakibatkan pemblokiran IP dan identitas perangkat secara permanen.
Garansi Ketersediaan: Akun dibagikan secara gratis apa adanya (as-is). Stok diperbarui secara berkala oleh pengelola.')
ON CONFLICT (key) DO NOTHING;
