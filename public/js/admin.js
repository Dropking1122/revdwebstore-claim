// REVDSTORE Enterprise Admin Dashboard Script
// Zero Hardcode • Variants • Realtime Stock • Sales & Revenue Analytics

(function () {
  let adminToken = '';
  let cachedProducts = [];

  // Theme SVG icons
  const SUN_SVG = `<svg class="ui-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="23" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  const MOON_SVG = `<svg class="ui-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

  // Elements
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('admin-login-form');
  const logoutBtn = document.getElementById('logout-btn');

  // Tabs
  const tabStats = document.getElementById('admin-tab-stats');
  const tabProducts = document.getElementById('admin-tab-products');
  const tabOrders = document.getElementById('admin-tab-orders');
  const tabLogs = document.getElementById('admin-tab-logs');
  const tabSettings = document.getElementById('admin-tab-settings');

  const sectionStats = document.getElementById('admin-section-stats');
  const sectionProducts = document.getElementById('admin-section-products');
  const sectionOrders = document.getElementById('admin-section-orders');
  const sectionLogs = document.getElementById('admin-section-logs');
  const sectionSettings = document.getElementById('admin-section-settings');

  // Top Stats
  const statRevenue = document.getElementById('stat-revenue');
  const statPaidOrders = document.getElementById('stat-paid-orders');
  const statUnpaidOrders = document.getElementById('stat-unpaid-orders');
  const statToday = document.getElementById('stat-today');
  const statClaimed = document.getElementById('stat-claimed');
  const statSlots = document.getElementById('stat-slots');

  // Modals
  const productModalOverlay = document.getElementById('product-modal-overlay');
  const productModalClose = document.getElementById('product-modal-close');
  const productModalCancel = document.getElementById('product-modal-cancel');
  const productForm = document.getElementById('product-form');
  const btnAddProduct = document.getElementById('btn-add-product');

  const variantModalOverlay = document.getElementById('variant-modal-overlay');
  const variantModalClose = document.getElementById('variant-modal-close');
  const variantAddForm = document.getElementById('variant-add-form');

  const stockModalOverlay = document.getElementById('stock-modal-overlay');
  const stockModalClose = document.getElementById('stock-modal-close');
  const stockModalCancel = document.getElementById('stock-modal-cancel');
  const stockForm = document.getElementById('stock-form');

  const itemsListModalOverlay = document.getElementById('items-list-modal-overlay');
  const itemsListModalClose = document.getElementById('items-list-modal-close');
  const itemsListBody = document.getElementById('items-list-body');

  // Preloader Dismiss
  function dismissPreloader() {
    const preloader = document.getElementById('app-preloader');
    if (preloader) {
      preloader.classList.add('fade-out');
      setTimeout(() => {
        if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
      }, 350);
    }
  }

  // Toast System
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Auth fetch wrapper
  async function adminFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${adminToken}`;
    const res = await fetch(url, options);
    if (res.status === 401) {
      sessionStorage.removeItem('revd_admin_token');
      adminToken = '';
      loginView.style.display = 'block';
      dashboardView.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
      showToast('Sesi autentikasi telah berakhir. Silakan login kembali.', 'error');
      throw new Error('Unauthorized');
    }
    return res;
  }

  // Tab Switching
  window.switchTab = function (tabName) {
    const tabs = [
      { id: 'stats', btn: tabStats, sec: sectionStats },
      { id: 'products', btn: tabProducts, sec: sectionProducts },
      { id: 'orders', btn: tabOrders, sec: sectionOrders },
      { id: 'logs', btn: tabLogs, sec: sectionLogs },
      { id: 'settings', btn: tabSettings, sec: sectionSettings }
    ];

    tabs.forEach(t => {
      if (!t.btn || !t.sec) return;
      if (t.id === tabName) {
        t.btn.className = 'neo-btn neo-btn-yellow btn-sm';
        t.sec.style.display = 'block';
      } else {
        t.btn.className = 'neo-btn neo-btn-white btn-sm';
        t.sec.style.display = 'none';
      }
    });

    if (tabName === 'stats') loadStats();
    if (tabName === 'products') loadProducts();
    if (tabName === 'orders') loadOrders();
    if (tabName === 'logs') loadLogs();
    if (tabName === 'settings') loadSettings();
  };

  if (tabStats) tabStats.addEventListener('click', () => switchTab('stats'));
  if (tabProducts) tabProducts.addEventListener('click', () => switchTab('products'));
  if (tabOrders) tabOrders.addEventListener('click', () => switchTab('orders'));
  if (tabLogs) tabLogs.addEventListener('click', () => switchTab('logs'));
  if (tabSettings) tabSettings.addEventListener('click', () => switchTab('settings'));

  // 1. Load Stats
  window.loadStats = async function () {
    try {
      const res = await adminFetch('/api/admin/stats');
      const data = await res.json();
      if (!data.success) return;

      const s = data.stats || {};
      if (statRevenue) statRevenue.textContent = `Rp ${(s.total_revenue || 0).toLocaleString('id-ID')}`;
      if (statPaidOrders) statPaidOrders.textContent = (s.total_paid_orders || 0).toLocaleString('id-ID');
      if (statUnpaidOrders) statUnpaidOrders.textContent = (s.total_unpaid_orders || 0).toLocaleString('id-ID');
      if (statToday) statToday.textContent = (s.today_claims || 0).toLocaleString('id-ID');
      if (statClaimed) statClaimed.textContent = (s.total_claims || 0).toLocaleString('id-ID');
      if (statSlots) statSlots.textContent = (s.available_items || 0).toLocaleString('id-ID');

      // Recent Orders List
      const ordersWrap = document.getElementById('stats-recent-orders-list');
      if (ordersWrap) {
        if (!s.recent_orders || s.recent_orders.length === 0) {
          ordersWrap.innerHTML = '<div style="font-size: 0.82rem; color: var(--text-muted);">Belum ada riwayat transaksi berbayar.</div>';
        } else {
          ordersWrap.innerHTML = s.recent_orders.map(o => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: var(--surface-box); border: var(--border-thick); border-radius: 6px; font-size: 0.82rem;">
              <div>
                <strong>${escapeHtml(o.order_code)}</strong> — ${escapeHtml(o.product_name)}
                ${o.variant_name ? `<span style="font-size: 0.72rem; color: var(--text-muted);">(${escapeHtml(o.variant_name)})</span>` : ''}
              </div>
              <div style="text-align: right;">
                <span class="neo-badge ${o.payment_status === 'paid' ? 'badge-mint' : 'badge-yellow'}" style="font-size: 0.7rem;">
                  ${o.payment_status === 'paid' ? 'LUNAS' : 'MENUNGGU'}
                </span>
                <span style="font-weight: 800; margin-left: 6px;">Rp ${(o.total_amount || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>
          `).join('');
        }
      }

      // Recent Claims List
      const claimsWrap = document.getElementById('stats-recent-claims-list');
      if (claimsWrap) {
        if (!s.recent_claims || s.recent_claims.length === 0) {
          claimsWrap.innerHTML = '<div style="font-size: 0.82rem; color: var(--text-muted);">Belum ada log klaim gratis.</div>';
        } else {
          claimsWrap.innerHTML = s.recent_claims.map(c => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: var(--surface-box); border: var(--border-thick); border-radius: 6px; font-size: 0.82rem;">
              <div>
                <strong>${escapeHtml(c.product_name)}</strong>
                <span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 4px;">IP: ${escapeHtml(c.ip_address)}</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                ${new Date(c.claimed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          `).join('');
        }
      }

    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  // 2. Load Products
  window.loadProducts = async function () {
    try {
      const res = await adminFetch('/api/products');
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'Gagal memuat produk.', 'error');
        return;
      }
      cachedProducts = data.products || [];
      renderProductsList(cachedProducts);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  function renderProductsList(products) {
    const container = document.getElementById('products-cards-container');
    if (!container) return;

    if (!products || products.length === 0) {
      container.innerHTML = '<div class="neo-box" style="padding: 20px; text-align: center; color: var(--text-muted);">Belum ada produk. Klik tombol "+ Tambah Produk Baru" di atas.</div>';
      return;
    }

    container.innerHTML = products.map(p => {
      const isPaid = !!p.is_paid;
      const typeBadge = isPaid ? 'STORE BERBAYAR' : 'KLAIM GRATIS';
      const badgeClass = isPaid ? 'badge-yellow' : 'badge-mint';
      const variantCount = p.variants ? p.variants.length : 0;
      const priceText = isPaid ? `Rp ${(p.price || 0).toLocaleString('id-ID')}` : 'Gratis';

      return `
        <div class="admin-prod-card">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 52px; height: 52px; min-width: 52px; border: var(--border-thick); border-radius: 6px; background: var(--surface-box); overflow: hidden; display: flex; align-items: center; justify-content: center;">
              <img src="${escapeHtml(p.image_url || '/uploads/logo.svg')}" alt="" style="width: 100%; height: 100%; object-fit: contain; padding: 4px;" onerror="this.src='/uploads/logo.svg'">
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                <span class="neo-badge ${badgeClass}" style="font-size: 0.7rem;">${typeBadge}</span>
                <span class="neo-badge ${p.is_active ? 'badge-green' : 'badge-pink'}" style="font-size: 0.7rem;">
                  ${p.is_active ? 'AKTIF' : 'NONAKTIF'}
                </span>
                ${p.promo_badge ? `<span class="neo-badge badge-yellow" style="font-size: 0.7rem;">${escapeHtml(p.promo_badge)}</span>` : ''}
              </div>
              <h4 style="font-size: 1.05rem; font-weight: 900; margin: 0 0 4px 0; text-transform: uppercase;">
                ${escapeHtml(p.name)}
              </h4>
              <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 12px; flex-wrap: wrap;">
                <span>Harga: <strong>${priceText}</strong></span>
                <span>Stok: <strong>${p.remaining_claims || 0} Akun</strong></span>
                <span>Varian: <strong>${variantCount} Paket</strong></span>
                <span>Cooldown: <strong>${p.cooldown_days ? p.cooldown_days + ' Hari' : '1x Saja'}</strong></span>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button onclick="window.openVariantModal(${p.id}, '${escapeHtml(p.name)}')" class="neo-btn neo-btn-yellow btn-sm" style="font-weight: 800;">
              Varian (${variantCount})
            </button>
            <button onclick="window.openStockModal(${p.id}, '${escapeHtml(p.name)}')" class="neo-btn neo-btn-cyan btn-sm" style="font-weight: 800;">
              + Stok
            </button>
            <button onclick="window.openItemsModal(${p.id}, '${escapeHtml(p.name)}')" class="neo-btn neo-btn-white btn-sm">
              Lihat Stok
            </button>
            <button onclick="window.editProduct(${p.id})" class="neo-btn neo-btn-white btn-sm">
              Edit
            </button>
            <button onclick="window.deleteProduct(${p.id}, '${escapeHtml(p.name)}')" class="neo-btn neo-btn-pink btn-sm">
              Hapus
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 3. Variant Management
  window.openVariantModal = async function (prodId, prodName) {
    const modal = document.getElementById('variant-modal-overlay');
    const title = document.getElementById('variant-modal-title');
    const hiddenId = document.getElementById('variant-product-id');
    const container = document.getElementById('variant-list-container');

    if (!modal) return;
    title.textContent = `Varian: ${prodName}`;
    hiddenId.value = prodId;
    container.innerHTML = '<div style="font-size: 0.82rem; color: var(--text-muted);">Memuat varian...</div>';
    modal.classList.add('active');

    try {
      const res = await adminFetch(`/api/admin/products/${prodId}/variants`);
      const data = await res.json();
      if (!data.success) {
        container.innerHTML = '<div style="color: red; font-size: 0.82rem;">Gagal memuat varian.</div>';
        return;
      }
      renderVariantsList(prodId, data.variants || []);
    } catch (err) {
      container.innerHTML = '<div style="color: red; font-size: 0.82rem;">Error memuat varian.</div>';
    }
  };

  function renderVariantsList(prodId, variants) {
    const container = document.getElementById('variant-list-container');
    if (!variants || variants.length === 0) {
      container.innerHTML = '<div style="font-size: 0.82rem; color: var(--text-muted);">Belum ada varian khusus untuk produk ini. Tambahkan di bawah.</div>';
      return;
    }

    container.innerHTML = variants.map(v => `
      <div class="variant-row">
        <div>
          <strong style="text-transform: uppercase;">${escapeHtml(v.name)}</strong>
          <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 6px;">(Stok: ${v.stock || 0})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 900;">Rp ${(v.price || 0).toLocaleString('id-ID')}</span>
          <button onclick="window.deleteVariant(${prodId}, ${v.id})" class="neo-btn neo-btn-pink btn-sm" style="padding: 2px 8px; font-size: 0.72rem;">
            ✕
          </button>
        </div>
      </div>
    `).join('');
  }

  window.deleteVariant = async function (prodId, variantId) {
    if (!confirm('Hapus varian ini? Stok yang terikat pada varian ini akan menjadi stok umum.')) return;
    try {
      const res = await adminFetch(`/api/admin/variants/${variantId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Varian berhasil dihapus.', 'success');
        window.openVariantModal(prodId, 'Produk');
        window.loadProducts();
      } else {
        showToast(data.message || 'Gagal menghapus varian.', 'error');
      }
    } catch (err) {
      showToast('Error koneksi.', 'error');
    }
  };

  if (variantAddForm) {
    variantAddForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prodId = document.getElementById('variant-product-id').value;
      const nameInput = document.getElementById('variant-new-name');
      const priceInput = document.getElementById('variant-new-price');

      try {
        const res = await adminFetch(`/api/admin/products/${prodId}/variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nameInput.value.trim(),
            price: parseInt(priceInput.value, 10) || 0,
            sort_order: 0,
            is_active: true
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Varian berhasil ditambahkan.', 'success');
          nameInput.value = '';
          priceInput.value = '';
          window.openVariantModal(prodId, 'Produk');
          window.loadProducts();
        } else {
          showToast(data.message || 'Gagal menambahkan varian.', 'error');
        }
      } catch (err) {
        showToast('Error koneksi saat menambahkan varian.', 'error');
      }
    });
  }

  if (variantModalClose) {
    variantModalClose.addEventListener('click', () => {
      variantModalOverlay.classList.remove('active');
    });
  }

  // 4. Stock Bulk Add
  window.openStockModal = async function (prodId, prodName) {
    const modal = document.getElementById('stock-modal-overlay');
    const title = document.getElementById('stock-modal-title');
    const hiddenId = document.getElementById('stock-product-id');
    const variantSelect = document.getElementById('stock-variant-id');
    const textArea = document.getElementById('stock-text');

    if (!modal) return;
    title.textContent = `Tambah Stok: ${prodName}`;
    hiddenId.value = prodId;
    if (textArea) textArea.value = '';

    // Load variants for this product into dropdown
    if (variantSelect) {
      variantSelect.innerHTML = '<option value="">Stok Umum (Semua Varian)</option>';
      try {
        const res = await adminFetch(`/api/admin/products/${prodId}/variants`);
        const data = await res.json();
        if (data.success && data.variants) {
          data.variants.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `Khusus Varian: ${v.name} (Rp ${(v.price || 0).toLocaleString('id-ID')})`;
            variantSelect.appendChild(opt);
          });
        }
      } catch (err) {
        // ignore
      }
    }

    modal.classList.add('active');
  };

  if (stockForm) {
    stockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prodId = document.getElementById('stock-product-id').value;
      const variantId = document.getElementById('stock-variant-id').value;
      const maxClaims = document.getElementById('stock-max-claims').value;
      const content = document.getElementById('stock-text').value;
      const notes = document.getElementById('stock-notes').value;

      try {
        const res = await adminFetch(`/api/admin/products/${prodId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            notes,
            max_claims: maxClaims,
            variant_id: variantId || null
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Stok berhasil ditambahkan.', 'success');
          stockModalOverlay.classList.remove('active');
          window.loadProducts();
          window.loadStats();
        } else {
          showToast(data.message || 'Gagal menambahkan stok.', 'error');
        }
      } catch (err) {
        showToast('Error koneksi saat mengunggah stok.', 'error');
      }
    });
  }

  if (stockModalClose) stockModalClose.addEventListener('click', () => stockModalOverlay.classList.remove('active'));
  if (stockModalCancel) stockModalCancel.addEventListener('click', () => stockModalOverlay.classList.remove('active'));

  // 5. Stock Items List
  window.openItemsModal = async function (prodId, prodName) {
    const modal = document.getElementById('items-list-modal-overlay');
    const title = document.getElementById('items-list-modal-title');
    const body = document.getElementById('items-list-body');

    if (!modal) return;
    title.textContent = `Daftar Stok: ${prodName}`;
    body.innerHTML = '<div style="font-size: 0.82rem; color: var(--text-muted);">Memuat item stok...</div>';
    modal.classList.add('active');

    try {
      const res = await adminFetch(`/api/admin/products/${prodId}/items`);
      const data = await res.json();
      if (!data.success) {
        body.innerHTML = '<div style="color: red; font-size: 0.82rem;">Gagal memuat item stok.</div>';
        return;
      }
      renderItemsList(prodId, data.items || []);
    } catch (err) {
      body.innerHTML = '<div style="color: red; font-size: 0.82rem;">Error memuat item stok.</div>';
    }
  };

  function renderItemsList(prodId, items) {
    const body = document.getElementById('items-list-body');
    if (!items || items.length === 0) {
      body.innerHTML = '<div style="font-size: 0.82rem; color: var(--text-muted); text-align: center; padding: 20px;">Belum ada item stok untuk produk ini.</div>';
      return;
    }

    body.innerHTML = items.map(item => {
      const isExhausted = item.current_claims >= item.max_claims;
      return `
        <div style="background: var(--surface-box); border: var(--border-thick); border-radius: 6px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="flex-grow: 1;">
            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
              <span class="neo-badge ${isExhausted ? 'badge-pink' : 'badge-green'}" style="font-size: 0.68rem;">
                ${isExhausted ? 'HABIS' : 'TERSEDIA'} (${item.current_claims}/${item.max_claims})
              </span>
              ${item.variant_name ? `<span class="neo-badge badge-yellow" style="font-size: 0.68rem;">${escapeHtml(item.variant_name)}</span>` : '<span class="neo-badge" style="font-size: 0.68rem; background: var(--surface);">UMUM</span>'}
            </div>
            <div style="font-family: monospace; font-size: 0.85rem; font-weight: 700; word-break: break-all;">
              ${escapeHtml(item.content)}
            </div>
            ${item.notes ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Catatan: ${escapeHtml(item.notes)}</div>` : ''}
          </div>
          <button onclick="window.deleteItem(${prodId}, ${item.id})" class="neo-btn neo-btn-pink btn-sm" style="font-size: 0.72rem;">
            Hapus
          </button>
        </div>
      `;
    }).join('');
  }

  window.deleteItem = async function (prodId, itemId) {
    if (!confirm('Hapus item stok ini?')) return;
    try {
      const res = await adminFetch(`/api/admin/items/${itemId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Item stok berhasil dihapus.', 'success');
        window.openItemsModal(prodId, 'Produk');
        window.loadProducts();
        window.loadStats();
      } else {
        showToast(data.message || 'Gagal menghapus item.', 'error');
      }
    } catch (err) {
      showToast('Error koneksi saat menghapus item.', 'error');
    }
  };

  if (itemsListModalClose) itemsListModalClose.addEventListener('click', () => itemsListModalOverlay.classList.remove('active'));

  // 6. Orders List
  window.loadOrders = async function () {
    const container = document.getElementById('orders-list-container');
    if (!container) return;
    container.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted);">Memuat riwayat transaksi...</div>';

    try {
      const res = await adminFetch('/api/admin/orders');
      const data = await res.json();
      if (!data.success) {
        container.innerHTML = '<div style="color: red; font-size: 0.85rem;">Gagal memuat transaksi.</div>';
        return;
      }
      renderOrdersList(data.orders || []);
    } catch (err) {
      container.innerHTML = '<div style="color: red; font-size: 0.85rem;">Error memuat transaksi.</div>';
    }
  };

  function renderOrdersList(orders) {
    const container = document.getElementById('orders-list-container');
    if (!orders || orders.length === 0) {
      container.innerHTML = '<div class="neo-box" style="padding: 20px; text-align: center; color: var(--text-muted);">Belum ada riwayat pesanan store.</div>';
      return;
    }

    container.innerHTML = orders.map(o => {
      const isPaid = o.payment_status === 'paid';
      return `
        <div class="admin-order-row">
          <div>
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
              <strong style="font-size: 0.95rem; font-family: monospace;">${escapeHtml(o.order_code)}</strong>
              <span class="neo-badge ${isPaid ? 'badge-mint' : 'badge-yellow'}" style="font-size: 0.7rem;">
                ${isPaid ? 'PAID / LUNAS' : 'MENUNGGU PEMBAYARAN'}
              </span>
            </div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">
              Produk: <strong>${escapeHtml(o.product_name)}</strong>
              ${o.variant_name ? ` • Varian: <strong>${escapeHtml(o.variant_name)}</strong>` : ''}
              • Waktu: ${new Date(o.created_at).toLocaleString('id-ID')}
            </div>
            ${o.claimed_content ? `
              <div style="margin-top: 6px; padding: 6px 10px; background: var(--surface-box); border: var(--border-thick); border-radius: 4px; font-family: monospace; font-size: 0.78rem;">
                Akun Terkirim: <strong>${escapeHtml(o.claimed_content)}</strong>
              </div>
            ` : ''}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.15rem; font-weight: 900; color: var(--text-main);">
              Rp ${(o.total_amount || 0).toLocaleString('id-ID')}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              Metode: QRIS ShopeePay
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 7. Claim Logs
  window.loadLogs = async function () {
    const container = document.getElementById('logs-cards-container');
    if (!container) return;
    container.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted);">Memuat log klaim...</div>';

    try {
      const res = await adminFetch('/api/admin/logs');
      const data = await res.json();
      if (!data.success) {
        container.innerHTML = '<div style="color: red; font-size: 0.85rem;">Gagal memuat log klaim.</div>';
        return;
      }
      renderLogsList(data.logs || []);
    } catch (err) {
      container.innerHTML = '<div style="color: red; font-size: 0.85rem;">Error memuat log.</div>';
    }
  };

  function renderLogsList(logs) {
    const container = document.getElementById('logs-cards-container');
    if (!logs || logs.length === 0) {
      container.innerHTML = '<div class="neo-box" style="padding: 20px; text-align: center; color: var(--text-muted);">Belum ada catatan klaim gratis.</div>';
      return;
    }

    container.innerHTML = logs.map(l => `
      <div style="background: var(--surface); border: var(--border-thick); border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <strong>${escapeHtml(l.product_name)}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            IP: ${escapeHtml(l.ip_address)} • Token: ${escapeHtml(l.user_token || '-')}
          </div>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          ${new Date(l.claimed_at).toLocaleString('id-ID')}
        </div>
      </div>
    `).join('');
  }

  // 8. Site Settings (Zero Hardcode)
  window.loadSettings = async function () {
    try {
      const res = await adminFetch('/api/admin/settings');
      const data = await res.json();
      if (!data.success) return;

      const s = data.settings || {};
      const fields = [
        'brand_name', 'site_title', 'hero_title', 'hero_desc',
        'pg_hub_url', 'pg_api_key', 'telegram_channel', 'dev_telegram',
        'telegram_bot_token', 'promo_coupon_code', 'promo_discount_percent',
        'google_client_id'
      ];

      fields.forEach(f => {
        const input = document.querySelector(`[name="${f}"]`);
        if (input && s[f] !== undefined) {
          input.value = s[f];
        }
      });
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  const settingsForm = document.getElementById('site-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(settingsForm);
      const payload = {};
      formData.forEach((value, key) => {
        payload[key] = value.trim();
      });

      try {
        const res = await adminFetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          showToast('Semua pengaturan sistem berhasil disimpan di database.', 'success');
        } else {
          showToast(data.message || 'Gagal menyimpan pengaturan.', 'error');
        }
      } catch (err) {
        showToast('Error koneksi saat menyimpan pengaturan.', 'error');
      }
    });
  }

  // 9. Change Password / Admin Token Form
  const changePasswordForm = document.getElementById('admin-change-password-form');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentToken = document.getElementById('change-current-token').value;
      const newToken = document.getElementById('change-new-token').value;
      const confirmToken = document.getElementById('change-confirm-token').value;

      if (newToken !== confirmToken) {
        showToast('Konfirmasi token baru tidak cocok.', 'error');
        return;
      }

      try {
        const res = await adminFetch('/api/admin/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_password: currentToken, new_password: newToken })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Token pengelola berhasil diperbarui. Silakan login kembali.', 'success');
          sessionStorage.removeItem('revd_admin_token');
          setTimeout(() => location.reload(), 1500);
        } else {
          showToast(data.message || 'Gagal mengubah token.', 'error');
        }
      } catch (err) {
        showToast('Error koneksi saat mengubah token.', 'error');
      }
    });
  }

  // 10. Product Modal (Add / Edit)
  if (btnAddProduct) {
    btnAddProduct.addEventListener('click', () => {
      productForm.reset();
      document.getElementById('prod-id').value = '';
      document.getElementById('product-modal-title').textContent = 'Tambah Produk Baru';
      const paidFields = document.getElementById('prod-paid-fields');
      if (paidFields) paidFields.style.display = 'none';
      productModalOverlay.classList.add('active');
    });
  }

  const prodIsPaidCheckbox = document.getElementById('prod-is-paid');
  if (prodIsPaidCheckbox) {
    prodIsPaidCheckbox.addEventListener('change', (e) => {
      const paidFields = document.getElementById('prod-paid-fields');
      if (paidFields) paidFields.style.display = e.target.checked ? 'grid' : 'none';
    });
  }

  window.editProduct = function (id) {
    const prod = cachedProducts.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('prod-id').value = prod.id;
    document.getElementById('prod-name').value = prod.name;
    document.getElementById('prod-slug').value = prod.slug;
    document.getElementById('prod-type').value = prod.item_type || 'account';
    document.getElementById('prod-desc').value = prod.description || '';
    document.getElementById('prod-badge').value = prod.badge_text || 'GRATIS';
    document.getElementById('prod-theme').value = prod.color_theme || 'yellow';
    document.getElementById('prod-status').value = prod.is_active ? 'true' : 'false';
    document.getElementById('prod-cooldown-select').value = String(prod.cooldown_days || 0);
    document.getElementById('prod-image').value = prod.image_url || '';

    const isPaid = !!prod.is_paid;
    if (prodIsPaidCheckbox) prodIsPaidCheckbox.checked = isPaid;
    const paidFields = document.getElementById('prod-paid-fields');
    if (paidFields) paidFields.style.display = isPaid ? 'grid' : 'none';

    document.getElementById('prod-price').value = prod.price || 0;
    document.getElementById('prod-promo-badge').value = prod.promo_badge || '';

    document.getElementById('product-modal-title').textContent = 'Edit Produk';
    productModalOverlay.classList.add('active');
  };

  window.deleteProduct = async function (id, name) {
    if (!confirm(`Hapus produk "${name}" dan seluruh stok/varian di dalamnya?`)) return;
    try {
      const res = await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Produk berhasil dihapus.', 'success');
        window.loadProducts();
        window.loadStats();
      } else {
        showToast(data.message || 'Gagal menghapus produk.', 'error');
      }
    } catch (err) {
      showToast('Error koneksi saat menghapus produk.', 'error');
    }
  };

  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('prod-id').value;
      const payload = {
        name: document.getElementById('prod-name').value.trim(),
        slug: document.getElementById('prod-slug').value.trim(),
        item_type: document.getElementById('prod-type').value,
        description: document.getElementById('prod-desc').value.trim(),
        badge_text: document.getElementById('prod-badge').value.trim(),
        color_theme: document.getElementById('prod-theme').value,
        is_active: document.getElementById('prod-status').value === 'true',
        cooldown_days: parseInt(document.getElementById('prod-cooldown-select').value, 10) || 0,
        image_url: document.getElementById('prod-image').value.trim() || '/uploads/logo.svg',
        is_paid: prodIsPaidCheckbox ? prodIsPaidCheckbox.checked : false,
        price: parseInt(document.getElementById('prod-price').value, 10) || 0,
        promo_badge: document.getElementById('prod-promo-badge').value.trim() || null
      };

      try {
        const url = id ? `/api/admin/products/${id}` : '/api/admin/products';
        const method = id ? 'PUT' : 'POST';
        const res = await adminFetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          showToast('Produk berhasil disimpan.', 'success');
          productModalOverlay.classList.remove('active');
          window.loadProducts();
          window.loadStats();
        } else {
          showToast(data.message || 'Gagal menyimpan produk.', 'error');
        }
      } catch (err) {
        showToast('Error koneksi saat menyimpan produk.', 'error');
      }
    });
  }

  if (productModalClose) productModalClose.addEventListener('click', () => productModalOverlay.classList.remove('active'));
  if (productModalCancel) productModalCancel.addEventListener('click', () => productModalOverlay.classList.remove('active'));

  // 11. Login & Auth initialization
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwdInput = document.getElementById('admin-password');
      const pwd = pwdInput.value.trim();
      if (!pwd) return;

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (data.success) {
          adminToken = data.token;
          sessionStorage.setItem('revd_admin_token', adminToken);
          loginView.style.display = 'none';
          dashboardView.style.display = 'block';
          if (logoutBtn) logoutBtn.style.display = 'inline-block';
          showToast('Autentikasi berhasil. Selamat datang di panel kontrol.', 'success');
          switchTab('stats');
        } else {
          showToast(data.message || 'Token otorisasi salah.', 'error');
        }
      } catch (err) {
        showToast('Gagal menghubungkan ke server.', 'error');
      }
    });
  }

  const togglePwdBtn = document.getElementById('toggle-admin-password');
  if (togglePwdBtn) {
    togglePwdBtn.addEventListener('click', () => {
      const pwdInput = document.getElementById('admin-password');
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        togglePwdBtn.textContent = 'HIDE';
      } else {
        pwdInput.type = 'password';
        togglePwdBtn.textContent = 'SHOW';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('revd_admin_token');
      adminToken = '';
      loginView.style.display = 'block';
      dashboardView.style.display = 'none';
      logoutBtn.style.display = 'none';
      showToast('Anda telah keluar dari panel pengelola.', 'info');
    });
  }

  // Theme Toggle
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  function initTheme() {
    const saved = localStorage.getItem('revd_theme') || 'dark';
    if (saved === 'dark') {
      document.body.classList.add('dark-mode');
      if (themeToggleBtn) themeToggleBtn.innerHTML = `${SUN_SVG} LIGHT`;
    } else {
      document.body.classList.remove('dark-mode');
      if (themeToggleBtn) themeToggleBtn.innerHTML = `${MOON_SVG} DARK`;
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-mode');
      localStorage.setItem('revd_theme', isDark ? 'dark' : 'light');
      themeToggleBtn.innerHTML = isDark ? `${SUN_SVG} LIGHT` : `${MOON_SVG} DARK`;
    });
  }

  // Startup check
  window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    dismissPreloader();
    const savedToken = sessionStorage.getItem('revd_admin_token');
    if (savedToken) {
      adminToken = savedToken;
      loginView.style.display = 'none';
      dashboardView.style.display = 'block';
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
      switchTab('stats');
    }
  });

})();
