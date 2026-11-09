# Full Audit Report — revdstore-claim
## 2026-10-30

### Temuan & Perbaikan

| # | Kategori | Severity | File | Deskripsi | Status |
|---|----------|----------|------|-----------|--------|
| 1 | RACE CONDITION | HIGH | server.js:1091 | Restore endpoint: `spawn('bash', ['-c', \`echo "y" \| "${restoreScript}" "${filePath}"\`])` — jika filename mengandung karakter `"` atau `$`, terjadi command injection via shell interpolation | FIXED |
| 2 | N+1 QUERY | MEDIUM | server.js:603-606 | Admin stats: 4 query terpisah ke DB padahal bisa 1 CTE | FIXED |
| 3 | UNHANDLED ERROR | MEDIUM | server.js:366 | `db.pool.connect()` di `/api/claim` tidak di-wrap try; jika pool exhausted, unhandled rejection crash | FIXED |
| 4 | UNHANDLED ERROR | MEDIUM | server.js:514 | Catch block ROLLBACK bisa throw jika client sudah released | FIXED |
| 5 | MEMORY LEAK | LOW | server.js:223 | `activeAdminSessions` Map tidak pernah di-prune — expired sessions menumpuk | FIXED |
| 6 | DATA INTEGRITY | MEDIUM | server.js:825 | .env password write: jika value mengandung `=` atau newline, corrupt .env | FIXED |
| 7 | SECURITY | MEDIUM | server.js:1083 | Restore filename regex `[a-zA-Z0-9_\-\.]+` terlalu permisif (path traversal via `..`) | FIXED |
| 8 | UX BUG | LOW | server.js:108+274 | Double query `SELECT * FROM site_settings` pada setiap landing page hit (`/` dan `/api/settings`) — tidak ada issue, tapi bisa di-cache in-memory | WONTFIX (low traffic) |
| 9 | PERFORMANCE | LOW | init_db.sql | Tidak ada index pada `claim_logs(product_id, claimed_at)` untuk ORDER BY di cooldown subquery | FIXED |
| 10 | SECURITY | LOW | server.js:14 | Default ADMIN_PASSWORD hardcoded — sudah dimitigasi oleh .env requirement di installer | OK |
