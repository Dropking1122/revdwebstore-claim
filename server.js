const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const multer = require('multer');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5080;
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'revdstore_admin2026!';
const BRAND_NAME = process.env.BRAND_NAME || 'REVDSTORE';
const ADMIN_SECRET_PATH = process.env.ADMIN_SECRET_PATH || '/revd-manage-gate';
const PG_HUB_URL = process.env.PG_HUB_URL || 'http://127.0.0.1:7000';
const PG_API_KEY = process.env.PG_API_KEY || 'pg_live_revd_master';
const TELEGRAM_CHANNEL = process.env.TELEGRAM_CHANNEL || '@revdstore';
const PROMO_COUPON_CODE = process.env.PROMO_COUPON_CODE || 'CLAIMPROMO5';

// Multer Storage Configuration (Whitelisted Images Only - Raster to prevent SVG Stored XSS)
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.png';
    const safeName = 'img_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex') + safeExt;
    cb(null, safeName);
  }
});

const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Hanya berkas citra raster (JPG, PNG, WebP) yang diperbolehkan!'));
    }
    cb(null, true);
  }
});

const backupStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    cb(null, backupDir);
  },
  filename: (req, file, cb) => {
    let cleanName = path.basename(file.originalname).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!cleanName.endsWith('.sql') && !cleanName.endsWith('.sql.gz')) {
      cleanName += '.sql.gz';
    }
    cb(null, cleanName);
  }
});

const backupUpload = multer({
  storage: backupStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const orig = file.originalname.toLowerCase();
    if (!orig.endsWith('.sql') && !orig.endsWith('.sql.gz') && !orig.endsWith('.gz')) {
      return cb(new Error('Hanya berkas .sql atau .sql.gz yang diperbolehkan!'));
    }
    cb(null, true);
  }
});

app.set('trust proxy', 1);

// Security Headers (Native, no extra dependency)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  maxAge: 0,
  etag: false,
  setHeaders: (res, filePath) => {
    // Disable caching for HTML, JS, and CSS so client always sees immediate updates
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Dynamic SSR for Landing Page with live OpenGraph / Meta tags for WhatsApp, Telegram, Facebook, etc.
async function renderApp(req, res) {
  try {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let html = await fs.promises.readFile(indexPath, 'utf-8');

    // Fetch latest site settings
    const result = await db.query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });

    const host = req.headers['x-forwarded-host'] || req.headers.host || 'sawit.revd.dev';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${proto}://${host}`;

    const siteTitle = settings.site_title || `${settings.site_name || 'REVDSTORE'} — Claim Hub Produk Digital`;
    const description = settings.hero_desc || settings.dev_bio || 'Akses akun & lisensi premium digital secara gratis tanpa ribet registrasi.';

    let ogImage = settings.site_logo || '/uploads/og-banner.png';
    // If it's svg or empty, fall back to og-banner.png for WhatsApp compatibility
    if (!ogImage || ogImage.endsWith('.svg')) {
      ogImage = '/uploads/og-banner.png';
    }
    if (!ogImage.startsWith('http')) {
      ogImage = `${baseUrl}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`;
    }

    const escapeAttr = (s) => (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Dynamic meta tags block
    const metaBlock = `  <title>${escapeAttr(siteTitle)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  
  <!-- Open Graph / WhatsApp / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/">
  <meta property="og:title" content="${escapeAttr(siteTitle)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:image" content="${escapeAttr(ogImage)}">
  <meta property="og:image:secure_url" content="${escapeAttr(ogImage)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeAttr(siteTitle)}">
  <meta property="og:site_name" content="${escapeAttr(settings.site_name || 'REVDSTORE')}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${baseUrl}/">
  <meta name="twitter:title" content="${escapeAttr(siteTitle)}">
  <meta name="twitter:description" content="${escapeAttr(description)}">
  <meta name="twitter:image" content="${escapeAttr(ogImage)}">`;

    // Replace the head title & meta section in HTML (callback avoids $ pattern bug)
    html = html.replace(/<title>[\s\S]*?<!-- Twitter -->[\s\S]*?<meta name="twitter:image" content="[\s\S]*?">/, () => metaBlock.trim());

    // Inject dynamic terms modal content
    if (settings.terms_title) {
      html = html.replace(/<h3 class="modal-title" id="rules-modal-title">[\s\S]*?<\/h3>/, () => `<h3 class="modal-title" id="rules-modal-title">${escapeAttr(settings.terms_title)}</h3>`);
    }

    if (settings.terms_content) {
      const blocks = settings.terms_content.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
      if (blocks.length > 0) {
        const termsHtml = blocks.map(block => {
          const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
          const header = lines[0] || '';
          const body = lines.slice(1).join(' ');
          return `
          <div class="neo-box" style="padding: 14px; background: var(--surface-box);">
            <strong style="color: var(--text-main);">${escapeAttr(header)}</strong>
            ${body ? `<br><span style="color: var(--text-muted); display: inline-block; margin-top: 4px;">${escapeAttr(body)}</span>` : ''}
          </div>`;
        }).join('');
        
        html = html.replace(/<div id="rules-modal-list" style="[\s\S]*?<\/div>\s*<\/div>/, () => `<div id="rules-modal-list" style="display: flex; flex-direction: column; gap: 12px;">${termsHtml}\n        </div>`);
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.send(html);
  } catch (err) {
    console.error('Error rendering dynamic index.html:', err);
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
}

app.get(['/', '/index.html', '/katalog', '/riwayat', '/history', '/developer'], renderApp);

// Rate limiter for claim endpoint
const claimLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan klaim. Harap tunggu sebentar.' },
});

// Rate limiter for admin login (Anti-Bruteforce)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 attempts per 15 min per IP
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login gagal. Harap tunggu 15 menit.' },
});

// Helper: Extract real client IP securely (Verified Nginx Real-IP first)
function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp.trim();
  }
  if (req.ip) {
    return req.ip;
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// Admin Cryptographic Session Store (Tokens valid for 7 days)
const activeAdminSessions = new Map();

function createAdminSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  activeAdminSessions.set(token, expiresAt);
  return token;
}

function isValidAdminSession(token) {
  if (!token || typeof token !== 'string') return false;
  const expiresAt = activeAdminSessions.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    activeAdminSessions.delete(token);
    return false;
  }
  return true;
}

// Prune expired sessions every 30 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of activeAdminSessions) {
    if (now > exp) activeAdminSessions.delete(token);
  }
}, 30 * 60 * 1000);

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Admin Auth Middleware
function requireAdmin(req, res, next) {
  const token = req.cookies.admin_token || req.headers['x-admin-token'];
  if (!token || !isValidAdminSession(token)) {
    return res.status(401).json({ success: false, message: 'Akses admin tidak sah / belum login.' });
  }
  next();
}

// ----------------------------------------------------
// PUBLIC API ENDPOINTS
// ----------------------------------------------------

// 1. Get Brand Config & Settings
app.get('/api/config', (req, res) => {
  res.json({ 
    brand_name: BRAND_NAME,
    telegram_channel: TELEGRAM_CHANNEL,
    promo_coupon: PROMO_COUPON_CODE
  });
});

app.get('/api/settings', async (req, res) => {
  try {
    const result = await db.query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat pengaturan web.' });
  }
});

// 2. Get Public Products Catalog (with remaining quota & claimed status for this user)
app.get('/api/products', async (req, res) => {
  try {
    const userToken = req.query.token || req.cookies.user_claim_token || '';
    const deviceId = req.query.device || req.cookies.user_device_id || '';
    const clientIp = getClientIp(req);

    const query = `
      SELECT 
        p.id, p.name, p.slug, p.description, p.badge_text, p.item_type, p.icon, p.image_url, p.color_theme,
        COALESCE(p.is_paid, false) AS is_paid,
        COALESCE(p.price, 0)::INT AS price,
        p.promo_badge,
        COALESCE(p.cooldown_days, 0)::INT AS cooldown_days,
        COALESCE(SUM(GREATEST(0, i.max_claims - i.current_claims)), 0)::INT AS remaining_claims,
        COUNT(i.id) FILTER (WHERE i.is_active = true AND i.current_claims < i.max_claims)::INT AS available_slots,
        (SELECT COUNT(cl_total.id)::INT FROM claim_logs cl_total WHERE cl_total.product_id = p.id) AS total_claims,
        EXISTS (
          SELECT 1 FROM claim_logs cl 
          LEFT JOIN product_items pi ON cl.item_id = pi.id
          WHERE cl.product_id = p.id 
            AND (
              (cl.user_token = $1 AND $1 != '') 
              OR (cl.ip_address = $2 AND $2 != '')
              OR (cl.device_id = $3 AND $3 != '')
            )
            AND (
              p.cooldown_days IS NULL 
              OR p.cooldown_days = 0 
              OR (
                CASE 
                  WHEN (COALESCE(pi.created_at, cl.claimed_at) + (p.cooldown_days || ' days')::INTERVAL) > cl.claimed_at 
                  THEN (COALESCE(pi.created_at, cl.claimed_at) + (p.cooldown_days || ' days')::INTERVAL)
                  ELSE (cl.claimed_at + (p.cooldown_days || ' days')::INTERVAL)
                END
              ) > NOW()
            )
        ) AS already_claimed,
        (
          SELECT 
            ROUND(EXTRACT(EPOCH FROM (
              (CASE 
                WHEN (COALESCE(pi.created_at, cl.claimed_at) + (p.cooldown_days || ' days')::INTERVAL) > cl.claimed_at 
                THEN (COALESCE(pi.created_at, cl.claimed_at) + (p.cooldown_days || ' days')::INTERVAL)
                ELSE (cl.claimed_at + (p.cooldown_days || ' days')::INTERVAL)
              END) - NOW()
            )))::INT
          FROM claim_logs cl
          LEFT JOIN product_items pi ON cl.item_id = pi.id
          WHERE cl.product_id = p.id 
            AND (
              (cl.user_token = $1 AND $1 != '') 
              OR (cl.ip_address = $2 AND $2 != '')
              OR (cl.device_id = $3 AND $3 != '')
            )
            AND p.cooldown_days > 0
            AND (
              CASE 
                WHEN (COALESCE(pi.created_at, cl.claimed_at) + (p.cooldown_days || ' days')::INTERVAL) > cl.claimed_at 
                THEN (COALESCE(pi.created_at, cl.claimed_at) + (p.cooldown_days || ' days')::INTERVAL)
                ELSE (cl.claimed_at + (p.cooldown_days || ' days')::INTERVAL)
              END
            ) > NOW()
          ORDER BY cl.claimed_at DESC 
          LIMIT 1
        ) AS cooldown_remaining_seconds
      FROM products p
      LEFT JOIN product_items i ON p.id = i.product_id AND i.is_active = true
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY 
        (COALESCE(SUM(GREATEST(0, i.max_claims - i.current_claims)), 0) > 0) DESC,
        p.id ASC;
    `;

    const result = await db.query(query, [userToken, clientIp, deviceId]);
    res.json({ success: true, products: result.rows });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data produk.' });
  }
});

// 3. Claim a Product (ACID Transaction with anti-abuse IP + token + device fingerprint check)
app.post('/api/claim', claimLimiter, async (req, res) => {
  let client;
  try {
    client = await db.pool.connect();
  } catch (poolErr) {
    console.error('Pool connect failed:', poolErr);
    return res.status(503).json({ success: false, message: 'Server sedang sibuk, coba lagi.' });
  }
  try {
    const { product_id, user_token, device_id } = req.body || {};
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const cleanDeviceId = typeof device_id === 'string' && device_id.length >= 8 ? device_id.trim().slice(0, 64) : null;

    if (!product_id || !user_token || typeof user_token !== 'string' || user_token.length < 10) {
      return res.status(400).json({ success: false, message: 'Parameter klaim tidak lengkap atau tidak valid.' });
    }

    await client.query('BEGIN');

    // 1. Transaction Advisory Lock per kombinasi product_id + user_token & product_id + clientIp & device_id
    // Menjamin serialisasi klaim concurrent dari identitas/koneksi yang sama
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('claim_user_' || $1 || '_' || $2)),
              pg_advisory_xact_lock(hashtext('claim_ip_' || $1 || '_' || $3)),
              pg_advisory_xact_lock(hashtext('claim_dev_' || $1 || '_' || COALESCE($4, $2)))`,
      [product_id, user_token, clientIp, cleanDeviceId]
    );

    // Cek produk aktif
    const prodRes = await client.query('SELECT * FROM products WHERE id = $1 AND is_active = true', [product_id]);
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan atau sedang nonaktif.' });
    }
    const product = prodRes.rows[0];
    if (product.is_paid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Produk ini adalah produk berbayar. Silakan beli melalui tab Store.' });
    }

    // Anti-Abuse Check: Cek apakah user_token, IP, atau Device Fingerprint sudah pernah klaim produk ini dalam masa cooldown
    const logCheck = await client.query(
      `SELECT cl.id, cl.claimed_at, cl.item_id,
              COALESCE(pi.created_at, cl.claimed_at) AS item_created_at
       FROM claim_logs cl
       LEFT JOIN product_items pi ON cl.item_id = pi.id
       WHERE cl.product_id = $1 
         AND (
           cl.user_token = $2 
           OR cl.ip_address = $3 
           OR (cl.device_id IS NOT NULL AND $4::TEXT IS NOT NULL AND cl.device_id = $4::TEXT)
         )
       ORDER BY cl.claimed_at DESC 
       LIMIT 1`,
      [product_id, user_token, clientIp, cleanDeviceId]
    );

    if (logCheck.rows.length > 0) {
      const lastClaim = logCheck.rows[0];
      const cooldownDays = product.cooldown_days || 0;
      if (cooldownDays > 0) {
        const itemCreatedTime = new Date(lastClaim.item_created_at || lastClaim.claimed_at).getTime();
        const claimedTime = new Date(lastClaim.claimed_at).getTime();
        const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
        
        // Akun berlaku selama cooldownDays dari saat akun di-post (item_created_at)
        // Jika user klaim akun 2 hari setelah di-post, maka sisa masa tunggu adalah sisa hari akun tersebut
        let expireTime = itemCreatedTime + cooldownMs;
        if (expireTime <= claimedTime) {
          expireTime = claimedTime + cooldownMs;
        }

        const now = Date.now();
        if (now < expireTime) {
          const remainingMs = expireTime - now;
          const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
          const remainingHours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const remainingMinutes = Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
          
          let timeText = '';
          if (remainingDays > 0) {
            timeText = `${remainingDays} hari ${remainingHours} jam`;
          } else if (remainingHours > 0) {
            timeText = `${remainingHours} jam ${remainingMinutes} menit`;
          } else {
            timeText = `${remainingMinutes} menit`;
          }

          await client.query('ROLLBACK');
          return res.status(403).json({
            success: false,
            message: `Kamu sudah mengklaim akun dari batch ini! Akun ini masih aktif untuk sisa ${timeText}. Kamu dapat mengklaim batch berikutnya setelah masa aktif akun ini selesai. Silakan cek tab "Riwayat" untuk melihat akun Anda.`,
          });
        }
      } else {
        // Cooldown 0 = Hanya 1x klaim selamanya
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'Kamu sudah pernah mengklaim produk ini! Silakan cek menu "Riwayat Klaim" untuk melihat akun Anda.',
        });
      }
    }

    // 2. Ambil 1 akun/item yang kuotanya masih tersedia menggunakan kunci baris (FOR UPDATE SKIP LOCKED)
    const itemRes = await client.query(
      `SELECT id, content, notes, max_claims, current_claims 
       FROM product_items 
       WHERE product_id = $1 AND is_active = true AND current_claims < max_claims 
       ORDER BY id ASC 
       LIMIT 1 
       FOR UPDATE SKIP LOCKED`,
      [product_id]
    );

    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Maaf, stok atau kuota gratis untuk produk ini sedang habis. Admin akan segera restock!',
      });
    }

    const item = itemRes.rows[0];

    // Increment jumlah klaim pada item tersebut
    await client.query(
      `UPDATE product_items 
       SET current_claims = current_claims + 1 
       WHERE id = $1`,
      [item.id]
    );

    // Catat log klaim (sertakan device_id untuk melacak perangkat yang sama meski IP / browser berganti)
    const logInsert = await client.query(
      `INSERT INTO claim_logs 
       (product_id, item_id, user_token, ip_address, device_id, user_agent, claimed_content, claimed_notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, claimed_at`,
      [product_id, item.id, user_token, clientIp, cleanDeviceId, userAgent, item.content, item.notes]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Klaim berhasil! Silakan simpan akun/link berikut.',
      claim: {
        id: logInsert.rows[0].id,
        product_name: product.name,
        item_type: product.item_type,
        icon: product.icon,
        content: item.content,
        notes: item.notes,
        claimed_at: logInsert.rows[0].claimed_at,
        promo_coupon: PROMO_COUPON_CODE,
        telegram_channel: TELEGRAM_CHANNEL,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error claiming product:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat memproses klaim.' });
  } finally {
    client.release();
  }
});

// 4. Get User Claim History
app.get('/api/history', async (req, res) => {
  try {
    const userToken = req.query.token || req.cookies.user_claim_token || '';
    const deviceId = req.query.device || req.cookies.user_device_id || '';
    const clientIp = getClientIp(req);

    if (!userToken && !clientIp && !deviceId) {
      return res.json({ success: true, history: [] });
    }

    const query = `
      SELECT DISTINCT ON (cl.product_id)
        cl.id, cl.claimed_content, cl.claimed_notes, cl.claimed_at, cl.user_token,
        p.name AS product_name, p.slug, p.item_type, p.icon, p.badge_text, p.color_theme,
        COALESCE(p.cooldown_days, 0)::INT AS cooldown_days,
        (CASE 
          WHEN (COALESCE(pi.created_at, cl.claimed_at) + (COALESCE(p.cooldown_days, 0) || ' days')::INTERVAL) > cl.claimed_at 
          THEN (COALESCE(pi.created_at, cl.claimed_at) + (COALESCE(p.cooldown_days, 0) || ' days')::INTERVAL)
          ELSE (cl.claimed_at + (COALESCE(p.cooldown_days, 0) || ' days')::INTERVAL)
        END) AS expire_at
      FROM claim_logs cl
      JOIN products p ON cl.product_id = p.id
      LEFT JOIN product_items pi ON cl.item_id = pi.id
      WHERE (cl.user_token = $1 AND $1 != '') 
         OR (cl.ip_address = $2 AND $2 != '')
         OR (cl.device_id = $3 AND $3 != '')
      ORDER BY cl.product_id, cl.claimed_at DESC;
    `;

    const result = await db.query(query, [userToken, clientIp, deviceId]);
    res.json({ success: true, history: result.rows });
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil riwayat klaim.' });
  }
});

// 5. Create Paid Order (QRIS ShopeePay Gateway via Port 7000)
app.post('/api/orders/create', claimLimiter, async (req, res) => {
  try {
    const { product_id, user_token } = req.body || {};
    if (!product_id || !user_token) {
      return res.status(400).json({ success: false, message: 'Parameter tidak lengkap.' });
    }

    const prodRes = await db.query('SELECT * FROM products WHERE id = $1 AND is_active = true', [product_id]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan atau nonaktif.' });
    }
    const prod = prodRes.rows[0];
    if (!prod.is_paid) {
      return res.status(400).json({ success: false, message: 'Produk ini adalah produk gratis, gunakan tombol Claim.' });
    }

    // Cek ketersediaan stok
    const stockRes = await db.query(
      'SELECT COUNT(id)::INT AS stock FROM product_items WHERE product_id = $1 AND is_active = true AND current_claims < max_claims',
      [product_id]
    );
    if (!stockRes.rows[0] || stockRes.rows[0].stock <= 0) {
      return res.status(400).json({ success: false, message: 'Stok produk ini sedang habis.' });
    }

    const orderCode = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const amount = parseInt(prod.price, 10) || 5000;
    const expiresInMinutes = 15;

    let qrisString = '';
    let qrUrl = '';
    try {
      const pgRes = await fetch(`${PG_HUB_URL}/api/v1/payments/create-qris`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': PG_API_KEY,
        },
        body: JSON.stringify({
          order_id: orderCode,
          amount: amount,
          provider: 'shopeepay',
          customer_name: 'Guest Claim User',
          client_id: 'revdstore_web',
          expires_in_minutes: expiresInMinutes,
        }),
      });
      const pgData = await pgRes.json();
      if (!pgData.success) {
        throw new Error(pgData.error || 'Payment gateway returned error');
      }
      qrisString = pgData.data.qris_string;
      qrUrl = pgData.data.qr_url || '';
    } catch (pgErr) {
      console.error('Payment gateway request error:', pgErr.message);
      return res.status(502).json({ success: false, message: 'Gagal membuat QRIS pembayaran: ' + pgErr.message });
    }

    await db.query(
      `INSERT INTO orders (order_code, order_type, user_token, product_id, total_amount, payment_status, payment_method, qris_string, qr_url)
       VALUES ($1, 'paid', $2, $3, $4, 'unpaid', 'qris_shopeepay', $5, $6);`,
      [orderCode, user_token, product_id, amount, qrisString, qrUrl]
    );

    res.json({
      success: true,
      order: {
        order_code: orderCode,
        amount: amount,
        product_name: prod.name,
        qris_string: qrisString,
        qr_url: qrUrl,
        expires_in_minutes: expiresInMinutes,
      },
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ success: false, message: 'Gagal memproses pesanan.' });
  }
});

// 6. Check Order Payment Status & Stock Allocation (Idempotent)
app.get('/api/orders/:order_code/status', async (req, res) => {
  const { order_code } = req.params;
  try {
    const orderRes = await db.query(
      `SELECT o.*, p.name AS product_name, p.item_type 
       FROM orders o 
       JOIN products p ON o.product_id = p.id 
       WHERE o.order_code = $1`,
      [order_code]
    );
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }
    const order = orderRes.rows[0];

    // Jika sudah lunas di lokal, kembalikan langsung
    if (order.payment_status === 'paid') {
      return res.json({
        success: true,
        status: 'paid',
        order_code: order.order_code,
        product_name: order.product_name,
        content: order.claimed_content,
        notes: order.claimed_notes,
      });
    }

    // Jika unpaid, cek status ke Payment Gateway
    let isSettled = false;
    try {
      const pgRes = await fetch(`${PG_HUB_URL}/api/v1/payments/${encodeURIComponent(order_code)}/status`, {
        headers: { 'X-API-Key': PG_API_KEY },
      });
      const pgData = await pgRes.json();
      if (pgData.success && (pgData.data.paid || pgData.data.status === 'paid')) {
        isSettled = true;
      }
    } catch (pgErr) {
      console.warn('Check PG status error:', pgErr.message);
    }

    if (!isSettled) {
      return res.json({
        success: true,
        status: 'unpaid',
        order_code: order.order_code,
        amount: order.total_amount,
      });
    }

    // Settle pembayaran dan alokasikan stok item secara ACID
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const lockRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [order.id]);
      const currentOrder = lockRes.rows[0];
      if (currentOrder.payment_status === 'paid') {
        await client.query('COMMIT');
        return res.json({
          success: true,
          status: 'paid',
          order_code: currentOrder.order_code,
          product_name: order.product_name,
          content: currentOrder.claimed_content,
          notes: currentOrder.claimed_notes,
        });
      }

      const itemRes = await client.query(
        `SELECT id, content, notes 
         FROM product_items 
         WHERE product_id = $1 AND is_active = true AND current_claims < max_claims 
         ORDER BY id ASC 
         LIMIT 1 
         FOR UPDATE SKIP LOCKED`,
        [order.product_id]
      );

      if (itemRes.rows.length === 0) {
        await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', ['pending_stock', order.id]);
        await client.query('COMMIT');
        return res.json({
          success: false,
          status: 'out_of_stock',
          message: 'Pembayaran diterima, tetapi stok baru saja habis. Silakan hubungi admin.',
        });
      }

      const item = itemRes.rows[0];
      await client.query('UPDATE product_items SET current_claims = current_claims + 1 WHERE id = $1', [item.id]);
      await client.query(
        `UPDATE orders 
         SET payment_status = 'paid', paid_at = NOW(), claimed_item_id = $1, claimed_content = $2, claimed_notes = $3 
         WHERE id = $4`,
        [item.id, item.content, item.notes || '', order.id]
      );

      await client.query(
        `INSERT INTO claim_logs (product_id, item_id, user_token, ip_address, claimed_content, claimed_notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.product_id, item.id, order.user_token || 'guest', getClientIp(req), item.content, item.notes || '']
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        status: 'paid',
        order_code: order.order_code,
        product_name: order.product_name,
        content: item.content,
        notes: item.notes,
      });
    } catch (settleErr) {
      await client.query('ROLLBACK');
      throw settleErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error checking order status:', err);
    res.status(500).json({ success: false, message: 'Gagal mengecek status pembayaran.' });
  }
});

// 7. Payment Webhook Receiver
app.post('/api/webhook/payment', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !safeCompare(apiKey, PG_API_KEY)) {
    return res.status(401).json({ success: false, message: 'Invalid API Key' });
  }
  const { order_id, status } = req.body || {};
  if (!order_id || status !== 'paid') {
    return res.json({ success: true, message: 'Ignored' });
  }

  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query('SELECT * FROM orders WHERE order_code = $1 FOR UPDATE', [order_id]);
      if (orderRes.rows.length === 0 || orderRes.rows[0].payment_status === 'paid') {
        await client.query('COMMIT');
        return res.json({ success: true, message: 'Already processed or not found' });
      }
      const order = orderRes.rows[0];
      const itemRes = await client.query(
        `SELECT id, content, notes FROM product_items 
         WHERE product_id = $1 AND is_active = true AND current_claims < max_claims 
         ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [order.product_id]
      );
      if (itemRes.rows.length > 0) {
        const item = itemRes.rows[0];
        await client.query('UPDATE product_items SET current_claims = current_claims + 1 WHERE id = $1', [item.id]);
        await client.query(
          `UPDATE orders SET payment_status = 'paid', paid_at = NOW(), claimed_item_id = $1, claimed_content = $2, claimed_notes = $3 WHERE id = $4`,
          [item.id, item.content, item.notes || '', order.id]
        );
      } else {
        await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', ['pending_stock', order.id]);
      }
      await client.query('COMMIT');
      return res.json({ success: true, message: 'Settled successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// ADMIN API ENDPOINTS
// ----------------------------------------------------

// Admin Login (Protected by anti-bruteforce rate limiter & timing-safe compare)
app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (!password || !safeCompare(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ success: false, message: 'Token admin tidak valid!' });
  }

  const sessionToken = createAdminSession();
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

  // Set HTTP-only cookie with secure flag on HTTPS
  res.cookie('admin_token', sessionToken, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
    secure: isSecure,
  });

  res.json({ success: true, message: 'Login berhasil.', token: sessionToken });
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  const token = req.cookies.admin_token || req.headers['x-admin-token'];
  if (token) {
    activeAdminSessions.delete(token);
  }
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logout berhasil.' });
});

// Admin Check Me
app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ success: true, authenticated: true });
});

// Admin Stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      WITH p AS (SELECT COUNT(*)::INT AS total FROM products),
           i AS (SELECT COUNT(*)::INT AS total, COALESCE(SUM(max_claims),0)::INT AS total_capacity, COALESCE(SUM(current_claims),0)::INT AS total_claimed FROM product_items WHERE is_active = true),
           cl AS (SELECT COUNT(*)::INT AS total, COUNT(DISTINCT user_token)::INT AS unique_users, COUNT(DISTINCT ip_address)::INT AS unique_ips FROM claim_logs),
           ct AS (SELECT COUNT(*)::INT AS total FROM claim_logs WHERE claimed_at >= CURRENT_DATE)
      SELECT p.total AS total_products, i.total_capacity, i.total_claimed,
             GREATEST(0, i.total_capacity - i.total_claimed)::INT AS remaining_slots,
             cl.total AS total_logs, cl.unique_users, cl.unique_ips, ct.total AS claims_today
      FROM p, i, cl, ct
    `);
    res.json({ success: true, stats: result.rows[0] });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil statistik.' });
  }
});

// Admin Products List
app.get('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        p.*,
        COUNT(i.id)::INT AS total_items,
        COALESCE(SUM(i.max_claims), 0)::INT AS total_capacity,
        COALESCE(SUM(i.current_claims), 0)::INT AS total_claimed,
        COALESCE(SUM(GREATEST(0, i.max_claims - i.current_claims)), 0)::INT AS remaining_claims
      FROM products p
      LEFT JOIN product_items i ON p.id = i.product_id AND i.is_active = true
      GROUP BY p.id
      ORDER BY p.id DESC;
    `;
    const result = await db.query(query);
    res.json({ success: true, products: result.rows });
  } catch (err) {
    console.error('Error admin products:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data produk admin.' });
  }
});

// Admin Create Product
app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const { name, slug, description, badge_text, item_type, icon, image_url, color_theme, cooldown_days, is_paid, price, promo_badge } = req.body || {};
    if (!name || !slug) {
      return res.status(400).json({ success: false, message: 'Nama dan Slug produk wajib diisi.' });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const cleanCooldown = Math.max(0, parseInt(cooldown_days, 10) || 0);
    const isPaid = is_paid === true || is_paid === 'true' || is_paid === 1 || is_paid === '1';
    const cleanPrice = Math.max(0, parseInt(price, 10) || 0);

    const query = `
      INSERT INTO products (name, slug, description, badge_text, item_type, icon, image_url, color_theme, cooldown_days, is_paid, price, promo_badge)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
    const result = await db.query(query, [
      name,
      cleanSlug,
      description || '',
      badge_text || (isPaid ? 'STORE' : 'GRATIS'),
      item_type || 'account',
      icon || (isPaid ? '🛒' : '🎁'),
      image_url || '',
      color_theme || 'yellow',
      cleanCooldown,
      isPaid,
      cleanPrice,
      promo_badge || null,
    ]);
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error('Error creating product:', err);
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Slug produk sudah digunakan. Silakan gunakan slug lain.' });
    }
    res.status(500).json({ success: false, message: 'Gagal menambah produk.' });
  }
});

// Admin Update Product
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: 'ID produk tidak valid.' });
    }
    const { name, slug, description, badge_text, item_type, icon, image_url, color_theme, is_active, cooldown_days, is_paid, price, promo_badge } = req.body || {};

    // Pastikan is_active bernilai boolean dan default ke true jika tidak dikirim (mencegah produk jadi NULL & hilang)
    const activeVal = is_active !== undefined 
      ? (is_active === true || is_active === 'true' || is_active === 1 || is_active === '1') 
      : true;

    const cleanCooldown = cooldown_days !== undefined ? Math.max(0, parseInt(cooldown_days, 10) || 0) : null;
    const isPaid = is_paid !== undefined ? (is_paid === true || is_paid === 'true' || is_paid === 1 || is_paid === '1') : false;
    const cleanPrice = price !== undefined ? Math.max(0, parseInt(price, 10) || 0) : 0;

    const query = `
      UPDATE products 
      SET name = $1, slug = $2, description = $3, badge_text = $4, item_type = $5, icon = $6, image_url = $7, color_theme = $8, 
          is_active = $9, cooldown_days = COALESCE($10, cooldown_days, 0), is_paid = $11, price = $12, promo_badge = $13, updated_at = NOW()
      WHERE id = $14
      RETURNING *;
    `;
    const result = await db.query(query, [name, slug, description, badge_text, item_type, icon, image_url, color_theme, activeVal, cleanCooldown, isPaid, cleanPrice, promo_badge || null, productId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui produk.' });
  }
});

// Admin Upload Image (with error handling for invalid MIME / extension)
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  uploadMiddleware.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Gagal memproses unggahan berkas.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada berkas citra yang diunggah.' });
    }
    res.json({ success: true, url: `/uploads/${req.file.filename}` });
  });
});

// Admin Get Site Settings
app.get('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Error getting settings:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat pengaturan.' });
  }
});

// Admin Update Site Settings (Batch Insert in Transaction)
app.post('/api/admin/settings', requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const {
      site_name, site_tag, site_title, hero_title, hero_desc,
      site_logo, site_favicon, dev_name, dev_role, dev_bio,
      dev_telegram, dev_channel, dev_instagram, dev_email,
      terms_title, terms_content
    } = req.body || {};

    const entries = [
      ['site_name', site_name || 'REVDSTORE'],
      ['site_tag', site_tag || 'CLAIM HUB'],
      ['site_title', site_title || 'REVDSTORE — Claim Hub Produk Digital'],
      ['hero_title', hero_title || 'REVDSTORE FREE'],
      ['hero_desc', hero_desc || 'Akses akun & lisensi premium digital secara gratis tanpa ribet registrasi.'],
      ['site_logo', site_logo || ''],
      ['site_favicon', site_favicon || ''],
      ['dev_name', dev_name || 'REVDSTORE'],
      ['dev_role', dev_role || 'Official Digital Claim Hub'],
      ['dev_bio', dev_bio || 'Platform klaim instan akun & lisensi premium gratis REVDSTORE.'],
      ['dev_telegram', dev_telegram || '@ValltzID'],
      ['dev_channel', dev_channel || ''],
      ['dev_instagram', dev_instagram || '@revdstore.app'],
      ['dev_email', dev_email || 'dev@revd.me'],
      ['terms_title', terms_title || 'Ketentuan Penggunaan & Klaim Akun'],
      ['terms_content', terms_content || ''],
    ];

    await client.query('BEGIN');
    for (const [key, value] of entries) {
      await client.query(
        'INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
        [key, value]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Pengaturan web & info developer berhasil disimpan.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error saving settings:', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan pengaturan.' });
  } finally {
    client.release();
  }
});

// Admin Change Password / Token
app.post('/api/admin/change-password', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const current_password = (body.current_password || '').toString().trim();
    const new_password = (body.new_password || '').toString().trim();
    const confirm_password = (body.confirm_password || '').toString().trim();

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ success: false, message: 'Semua kolom wajib diisi!' });
    }
    if (!safeCompare(current_password, ADMIN_PASSWORD)) {
      return res.status(400).json({ success: false, message: 'Token admin saat ini salah!' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Token baru minimal harus 6 karakter!' });
    }
    if (/[\n\r]/.test(new_password)) {
      return res.status(400).json({ success: false, message: 'Token tidak boleh mengandung karakter baris baru!' });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Konfirmasi token baru tidak cocok!' });
    }

    // 1. Update in-memory variable
    ADMIN_PASSWORD = new_password;
    process.env.ADMIN_PASSWORD = new_password;

    // 2. Safely update .env file with chmod 600
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (/^ADMIN_PASSWORD=.*$/m.test(envContent)) {
        envContent = envContent.replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${new_password}`);
      } else {
        envContent += `\nADMIN_PASSWORD=${new_password}`;
      }
      fs.writeFileSync(envPath, envContent, { mode: 0o600 });
    }

    // 3. Log event into admin_logs
    const clientIp = getClientIp(req);
    await db.query(
      'INSERT INTO admin_logs (action, details, ip_address) VALUES ($1, $2, $3)',
      ['CHANGE_PASSWORD', 'Token admin diperbarui melalui panel admin', clientIp]
    ).catch(() => {});

    // 4. Invalidate all active admin sessions so everyone must re-login with the new token
    activeAdminSessions.clear();
    res.clearCookie('admin_token');

    res.json({
      success: true,
      message: 'Token/Password admin berhasil diubah! Sesi telah direset, silakan login kembali dengan token baru.'
    });
  } catch (err) {
    console.error('Error changing admin password:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui token admin di server.' });
  }
});

// Admin Delete Product
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: 'ID produk tidak valid.' });
    }
    await db.query('DELETE FROM products WHERE id = $1', [productId]);
    res.json({ success: true, message: 'Produk berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus produk.' });
  }
});

// Admin Get Items of Product
app.get('/api/admin/products/:id/items', requireAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: 'ID produk tidak valid.' });
    }
    const items = await db.query(
      `SELECT * FROM product_items WHERE product_id = $1 ORDER BY id DESC`,
      [productId]
    );
    res.json({ success: true, items: items.rows });
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data item.' });
  }
});

// Admin Bulk Add Items with custom max_claims per item (Batch Insert, Anti N+1)
app.post('/api/admin/products/:id/items', requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: 'ID produk tidak valid.' });
    }

    const { items, items_text, max_claims, notes } = req.body || {};

    let lines = [];
    if (Array.isArray(items)) {
      lines = items.map((l) => String(l).trim()).filter((l) => l.length > 0);
    } else if (typeof items_text === 'string') {
      lines = items_text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    } else if (typeof items === 'string') {
      lines = items.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    }

    if (lines.length === 0) {
      return res.status(400).json({ success: false, message: 'Data akun/link tidak boleh kosong.' });
    }

    const claimLimit = parseInt(max_claims, 10) > 0 ? parseInt(max_claims, 10) : 1;
    const cleanNotes = typeof notes === 'string' ? notes.trim() : '';

    await client.query('BEGIN');

    // Batch insert multi-row dalam 1 kueri atomik (mengatasi N+1 loop)
    const values = [];
    const params = [productId, cleanNotes, claimLimit];

    lines.forEach((line) => {
      params.push(line);
      values.push(`($1, $${params.length}, $2, $3, 0)`);
    });

    await client.query(
      `INSERT INTO product_items (product_id, content, notes, max_claims, current_claims)
       VALUES ${values.join(', ')}`,
      params
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Berhasil menambahkan ${lines.length} item stok dengan batas ${claimLimit} klaim/item.`,
      count: lines.length,
      inserted_count: lines.length,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error adding items:', err);
    res.status(500).json({ success: false, message: 'Gagal menambahkan item stok.' });
  } finally {
    client.release();
  }
});

// Admin Delete Single Item
app.delete('/api/admin/items/:id', requireAdmin, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, message: 'ID item tidak valid.' });
    }
    await db.query('DELETE FROM product_items WHERE id = $1', [itemId]);
    res.json({ success: true, message: 'Item berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus item.' });
  }
});

// Admin Claim Logs
app.get('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        cl.id, cl.product_id, cl.item_id, cl.user_token, cl.ip_address, cl.claimed_content, cl.claimed_notes, cl.claimed_at,
        p.name AS product_name
      FROM claim_logs cl
      JOIN products p ON cl.product_id = p.id
      ORDER BY cl.claimed_at DESC
      LIMIT 100;
    `;
    const result = await db.query(query);
    res.json({ success: true, logs: result.rows });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil log klaim.' });
  }
});

// Admin Orders List
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*, p.name AS product_name 
      FROM orders o 
      LEFT JOIN products p ON o.product_id = p.id 
      ORDER BY o.id DESC 
      LIMIT 100;
    `);
    res.json({ success: true, orders: result.rows });
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil riwayat pesanan.' });
  }
});

// ----------------------------------------------------
// ADMIN DATABASE BACKUP ENDPOINTS
// ----------------------------------------------------

// List all backups
app.get('/api/admin/backups', requireAdmin, async (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('revdstore_claim_backup_') && (f.endsWith('.sql') || f.endsWith('.sql.gz')))
      .map(filename => {
        const filePath = path.join(backupDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: stats.size,
          size_formatted: (stats.size / 1024).toFixed(1) + ' KB',
          created_at: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, backups: files });
  } catch (err) {
    console.error('Error listing backups:', err);
    res.status(500).json({ success: false, message: 'Gagal membaca daftar backup.' });
  }
});

// Create fresh backup
app.post('/api/admin/backups/create', requireAdmin, async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, 'scripts', 'backup.sh');
    execFile(scriptPath, [], (error, stdout, stderr) => {
      if (error) {
        console.error('Backup creation failed:', error, stderr);
        return res.status(500).json({ success: false, message: 'Gagal membuat backup database: ' + (stderr || error.message) });
      }
      res.json({ success: true, message: 'Backup database berhasil dibuat!' });
    });
  } catch (err) {
    console.error('Error triggering backup:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat membuat backup.' });
  }
});

// Download backup file
app.get('/api/admin/backups/download/:filename', requireAdmin, (req, res) => {
  try {
    const { filename } = req.params;
    if (!/^revdstore_claim_backup_[\w\-\.]+\.sql(\.gz)?$/.test(filename)) {
      return res.status(400).json({ success: false, message: 'Nama file backup tidak valid.' });
    }
    const filePath = path.join(__dirname, 'backups', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File backup tidak ditemukan.' });
    }
    res.download(filePath, filename);
  } catch (err) {
    console.error('Error downloading backup:', err);
    res.status(500).json({ success: false, message: 'Gagal mengunduh file backup.' });
  }
});

// Delete backup file
app.delete('/api/admin/backups/:filename', requireAdmin, (req, res) => {
  try {
    const { filename } = req.params;
    if (!/^revdstore_claim_backup_[\w\-\.]+\.sql(\.gz)?$/.test(filename)) {
      return res.status(400).json({ success: false, message: 'Nama file backup tidak valid.' });
    }
    const filePath = path.join(__dirname, 'backups', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true, message: 'File backup berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting backup:', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus file backup.' });
  }
});

// Upload backup file
app.post('/api/admin/backups/upload', requireAdmin, backupUpload.single('backup_file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Tidak ada berkas backup yang diunggah!' });
  }
  res.json({
    success: true,
    message: 'Berkas backup berhasil diunggah ke server!',
    filename: req.file.filename
  });
});

// Restore backup from existing file
app.post('/api/admin/backups/restore/:filename', requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    if (!/^[a-zA-Z0-9_\-]+\.sql(\.gz)?$/.test(filename)) {
      return res.status(400).json({ success: false, message: 'Nama file backup tidak valid.' });
    }
    const filePath = path.join(__dirname, 'backups', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File backup tidak ditemukan.' });
    }
    const restoreScript = path.join(__dirname, 'scripts', 'restore.sh');
    const child = spawn('bash', [restoreScript, filePath], { env: { ...process.env, RESTORE_AUTO_CONFIRM: 'y' } });
    let output = '';
    let errorOutput = '';
    child.stdout.on('data', data => { output += data.toString(); });
    child.stderr.on('data', data => { errorOutput += data.toString(); });
    child.on('close', code => {
      if (code !== 0) {
        console.error('Restore failed:', errorOutput);
        return res.status(500).json({ success: false, message: 'Gagal memulihkan database: ' + errorOutput });
      }
      res.json({ success: true, message: 'Database berhasil dipulihkan dari ' + filename });
    });
  } catch (err) {
    console.error('Error restoring backup:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat restore database.' });
  }
});

// Frontend Routing
app.get('/admin', (req, res) => {
  res.status(404).send('404 Not Found');
});

app.get(ADMIN_SECRET_PATH, (req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'admin.html'));
});

app.use((req, res) => {
  renderApp(req, res);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 REVDSTORE Claim Server running on 127.0.0.1:${PORT}`);
});
