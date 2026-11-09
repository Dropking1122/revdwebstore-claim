// REVDSTORE Admin Dashboard Script
// Responsive Card Layout — Buttons Below Title — Professional Tone

(function () {
  let adminToken = '';

  // Theme SVG icons
  const SUN_SVG = `<svg class="ui-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="23" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  const MOON_SVG = `<svg class="ui-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

  // Elements
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('admin-login-form');
  const logoutBtn = document.getElementById('logout-btn');

  // Tabs
  const tabProducts = document.getElementById('admin-tab-products');
  const tabLogs = document.getElementById('admin-tab-logs');
  const tabSettings = document.getElementById('admin-tab-settings');
  const tabBackup = document.getElementById('admin-tab-backup');
  const sectionProducts = document.getElementById('admin-section-products');
  const sectionLogs = document.getElementById('admin-section-logs');
  const sectionSettings = document.getElementById('admin-section-settings');
  const sectionBackup = document.getElementById('admin-section-backup');

  // Stats elements
  const statProducts = document.getElementById('stat-products');
  const statSlots = document.getElementById('stat-slots');
  const statClaimed = document.getElementById('stat-claimed');
  const statToday = document.getElementById('stat-today');

  // Containers
  const productsCardsContainer = document.getElementById('products-cards-container');
  const logsCardsContainer = document.getElementById('logs-cards-container');

  // Modals
  const productModalOverlay = document.getElementById('product-modal-overlay');
  const productModalClose = document.getElementById('product-modal-close');
  const productModalCancel = document.getElementById('product-modal-cancel');
  const productForm = document.getElementById('product-form');
  const btnAddProduct = document.getElementById('btn-add-product');

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

  // Toast
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'neo-toast';
    let bg = 'var(--surface)';
    if (type === 'success') { bg = 'var(--mint)'; }
    else if (type === 'error') { bg = 'var(--pink)'; }
    else if (type === 'warning') { bg = 'var(--yellow)'; }

    toast.style.background = bg;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  }

  // API Fetch
  async function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (adminToken) {
      options.headers['x-admin-token'] = adminToken;
    }
    if (options.body && typeof options.body === 'string' && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Sesi pengelola berakhir.');
    }
    return res.json();
  }

  function handleUnauthorized() {
    adminToken = '';
    localStorage.removeItem('revd_admin_token');
    loginView.style.display = 'block';
    dashboardView.style.display = 'none';
    logoutBtn.style.display = 'none';
    dismissPreloader();
  }

  function handleAuthorized(token) {
    adminToken = token;
    localStorage.setItem('revd_admin_token', token);
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';
    logoutBtn.style.display = 'inline-flex';
    loadDashboard();
  }

  // Toggle Show/Hide Admin Token
  const togglePassBtn = document.getElementById('toggle-admin-password');
  const passInput = document.getElementById('admin-password');
  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        togglePassBtn.textContent = 'HIDE';
      } else {
        passInput.type = 'password';
        togglePassBtn.textContent = 'SHOW';
      }
    });
  }

  // Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = passInput ? passInput.value : '';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'Token tidak valid.', 'error');
        return;
      }
      showToast('Autentikasi Token berhasil.', 'success');
      handleAuthorized(data.token);
    } catch (err) {
      showToast('Gagal menghubungi server.', 'error');
    }
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    handleUnauthorized();
    showToast('Telah keluar dari panel pengelola.', 'info');
  });

  // Switch Tabs
  function setActiveTab(tab) {
    tabProducts.className = tab === 'products' ? 'neo-btn neo-btn-yellow btn-sm' : 'neo-btn neo-btn-white btn-sm';
    tabLogs.className = tab === 'logs' ? 'neo-btn neo-btn-yellow btn-sm' : 'neo-btn neo-btn-white btn-sm';
    tabSettings.className = tab === 'settings' ? 'neo-btn neo-btn-yellow btn-sm' : 'neo-btn neo-btn-white btn-sm';
    if (tabBackup) tabBackup.className = tab === 'backup' ? 'neo-btn neo-btn-yellow btn-sm' : 'neo-btn neo-btn-white btn-sm';

    sectionProducts.style.display = tab === 'products' ? 'block' : 'none';
    sectionLogs.style.display = tab === 'logs' ? 'block' : 'none';
    sectionSettings.style.display = tab === 'settings' ? 'block' : 'none';
    if (sectionBackup) sectionBackup.style.display = tab === 'backup' ? 'block' : 'none';

    if (tab === 'products') loadProducts();
    if (tab === 'logs') loadLogs();
    if (tab === 'settings') loadSettings();
    if (tab === 'backup') loadBackups();
  }

  tabProducts.addEventListener('click', () => setActiveTab('products'));
  tabLogs.addEventListener('click', () => setActiveTab('logs'));
  tabSettings.addEventListener('click', () => setActiveTab('settings'));
  if (tabBackup) tabBackup.addEventListener('click', () => setActiveTab('backup'));

  // Load Dashboard
  async function loadDashboard() {
    try {
      await Promise.all([loadStats(), loadProducts()]);
    } finally {
      dismissPreloader();
    }
  }

  async function loadStats() {
    try {
      const data = await apiFetch('/api/admin/stats');
      if (data.success && data.stats) {
        statProducts.innerText = data.stats.total_products;
        statSlots.innerText = data.stats.remaining_slots;
        statClaimed.innerText = data.stats.total_claimed;
        statToday.innerText = data.stats.claims_today;
      }
    } catch (e) {}
  }

  // Load Products (Responsive Card Grid - Action Buttons Below Title)
  async function loadProducts() {
    productsCardsContainer.innerHTML = `
      <div class="neo-box" style="padding: 24px; text-align: center;">
        <p style="font-size: 0.95rem; font-weight: 800;">Memuat data produk...</p>
      </div>
    `;

    try {
      const data = await apiFetch('/api/admin/products');
      if (!data.success) throw new Error(data.message);

      const products = data.products || [];
      if (products.length === 0) {
        productsCardsContainer.innerHTML = `
          <div class="neo-box" style="padding: 30px; text-align: center;">
            <p style="font-size: 1rem; font-weight: 800;">Belum ada produk aktif.</p>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">Klik tombol "+ Tambah Produk Baru" untuk memulai.</p>
          </div>
        `;
        return;
      }

      productsCardsContainer.innerHTML = products.map((p) => {
        const remaining = p.remaining_claims || 0;
        const totalCap = p.total_capacity || 0;
        const claimed = p.total_claimed || 0;

        return `
          <div class="admin-card">
            <!-- Header: Title, Slug & Badges -->
            <div class="admin-card-header">
              <div class="admin-card-title-group" style="display: flex; align-items: center; gap: 10px;">
                <img src="${escapeHtml(p.image_url || '/uploads/logo.svg')}" style="width: 38px; height: 38px; border-radius: 6px; border: 2px solid #0F0F0F; object-fit: cover; background: #FFF; flex-shrink: 0;" onerror="this.src='/uploads/logo.svg'">
                <div>
                  <h4 class="admin-card-title">${escapeHtml(p.name)}</h4>
                  <div class="admin-card-slug">/${escapeHtml(p.slug)}</div>
                </div>
              </div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <span class="neo-badge ${p.is_active ? 'badge-mint' : 'badge-gray'}">
                  ${p.is_active ? 'AKTIF' : 'NONAKTIF'}
                </span>
                ${p.is_paid ? `<span class="neo-badge badge-yellow">🛒 STORE (Rp ${(p.price || 0).toLocaleString('id-ID')})</span>` : '<span class="neo-badge badge-mint">🎁 GRATIS</span>'}
                <span class="neo-badge badge-gray">
                  ${p.item_type === 'link' ? 'INVITE LINK' : 'EMAIL & PASS'}
                </span>
                <span class="neo-badge badge-${p.color_theme || 'yellow'}">
                  ${escapeHtml(p.badge_text)}
                </span>
                <span class="neo-badge badge-purple" style="font-size: 0.7rem;">
                  ⏱️ ${p.cooldown_days > 0 ? `Klaim: Tiap ${p.cooldown_days} Hari` : 'Klaim: 1x Permanen'}
                </span>
              </div>
            </div>

            <!-- ACTION BUTTONS: PLACED DIRECTLY BELOW TITLE -->
            <div class="admin-card-actions">
              <button onclick="window.openStockModal(${p.id}, '${escapeJsString(p.name)}')" class="neo-btn neo-btn-cyan btn-sm">
                + Tambah Stok
              </button>
              <button onclick="window.openItemsList(${p.id}, '${escapeJsString(p.name)}')" class="neo-btn neo-btn-white btn-sm">
                Kelola Akun (${p.total_items})
              </button>
              <button onclick="window.openEditModal(${p.id})" class="neo-btn neo-btn-white btn-sm">
                Edit Produk
              </button>
              <button onclick="window.deleteProduct(${p.id}, '${escapeJsString(p.name)}')" class="neo-btn neo-btn-pink btn-sm">
                Hapus
              </button>
            </div>

            <!-- Stats Meta Pills -->
            <div class="admin-card-meta">
              <div class="admin-meta-item">
                <div class="admin-meta-label">Sisa Kuota</div>
                <div class="admin-meta-val" style="color: ${remaining > 0 ? 'var(--mint)' : 'var(--pink)'};">
                  ${remaining} Slot Tersedia
                </div>
              </div>
              <div class="admin-meta-item">
                <div class="admin-meta-label">Total Terklaim</div>
                <div class="admin-meta-val">
                  ${claimed} / ${totalCap} Kuota
                </div>
              </div>
              <div class="admin-meta-item">
                <div class="admin-meta-label">Stok Fisik</div>
                <div class="admin-meta-val">
                  ${p.total_items} Item Akun
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      productsCardsContainer.innerHTML = `
        <div class="neo-box" style="padding: 20px; text-align: center; color: var(--pink);">
          Error: ${err.message}
        </div>
      `;
    }
  }

  // Elements Cooldown & Paid Store
  const prodCooldownSelect = document.getElementById('prod-cooldown-select');
  const prodCooldownCustomWrap = document.getElementById('prod-cooldown-custom-wrap');
  const prodCooldownCustom = document.getElementById('prod-cooldown-custom');
  const prodIsPaid = document.getElementById('prod-is-paid');
  const prodPaidFields = document.getElementById('prod-paid-fields');
  const prodPrice = document.getElementById('prod-price');
  const prodPromoBadge = document.getElementById('prod-promo-badge');

  if (prodIsPaid) {
    prodIsPaid.addEventListener('change', () => {
      if (prodPaidFields) prodPaidFields.style.display = prodIsPaid.checked ? 'grid' : 'none';
      const badgeInput = document.getElementById('prod-badge');
      if (badgeInput) {
        if (prodIsPaid.checked && badgeInput.value === 'GRATIS') badgeInput.value = 'STORE';
        if (!prodIsPaid.checked && badgeInput.value === 'STORE') badgeInput.value = 'GRATIS';
      }
    });
  }

  if (prodCooldownSelect) {
    prodCooldownSelect.addEventListener('change', () => {
      if (prodCooldownSelect.value === 'custom') {
        prodCooldownCustomWrap.style.display = 'block';
        prodCooldownCustom.focus();
      } else {
        prodCooldownCustomWrap.style.display = 'none';
      }
    });
  }

  // Open Edit Product Modal
  window.openEditModal = async function (id) {
    try {
      const data = await apiFetch('/api/admin/products');
      const prod = (data.products || []).find((p) => p.id === id);
      if (!prod) return;

      document.getElementById('product-modal-title').innerText = 'Edit Produk';
      document.getElementById('prod-id').value = prod.id;
      document.getElementById('prod-name').value = prod.name;
      document.getElementById('prod-slug').value = prod.slug;
      document.getElementById('prod-type').value = prod.item_type;
      document.getElementById('prod-desc').value = prod.description || '';
      document.getElementById('prod-badge').value = prod.badge_text || '';
      document.getElementById('prod-theme').value = prod.color_theme || 'yellow';
      document.getElementById('prod-status').value = prod.is_active !== false ? 'true' : 'false';
      document.getElementById('prod-image').value = prod.image_url || '';
      document.getElementById('prod-image-preview').src = prod.image_url || '/uploads/logo.svg';

      // Store / Paid fields
      if (prodIsPaid) {
        prodIsPaid.checked = !!prod.is_paid;
        if (prodPaidFields) prodPaidFields.style.display = prod.is_paid ? 'grid' : 'none';
      }
      if (prodPrice) prodPrice.value = prod.price || 0;
      if (prodPromoBadge) prodPromoBadge.value = prod.promo_badge || '';

      // Cooldown field
      const cooldownVal = parseInt(prod.cooldown_days, 10) || 0;
      const standardDays = ['0', '1', '2', '3', '7', '14', '30', '60', '365'];
      if (standardDays.includes(String(cooldownVal))) {
        if (prodCooldownSelect) prodCooldownSelect.value = String(cooldownVal);
        if (prodCooldownCustomWrap) prodCooldownCustomWrap.style.display = 'none';
        if (prodCooldownCustom) prodCooldownCustom.value = '';
      } else {
        if (prodCooldownSelect) prodCooldownSelect.value = 'custom';
        if (prodCooldownCustomWrap) prodCooldownCustomWrap.style.display = 'block';
        if (prodCooldownCustom) prodCooldownCustom.value = cooldownVal;
      }

      productModalOverlay.classList.add('active');
    } catch (e) {
      showToast('Gagal membuka data produk.', 'error');
    }
  };

  // Add Product Modal
  btnAddProduct.addEventListener('click', () => {
    productForm.reset();
    document.getElementById('product-modal-title').innerText = 'Tambah Produk Baru';
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-badge').value = 'GRATIS';
    document.getElementById('prod-theme').value = 'yellow';
    document.getElementById('prod-status').value = 'true';
    document.getElementById('prod-image').value = '';
    document.getElementById('prod-image-preview').src = '/uploads/logo.svg';
    if (prodIsPaid) {
      prodIsPaid.checked = false;
      if (prodPaidFields) prodPaidFields.style.display = 'none';
    }
    if (prodPrice) prodPrice.value = '0';
    if (prodPromoBadge) prodPromoBadge.value = '';
    if (prodCooldownSelect) prodCooldownSelect.value = '0';
    if (prodCooldownCustomWrap) prodCooldownCustomWrap.style.display = 'none';
    if (prodCooldownCustom) prodCooldownCustom.value = '';
    productModalOverlay.classList.add('active');
  });

  productModalClose.addEventListener('click', () => productModalOverlay.classList.remove('active'));
  productModalCancel.addEventListener('click', () => productModalOverlay.classList.remove('active'));

  // Submit Product Form (Create / Edit)
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;

    let cooldownDays = 0;
    if (prodCooldownSelect && prodCooldownSelect.value === 'custom') {
      cooldownDays = parseInt(prodCooldownCustom.value, 10) || 0;
    } else if (prodCooldownSelect) {
      cooldownDays = parseInt(prodCooldownSelect.value, 10) || 0;
    }

    const body = {
      name: document.getElementById('prod-name').value.trim(),
      slug: document.getElementById('prod-slug').value.trim(),
      item_type: document.getElementById('prod-type').value,
      description: document.getElementById('prod-desc').value.trim(),
      badge_text: document.getElementById('prod-badge').value.trim(),
      color_theme: document.getElementById('prod-theme').value,
      is_active: document.getElementById('prod-status').value === 'true',
      cooldown_days: cooldownDays,
      image_url: document.getElementById('prod-image').value.trim(),
      is_paid: prodIsPaid ? prodIsPaid.checked : false,
      price: prodPrice ? parseInt(prodPrice.value, 10) || 0 : 0,
      promo_badge: prodPromoBadge ? prodPromoBadge.value.trim() : '',
    };

    try {
      let res;
      if (id) {
        res = await apiFetch(`/api/admin/products/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await apiFetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.success) {
        showToast(res.message, 'error');
        return;
      }

      showToast(id ? 'Data produk diperbarui.' : 'Produk baru ditambahkan.', 'success');
      productModalOverlay.classList.remove('active');
      loadProducts();
      loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Delete Product
  window.deleteProduct = async function (id, name) {
    if (!confirm(`Konfirmasi penonaktifan produk "${name}"?`)) return;

    try {
      const res = await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (!res.success) throw new Error(res.message);
      showToast('Produk dinonaktifkan.', 'success');
      loadProducts();
      loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Stock Modal
  window.openStockModal = function (productId, productName) {
    stockForm.reset();
    document.getElementById('stock-product-id').value = productId;
    document.getElementById('stock-modal-title').innerText = `Tambah Stok: ${productName}`;
    document.getElementById('stock-max-claims').value = 2;
    stockModalOverlay.classList.add('active');
  };

  stockModalClose.addEventListener('click', () => stockModalOverlay.classList.remove('active'));
  stockModalCancel.addEventListener('click', () => stockModalOverlay.classList.remove('active'));

  // Submit Bulk Stock
  stockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('stock-product-id').value;
    const maxClaims = parseInt(document.getElementById('stock-max-claims').value, 10) || 2;
    const text = document.getElementById('stock-text').value;
    const notes = document.getElementById('stock-notes').value.trim();

    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      showToast('Masukkan minimal 1 baris akun/link.', 'warning');
      return;
    }

    try {
      const res = await apiFetch(`/api/admin/products/${productId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines,
          items_text: lines.join('\n'),
          max_claims: maxClaims,
          notes: notes,
        }),
      });

      if (!res.success) {
        showToast(res.message, 'error');
        return;
      }

      showToast(`Berhasil menambahkan ${res.inserted_count || res.count || lines.length} akun/link!`, 'success');
      stockModalOverlay.classList.remove('active');
      loadProducts();
      loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Items List Modal
  window.openItemsList = async function (productId, productName) {
    document.getElementById('items-list-modal-title').innerText = `Daftar Stok: ${productName}`;
    itemsListBody.innerHTML = `<div class="neo-box" style="padding: 16px; text-align: center;">Memuat daftar item...</div>`;
    itemsListModalOverlay.classList.add('active');

    try {
      const data = await apiFetch(`/api/admin/products/${productId}/items`);
      if (!data.success) throw new Error(data.message);

      const items = data.items || [];
      if (items.length === 0) {
        itemsListBody.innerHTML = `<div class="neo-box" style="padding: 20px; text-align: center;">Belum ada item stok tersimpan.</div>`;
        return;
      }

      itemsListBody.innerHTML = items.map((it) => {
        return `
          <div class="neo-box" style="padding: 12px; background: var(--surface-box);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div style="font-family: monospace; font-size: 0.85rem; font-weight: 700; word-break: break-all; flex-grow: 1;">
                ${escapeHtml(it.content)}
              </div>
              <button onclick="window.deleteItem(${it.id}, ${productId}, '${escapeJsString(productName)}')" class="neo-btn neo-btn-pink btn-sm">
                Hapus
              </button>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 8px; align-items: center; font-size: 0.75rem;">
              <span class="neo-badge ${it.is_active ? 'badge-mint' : 'badge-gray'}">
                ${it.is_active ? 'AKTIF' : 'PENUH / HABIS'}
              </span>
              <span style="font-weight: 800;">
                Klaim: ${it.current_claims} / ${it.max_claims}
              </span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      itemsListBody.innerHTML = `<div class="neo-box" style="padding: 16px; color: var(--pink);">Error: ${err.message}</div>`;
    }
  };

  itemsListModalClose.addEventListener('click', () => itemsListModalOverlay.classList.remove('active'));

  // Delete Individual Item
  window.deleteItem = async function (itemId, productId, productName) {
    if (!confirm('Hapus item akun/link ini dari database?')) return;
    try {
      const res = await apiFetch(`/api/admin/items/${itemId}`, { method: 'DELETE' });
      if (!res.success) throw new Error(res.message);
      showToast('Item berhasil dihapus.', 'success');
      window.openItemsList(productId, productName);
      loadProducts();
      loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Load Claim Logs (Responsive Cards - Zero Horizontal Scroll)
  window.loadLogs = async function () {
    logsCardsContainer.innerHTML = `
      <div class="neo-box" style="padding: 24px; text-align: center;">
        <p style="font-size: 0.95rem; font-weight: 800;">Memuat log riwayat klaim...</p>
      </div>
    `;

    try {
      const data = await apiFetch('/api/admin/logs');
      if (!data.success) throw new Error(data.message);

      const logs = data.logs || [];
      if (logs.length === 0) {
        logsCardsContainer.innerHTML = `
          <div class="neo-box" style="padding: 30px; text-align: center;">
            <p style="font-size: 1rem; font-weight: 800;">Belum ada log klaim yang tercatat.</p>
          </div>
        `;
        return;
      }

      logsCardsContainer.innerHTML = logs.map((l) => {
        const dateStr = new Date(l.claimed_at).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        return `
          <div class="neo-box" style="padding: 14px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
              <span class="neo-badge badge-yellow">
                ${escapeHtml(l.product_name)}
              </span>
              <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">
                ${dateStr} WIB
              </span>
            </div>

            <div class="detail-box" style="margin: 8px 0; padding: 10px;">
              <div style="font-family: monospace; font-size: 0.85rem; font-weight: 700; word-break: break-all;">
                ${escapeHtml(l.claimed_content)}
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: var(--text-muted); font-family: monospace; flex-wrap: wrap; gap: 6px;">
              <span>IP: ${escapeHtml(l.ip_address)}</span>
              <span>Token: ${escapeHtml(l.user_token.substring(0, 18))}...</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      logsCardsContainer.innerHTML = `
        <div class="neo-box" style="padding: 20px; text-align: center; color: var(--pink);">
          Error: ${err.message}
        </div>
      `;
    }
  };

  // Helpers
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeJsString(str) {
    if (!str) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  // Image Upload Helper
  async function uploadImageFile(file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: formData,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal mengunggah file.');
    return data.url;
  }

  // Product Image File Upload Listener
  const prodImageFile = document.getElementById('prod-image-file');
  const prodImage = document.getElementById('prod-image');
  const prodImagePreview = document.getElementById('prod-image-preview');

  if (prodImageFile) {
    prodImageFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        showToast('Mengunggah gambar produk...', 'info');
        const url = await uploadImageFile(file);
        if (prodImage) prodImage.value = url;
        if (prodImagePreview) prodImagePreview.src = url;
        showToast('Gambar berhasil diunggah!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (prodImage) {
    prodImage.addEventListener('input', (e) => {
      if (prodImagePreview) prodImagePreview.src = e.target.value || '/uploads/logo.svg';
    });
  }

  // Favicon File Upload Listener
  const settingFaviconFile = document.getElementById('setting-favicon-file');
  const settingSiteFavicon = document.getElementById('setting-site-favicon');
  const settingFaviconPreview = document.getElementById('setting-favicon-preview');

  if (settingFaviconFile) {
    settingFaviconFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        showToast('Mengunggah favicon...', 'info');
        const url = await uploadImageFile(file);
        if (settingSiteFavicon) settingSiteFavicon.value = url;
        if (settingFaviconPreview) settingFaviconPreview.src = url;
        showToast('Favicon berhasil diunggah!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (settingSiteFavicon) {
    settingSiteFavicon.addEventListener('input', (e) => {
      if (settingFaviconPreview) settingFaviconPreview.src = e.target.value || '/uploads/favicon.svg';
    });
  }

  // Load Settings
  async function loadSettings() {
    try {
      const res = await apiFetch('/api/admin/settings');
      if (res.success && res.settings) {
        const s = res.settings;
        if (s.site_name) document.getElementById('setting-site-name').value = s.site_name;
        if (s.site_tag) document.getElementById('setting-site-tag').value = s.site_tag;
        if (s.site_title) document.getElementById('setting-site-title').value = s.site_title;
        if (s.hero_title) document.getElementById('setting-hero-title').value = s.hero_title;
        if (s.hero_desc) document.getElementById('setting-hero-desc').value = s.hero_desc;
        if (s.site_favicon) {
          document.getElementById('setting-site-favicon').value = s.site_favicon;
          if (settingFaviconPreview) settingFaviconPreview.src = s.site_favicon;
        }
        if (s.dev_name) document.getElementById('setting-dev-name').value = s.dev_name;
        if (s.dev_role) document.getElementById('setting-dev-role').value = s.dev_role;
        if (s.dev_bio) document.getElementById('setting-dev-bio').value = s.dev_bio;
        if (s.dev_telegram) document.getElementById('setting-dev-telegram').value = s.dev_telegram;
        if (s.dev_instagram) document.getElementById('setting-dev-instagram').value = s.dev_instagram;
        if (s.dev_email) document.getElementById('setting-dev-email').value = s.dev_email;
        if (s.terms_title && document.getElementById('setting-terms-title')) {
          document.getElementById('setting-terms-title').value = s.terms_title;
        }
        if (s.terms_content && document.getElementById('setting-terms-content')) {
          document.getElementById('setting-terms-content').value = s.terms_content;
        }
      }
    } catch (e) {
      showToast('Gagal memuat pengaturan web.', 'error');
    }
  }

  // Site Settings Form Submit
  const siteSettingsForm = document.getElementById('site-settings-form');
  if (siteSettingsForm) {
    siteSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        site_name: document.getElementById('setting-site-name').value.trim(),
        site_tag: document.getElementById('setting-site-tag').value.trim(),
        site_title: document.getElementById('setting-site-title').value.trim(),
        hero_title: document.getElementById('setting-hero-title').value.trim(),
        hero_desc: document.getElementById('setting-hero-desc').value.trim(),
        site_favicon: document.getElementById('setting-site-favicon').value.trim(),
        dev_name: document.getElementById('setting-dev-name').value.trim(),
        dev_role: document.getElementById('setting-dev-role').value.trim(),
        dev_bio: document.getElementById('setting-dev-bio').value.trim(),
        dev_telegram: document.getElementById('setting-dev-telegram').value.trim(),
        dev_instagram: document.getElementById('setting-dev-instagram').value.trim(),
        dev_email: document.getElementById('setting-dev-email').value.trim(),
        terms_title: document.getElementById('setting-terms-title') ? document.getElementById('setting-terms-title').value.trim() : '',
        terms_content: document.getElementById('setting-terms-content') ? document.getElementById('setting-terms-content').value.trim() : '',
      };

      try {
        const res = await apiFetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.success) {
          showToast('Pengaturan web & info developer berhasil disimpan!', 'success');
        } else {
          showToast(res.message || 'Gagal menyimpan pengaturan.', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // ====================================================
  // DATABASE BACKUP MANAGEMENT
  // ====================================================
  async function loadBackups() {
    const container = document.getElementById('backup-list-container');
    const statCount = document.getElementById('backup-stat-count');
    const statSize = document.getElementById('backup-stat-size');
    if (!container) return;

    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.88rem;">Memuat daftar backup...</p>';
    try {
      const data = await apiFetch('/api/admin/backups');
      if (!data.success || !data.backups || data.backups.length === 0) {
        container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Belum ada berkas snapshot backup tersimpan di server.<br><small style="display:block; margin-top:6px;">Klik tombol <b>"📥 Buat Backup Baru"</b> di atas untuk membuat snapshot pertama.</small></div>';
        if (statCount) statCount.textContent = '0 File';
        if (statSize) statSize.textContent = '0 KB';
        return;
      }

      let totalBytes = 0;
      data.backups.forEach(b => { totalBytes += b.size; });
      if (statCount) statCount.textContent = data.backups.length + ' File';
      if (statSize) statSize.textContent = (totalBytes / 1024).toFixed(1) + ' KB';

      let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
      data.backups.forEach(b => {
        const dateStr = new Date(b.created_at).toLocaleString('id-ID', {
          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        html += `
          <div class="neo-card" style="padding: 14px 16px; background: var(--surface); border: var(--border-thick); box-shadow: var(--shadow-sm); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="font-family: ui-monospace, monospace; font-weight: 800; font-size: 0.9rem; word-break: break-all; color: var(--text-main);">
                📦 ${escapeHtml(b.filename)}
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px; font-weight: 600;">
                ${dateStr} &bull; <b style="color: var(--text-main); font-weight: 800;">${b.size_formatted}</b>
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button onclick="window.downloadBackup('${escapeHtml(b.filename)}')" class="neo-btn neo-btn-yellow btn-sm">
                Unduh
              </button>
              <button onclick="window.restoreBackup('${escapeHtml(b.filename)}')" class="neo-btn neo-btn-white btn-sm" style="color: #b45309; font-weight: 800;">
                Restore
              </button>
              <button onclick="window.deleteBackup('${escapeHtml(b.filename)}')" class="neo-btn neo-btn-white btn-sm" style="color: #dc2626; font-weight: 800;">
                Hapus
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<p style="color: var(--pink); font-size: 0.88rem;">Gagal memuat daftar backup: ${escapeHtml(err.message)}</p>`;
    }
  }

  window.createBackup = async function() {
    const btn = document.getElementById('btn-create-backup');
    if (btn) { btn.disabled = true; btn.textContent = 'Membuat...'; }
    try {
      const res = await apiFetch('/api/admin/backups/create', { method: 'POST' });
      if (res.success) {
        showToast(res.message || 'Backup database berhasil dibuat!', 'success');
        loadBackups();
      } else {
        showToast(res.message || 'Gagal membuat backup.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Gagal menghubungi server.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📥 Buat Backup Baru'; }
    }
  };

  window.handleUploadBackup = async function(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('backup_file', file);

    const btn = document.getElementById('btn-upload-backup');
    if (btn) { btn.disabled = true; btn.textContent = 'Mengunggah...'; }

    try {
      showToast('Mengunggah berkas backup...', 'info');
      const res = await fetch('/api/admin/backups/upload', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Berkas backup berhasil diunggah!', 'success');
        await loadBackups();
        if (confirm(`Berkas "${data.filename}" berhasil diunggah ke server!\n\nApakah Anda ingin langsung me-RESTORE database dari berkas ini sekarang?`)) {
          window.restoreBackup(data.filename);
        }
      } else {
        showToast(data.message || 'Gagal mengunggah berkas backup.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Terjadi kesalahan saat mengunggah.', 'error');
    } finally {
      input.value = '';
      if (btn) { btn.disabled = false; btn.textContent = '📤 Upload Backup (.sql.gz)'; }
    }
  };

  window.downloadBackup = async function(filename) {
    try {
      const res = await fetch(`/api/admin/backups/download/${encodeURIComponent(filename)}`, {
        headers: adminToken ? { 'x-admin-token': adminToken } : {}
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Gagal mengunduh berkas backup.', 'error');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast('Gagal mengunduh backup: ' + err.message, 'error');
    }
  };

  window.restoreBackup = async function(filename) {
    if (!confirm(`PERINGATAN: Memulihkan database dari snapshot "${filename}" akan menimpa data yang ada saat ini!\n\nLanjutkan pemulihan database?`)) {
      return;
    }
    showToast('Sedang memulihkan database...', 'info');
    try {
      const res = await apiFetch(`/api/admin/backups/restore/${encodeURIComponent(filename)}`, { method: 'POST' });
      if (res.success) {
        showToast(res.message || 'Database berhasil dipulihkan!', 'success');
        loadStats();
        loadProducts();
      } else {
        showToast(res.message || 'Gagal memulihkan database.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Gagal memulihkan database.', 'error');
    }
  };

  window.deleteBackup = async function(filename) {
    if (!confirm(`Hapus berkas backup "${filename}" dari server?`)) return;
    try {
      const res = await apiFetch(`/api/admin/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (res.success) {
        showToast('Berkas backup berhasil dihapus.', 'info');
        loadBackups();
      } else {
        showToast(res.message || 'Gagal menghapus berkas backup.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Gagal menghapus berkas backup.', 'error');
    }
  };

  window.loadBackups = loadBackups;

  // Toggle Visibility for Change Password Inputs
  window.toggleChangePass = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'HIDE';
    } else {
      input.type = 'password';
      btn.textContent = 'SHOW';
    }
  };

  // Handle Change Password Form Submission
  const changePassForm = document.getElementById('admin-change-password-form');
  if (changePassForm) {
    changePassForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPass = document.getElementById('change-current-token').value;
      const newPass = document.getElementById('change-new-token').value;
      const confirmPass = document.getElementById('change-confirm-token').value;

      if (!currentPass || !newPass || !confirmPass) {
        showToast('Semua kolom token wajib diisi!', 'error');
        return;
      }
      if (newPass.length < 6) {
        showToast('Token baru minimal harus 6 karakter!', 'error');
        return;
      }
      if (newPass !== confirmPass) {
        showToast('Konfirmasi token baru tidak cocok!', 'error');
        return;
      }

      if (!confirm('Apakah Anda yakin ingin mengganti token admin? Anda akan otomatis dikeluarkan dan harus login kembali menggunakan token baru.')) {
        return;
      }

      const btn = document.getElementById('btn-submit-change-pass');
      if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

      try {
        const res = await apiFetch('/api/admin/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_password: currentPass,
            new_password: newPass,
            confirm_password: confirmPass
          })
        });

        if (res.success) {
          alert('✓ Token admin berhasil diubah!\n\nSesi Anda telah direset. Silakan login kembali dengan token baru.');
          // Clear credentials
          adminToken = null;
          localStorage.removeItem('revd_admin_token');
          handleUnauthorized();
          changePassForm.reset();
        } else {
          showToast(res.message || 'Gagal mengubah token admin.', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Terjadi kesalahan saat menghubungi server.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Simpan & Perbarui Token Admin'; }
      }
    });
  }

  // Admin Theme Toggle
  const adminThemeBtn = document.getElementById('admin-theme-btn');
  const adminThemeIconWrap = document.getElementById('admin-theme-icon-wrap');

  function initAdminTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    if (adminThemeIconWrap) {
      adminThemeIconWrap.innerHTML = isDark ? SUN_SVG : MOON_SVG;
    }
  }

  if (adminThemeBtn) {
    adminThemeBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-mode');
      document.documentElement.classList.toggle('dark-mode', isDark);
      if (adminThemeIconWrap) {
        adminThemeIconWrap.innerHTML = isDark ? SUN_SVG : MOON_SVG;
      }
      localStorage.setItem('revd_theme', isDark ? 'dark' : 'light');
    });
  }
  initAdminTheme();

  // Check saved auth
  const savedToken = localStorage.getItem('revd_admin_token');
  if (savedToken) {
    adminToken = savedToken;
    fetch('/api/admin/me', { headers: { 'x-admin-token': savedToken } })
      .then((res) => {
        if (res.ok) {
          handleAuthorized(savedToken);
        } else {
          handleUnauthorized();
        }
      })
      .catch(() => handleUnauthorized());
  } else {
    dismissPreloader();
  }
})();
