// REVDSTORE Digital Claim Client App
// Minimalist Neobrutalism & Professional Copy

(function () {
  // 1. Theme Management (Light / Dark)
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIconWrap = document.getElementById('theme-icon-wrap');
  const themeText = document.getElementById('theme-text');

  const SUN_SVG = `<svg class="ui-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="23" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  const MOON_SVG = `<svg class="ui-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

  function initTheme() {
    const saved = localStorage.getItem('revd_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved === 'dark' || (!saved && prefersDark);
    applyTheme(isDark);
  }

  function applyTheme(isDark) {
    if (isDark) {
      document.body.classList.add('dark-mode');
      document.documentElement.classList.add('dark-mode');
      if (themeIconWrap) themeIconWrap.innerHTML = SUN_SVG;
      if (themeText) themeText.innerText = 'LIGHT';
      localStorage.setItem('revd_theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark-mode');
      if (themeIconWrap) themeIconWrap.innerHTML = MOON_SVG;
      if (themeText) themeText.innerText = 'DARK';
      localStorage.setItem('revd_theme', 'light');
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isCurrentlyDark = document.body.classList.contains('dark-mode');
      applyTheme(!isCurrentlyDark);
    });
  }

  initTheme();

  // 2. Controlled Neobrutalist Preloader (Smooth & Satisfying)
  const pageStartTime = Date.now();
  const MIN_LOADING_TIME = 1100; // 1.1s minimum to showcase the animation
  const loaderStatus = document.getElementById('loader-status-text');
  const loaderBar = document.getElementById('loader-progress-bar');

  // Progressive steps during load
  setTimeout(() => {
    if (loaderStatus) loaderStatus.innerText = 'SINKRONISASI STOK...';
    if (loaderBar) loaderBar.style.width = '65%';
  }, 350);

  setTimeout(() => {
    if (loaderStatus) {
      const tab = getTabFromPath(window.location.pathname);
      loaderStatus.innerText = tab === 'history' ? 'MENYIAPKAN RIWAYAT...' : (tab === 'developer' ? 'MEMUAT PROFIL...' : 'MENYIAPKAN KATALOG...');
    }
    if (loaderBar) loaderBar.style.width = '90%';
  }, 750);

  let preloaderDismissed = false;
  function dismissPreloader() {
    if (preloaderDismissed) return;
    preloaderDismissed = true;
    const elapsed = Date.now() - pageStartTime;
    const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);

    setTimeout(() => {
      if (loaderBar) loaderBar.style.width = '100%';
      if (loaderStatus) loaderStatus.innerText = 'SIAP!';

      setTimeout(() => {
        const preloader = document.getElementById('app-preloader');
        if (preloader) {
          preloader.classList.add('fade-out');
          preloader.style.opacity = '0';
          preloader.style.pointerEvents = 'none';
          setTimeout(() => {
            if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
          }, 300);
        }
      }, 180);
    }, remaining);
  }

  // Safety fallback: pastikan preloader hilang maksimal 3.5 detik dalam kondisi apapun
  setTimeout(dismissPreloader, 3500);

  // 3. Fast Native Device Fingerprint & Multi-Store User Token
  function getDeviceFingerprint() {
    let fp = localStorage.getItem('revd_claim_device');
    if (!fp) {
      const m = document.cookie.match(/user_device_id=([^;]+)/);
      if (m && m[1]) fp = m[1];
    }
    if (!fp) {
      try {
        const parts = [
          screen.width,
          screen.height,
          screen.colorDepth,
          window.devicePixelRatio || 1,
          navigator.hardwareConcurrency || 4,
          navigator.maxTouchPoints || 0,
          navigator.platform || '',
          navigator.language || '',
          Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        ];

        // Canvas fingerprint
        try {
          const cvs = document.createElement('canvas');
          cvs.width = 160;
          cvs.height = 30;
          const ctx = cvs.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ff6b4a';
            ctx.fillRect(0, 0, 160, 30);
            ctx.font = "14px 'Arial', sans-serif";
            ctx.fillStyle = '#000000';
            ctx.fillText('REVDSTORE_FP_2026', 10, 20);
            parts.push(cvs.toDataURL().slice(-40));
          }
        } catch (e) {}

        // WebGL Renderer
        try {
          const glCvs = document.createElement('canvas');
          const gl = glCvs.getContext('webgl') || glCvs.getContext('experimental-webgl');
          if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
              parts.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
            }
          }
        } catch (e) {}

        // 32-bit FNV-1a Hash to 16-char hex
        const str = parts.join('###');
        let h1 = 0x811c9dc5, h2 = 0x27d4eb2f;
        for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          h1 = Math.imul(h1 ^ code, 0x01000193);
          h2 = Math.imul(h2 ^ code, 0x01000193);
        }
        fp = 'dev_' + (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
      } catch (e) {
        fp = 'dev_' + Math.random().toString(36).substring(2, 15);
      }
    }

    localStorage.setItem('revd_claim_device', fp);
    document.cookie = `user_device_id=${fp}; path=/; max-age=157680000; SameSite=Lax`;
    return fp;
  }

  function getUserToken() {
    let token = localStorage.getItem('revd_claim_token');
    if (!token) {
      const m = document.cookie.match(/user_claim_token=([^;]+)/);
      if (m && m[1]) token = m[1];
    }
    if (!token) {
      token = sessionStorage.getItem('revd_claim_token');
    }
    if (!token) {
      if (window.crypto && window.crypto.randomUUID) {
        token = 'usr_' + window.crypto.randomUUID();
      } else {
        token = 'usr_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      }
    }
    localStorage.setItem('revd_claim_token', token);
    sessionStorage.setItem('revd_claim_token', token);
    document.cookie = `user_claim_token=${token}; path=/; max-age=157680000; SameSite=Lax`;
    return token;
  }

  let USER_TOKEN = getUserToken();
  const DEVICE_ID = getDeviceFingerprint();
  let cachedProducts = [];
  let cachedHistory = [];
  let activeCatalogTab = 'all';

  // Bottom Navigation & Sections
  const navCatalog = document.getElementById('nav-catalog');
  const navHistory = document.getElementById('nav-history');
  const navRules = document.getElementById('nav-rules');
  const navDeveloper = document.getElementById('nav-developer');
  const btnOpenRules = document.getElementById('btn-open-rules');

  const sectionCatalog = document.getElementById('section-catalog');
  const sectionHistory = document.getElementById('section-history');
  const sectionDeveloper = document.getElementById('section-developer');
  const productsContainer = document.getElementById('products-container');
  const historyContainer = document.getElementById('history-container');
  const historyBadgeCount = document.getElementById('history-badge-count');

  // Load Dynamic Site Settings
  async function loadSiteSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        if (s.site_title) {
          document.title = s.site_title;
        }
        if (s.hero_title) {
          const el = document.getElementById('hero-banner-title');
          if (el) el.textContent = s.hero_title;
        }
        if (s.hero_desc) {
          const el = document.getElementById('hero-banner-desc');
          if (el) el.textContent = s.hero_desc;
        }
        if (s.site_name) {
          const el = document.getElementById('site-header-name');
          if (el) el.textContent = s.site_name;
        }
        if (s.site_tag) {
          const el = document.getElementById('site-header-tag');
          if (el) el.textContent = s.site_tag;
        }
        if (s.site_favicon) {
          const fav = document.getElementById('site-favicon-link');
          if (fav) fav.href = s.site_favicon;
        }
        if (s.dev_name) {
          const el = document.getElementById('display-dev-name');
          if (el) el.textContent = s.dev_name;
        }
        if (s.dev_role) {
          const el = document.getElementById('display-dev-role');
          if (el) el.textContent = s.dev_role;
        }
        if (s.google_client_id) {
          initGoogleAuth(s.google_client_id);
        } else {
          initGoogleAuth('');
        }
        if (s.dev_bio) {
          const el = document.getElementById('display-dev-bio');
          if (el) el.textContent = s.dev_bio;
        }
        if (s.dev_telegram) {
          const txt = document.getElementById('text-dev-telegram');
          const link = document.getElementById('link-dev-telegram');
          if (txt) txt.textContent = s.dev_telegram;
          if (link) {
            const clean = s.dev_telegram.replace('@', '');
            link.href = `https://t.me/${clean}`;
          }
        }
        if (s.dev_instagram) {
          const txt = document.getElementById('text-dev-instagram');
          const link = document.getElementById('link-dev-instagram');
          if (txt) txt.textContent = s.dev_instagram;
          if (link) {
            const handle = s.dev_instagram.replace('@', '').replace('https://instagram.com/', '').replace('https://www.instagram.com/', '').trim();
            link.href = `https://instagram.com/${handle}`;
          }
        }
        if (s.dev_email) {
          const txt = document.getElementById('text-dev-email');
          const link = document.getElementById('link-dev-email');
          if (txt) txt.textContent = s.dev_email;
          if (link) link.href = `mailto:${s.dev_email}`;
        }

        // Syarat & Ketentuan Layanan (Rules Modal)
        if (s.terms_title) {
          const titleEl = document.getElementById('rules-modal-title');
          if (titleEl) titleEl.textContent = s.terms_title;
        }
        if (s.terms_content) {
          const listEl = document.getElementById('rules-modal-list');
          if (listEl) {
            const blocks = s.terms_content.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
            if (blocks.length > 0) {
              listEl.innerHTML = blocks.map(block => {
                const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
                const header = lines[0] || '';
                const body = lines.slice(1).join(' ');
                return `
                  <div class="neo-box" style="padding: 14px; background: var(--surface-box);">
                    <strong style="color: var(--text-main);">${escapeHtml(header)}</strong>
                    ${body ? `<br><span style="color: var(--text-muted); display: inline-block; margin-top: 4px;">${escapeHtml(body)}</span>` : ''}
                  </div>`;
              }).join('');
            }
          }
        }
        buildNotifications();
      }
    } catch (e) {
      console.warn('Gagal sinkronisasi pengaturan web:', e);
    }
  }

  // Modals
  const claimModalOverlay = document.getElementById('claim-modal-overlay');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalTitle = document.getElementById('modal-title');
  const modalBodyContent = document.getElementById('modal-body-content');

  const rulesModalOverlay = document.getElementById('rules-modal-overlay');
  const rulesModalClose = document.getElementById('rules-modal-close');
  const rulesModalOk = document.getElementById('rules-modal-ok');

  // Pathname mapping for real URL navigation
  const TAB_PATHS = {
    catalog: '/',
    history: '/riwayat',
    developer: '/akun'
  };

  function getTabFromPath(pathname) {
    if (pathname === '/riwayat' || pathname === '/history') return 'history';
    if (pathname === '/developer' || pathname === '/akun' || pathname === '/profile' || pathname === '/profil') return 'developer';
    return 'catalog';
  }

  // Switch Tabs (Mobile Bottom Nav + HTML5 History API)
  function switchTab(tab, updateHistory = true) {
    // Reset all tabs
    [navCatalog, navHistory, navDeveloper].forEach(btn => btn && btn.classList.remove('active'));
    [sectionCatalog, sectionHistory, sectionDeveloper].forEach(sec => sec && (sec.style.display = 'none'));

    if (tab === 'catalog') {
      if (navCatalog) navCatalog.classList.add('active');
      if (sectionCatalog) sectionCatalog.style.display = 'block';
      loadProducts();
    } else if (tab === 'history') {
      if (navHistory) navHistory.classList.add('active');
      if (sectionHistory) sectionHistory.style.display = 'block';
      loadHistory();
    } else if (tab === 'developer') {
      if (navDeveloper) navDeveloper.classList.add('active');
      if (sectionDeveloper) sectionDeveloper.style.display = 'block';
      renderProfileSection();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (updateHistory && window.history && window.history.pushState) {
      const targetPath = TAB_PATHS[tab] || '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ tab }, '', targetPath);
      }
    }
  }

  // Handle browser Back / Forward buttons (popstate)
  window.addEventListener('popstate', (e) => {
    const tab = (e.state && e.state.tab) || getTabFromPath(window.location.pathname);
    switchTab(tab, false);
  });

  if (navCatalog) navCatalog.addEventListener('click', () => switchTab('catalog'));
  if (navHistory) navHistory.addEventListener('click', () => switchTab('history'));
  if (navDeveloper) navDeveloper.addEventListener('click', () => switchTab('developer'));

  // Catalog Category Filters (All / Free / Store)
  const tabFilterAll = document.getElementById('tab-filter-all');
  const tabFilterFree = document.getElementById('tab-filter-free');
  const tabFilterStore = document.getElementById('tab-filter-store');

  function setCatalogFilter(filter) {
    activeCatalogTab = filter;
    [tabFilterAll, tabFilterFree, tabFilterStore].forEach(btn => {
      if (btn) {
        btn.classList.remove('neo-btn-yellow');
        btn.classList.add('neo-btn-white');
      }
    });
    if (filter === 'all' && tabFilterAll) {
      tabFilterAll.classList.add('neo-btn-yellow');
      tabFilterAll.classList.remove('neo-btn-white');
    } else if (filter === 'free' && tabFilterFree) {
      tabFilterFree.classList.add('neo-btn-yellow');
      tabFilterFree.classList.remove('neo-btn-white');
    } else if (filter === 'store' && tabFilterStore) {
      tabFilterStore.classList.add('neo-btn-yellow');
      tabFilterStore.classList.remove('neo-btn-white');
    }
    renderProducts(cachedProducts);
  }

  if (tabFilterAll) tabFilterAll.addEventListener('click', () => setCatalogFilter('all'));
  if (tabFilterFree) tabFilterFree.addEventListener('click', () => setCatalogFilter('free'));
  if (tabFilterStore) tabFilterStore.addEventListener('click', () => setCatalogFilter('store'));

  // Rules Modal Handlers
  function openRules() {
    if (rulesModalOverlay) rulesModalOverlay.classList.add('active');
  }
  function closeRules() {
    if (rulesModalOverlay) rulesModalOverlay.classList.remove('active');
  }

  if (btnOpenRules) btnOpenRules.addEventListener('click', openRules);
  if (navRules) navRules.addEventListener('click', openRules);
  if (rulesModalClose) rulesModalClose.addEventListener('click', closeRules);
  if (rulesModalOk) rulesModalOk.addEventListener('click', closeRules);
  if (rulesModalOverlay) {
    rulesModalOverlay.addEventListener('click', (e) => {
      if (e.target === rulesModalOverlay) closeRules();
    });
  }

  // Toast Notification
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'neo-toast';
    
    let bg = 'var(--surface)';
    let stroke = 'currentColor';
    if (type === 'success') {
      bg = 'var(--mint)';
    } else if (type === 'error') {
      bg = 'var(--pink)';
    } else if (type === 'warning') {
      bg = 'var(--yellow)';
    }

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

  // Copy to Clipboard
  window.copyText = function (text, label = 'Data') {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(`${label} berhasil disalin`, 'success');
      }).catch(() => fallbackCopy(text, label));
    } else {
      fallbackCopy(text, label);
    }
  };

  function fallbackCopy(text, label) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(`${label} berhasil disalin`, 'success');
    } catch (err) {
      showToast('Gagal menyalin data', 'error');
    }
    document.body.removeChild(textArea);
  }

  // Catalog Live Search
  const catalogSearchInput = document.getElementById('catalog-search-input');
  const catalogSearchClear = document.getElementById('catalog-search-clear');

  if (catalogSearchInput) {
    catalogSearchInput.addEventListener('input', () => {
      const val = catalogSearchInput.value.trim();
      if (catalogSearchClear) {
        catalogSearchClear.style.display = val ? 'block' : 'none';
      }
      renderProducts(cachedProducts);
    });
  }

  if (catalogSearchClear) {
    catalogSearchClear.addEventListener('click', () => {
      if (catalogSearchInput) {
        catalogSearchInput.value = '';
        catalogSearchInput.focus();
      }
      catalogSearchClear.style.display = 'none';
      renderProducts(cachedProducts);
    });
  }

  window.clearCatalogSearch = function() {
    if (catalogSearchInput) catalogSearchInput.value = '';
    if (catalogSearchClear) catalogSearchClear.style.display = 'none';
    renderProducts(cachedProducts);
  };

  // Load Products from Server
  async function loadProducts() {
    try {
      const res = await fetch(`/api/products?token=${encodeURIComponent(USER_TOKEN)}&device=${encodeURIComponent(DEVICE_ID)}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Gagal memuat katalog');
      }

      cachedProducts = data.products || [];
      renderProducts(cachedProducts);
      updateHistoryCount();
    } catch (err) {
      productsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 24px;" class="neo-box">
          <p style="font-size: 1rem; font-weight: 800; color: #BE123C;">Gagal memuat katalog: ${err.message}</p>
          <button onclick="window.location.reload()" class="neo-btn neo-btn-white" style="margin-top: 10px;">Muat Ulang</button>
        </div>
      `;
    } finally {
      dismissPreloader();
    }
  }

  // Render Product Cards
  function renderProducts(products) {
    if (products.length === 0) {
      productsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 36px;" class="neo-box">
          <p style="font-size: 1.05rem; font-weight: 800;">Tidak ada produk aktif dalam katalog saat ini.</p>
        </div>
      `;
      return;
    }

    // Urutkan: Produk yang memiliki stok berada di atas, yang stoknya kosong / habis berada di bawah
    const sortedProducts = [...products].sort((a, b) => {
      const hasStockA = (a.remaining_claims || 0) > 0 ? 1 : 0;
      const hasStockB = (b.remaining_claims || 0) > 0 ? 1 : 0;
      if (hasStockA !== hasStockB) {
        return hasStockB - hasStockA; // Yang ada stok (1) di atas yang kosong (0)
      }
      return (a.id || 0) - (b.id || 0);
    });

    // Filter berdasarkan tab aktif: 'all', 'free', atau 'store'
    let filteredProducts = sortedProducts.filter((p) => {
      if (activeCatalogTab === 'free') return !p.is_paid;
      if (activeCatalogTab === 'store') return !!p.is_paid;
      return true;
    });

    // Filter berdasarkan input pencarian live jika ada
    const searchVal = (catalogSearchInput ? catalogSearchInput.value : '').trim().toLowerCase();
    if (searchVal) {
      filteredProducts = filteredProducts.filter((p) => {
        const nameMatch = (p.name || '').toLowerCase().includes(searchVal);
        const descMatch = (p.description || '').toLowerCase().includes(searchVal);
        const variantMatch = (p.variants || []).some(v => (v.name || '').toLowerCase().includes(searchVal));
        return nameMatch || descMatch || variantMatch;
      });
    }

    if (filteredProducts.length === 0) {
      productsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 36px;" class="neo-box">
          <p style="font-size: 1.05rem; font-weight: 800;">
            ${searchVal ? `Tidak ada produk yang cocok dengan pencarian "${escapeHtml(searchVal)}"` : 'Tidak ada produk pada kategori ini saat ini.'}
          </p>
          ${searchVal ? `<button onclick="window.clearCatalogSearch()" class="neo-btn neo-btn-white btn-sm" style="margin-top: 10px; font-size: 0.8rem;">Hapus Pencarian</button>` : ''}
        </div>
      `;
      return;
    }

    productsContainer.innerHTML = filteredProducts.map((prod) => {
      const remaining = prod.remaining_claims || 0;
      const isOutOfStock = remaining <= 0;
      const priceText = prod.is_paid 
        ? `Rp ${(prod.price || 0).toLocaleString('id-ID')}` 
        : 'Gratis';
      const badgeText = prod.is_paid ? 'STORE' : 'GRATIS';
      const badgeClass = prod.is_paid ? 'badge-yellow' : 'badge-mint';

      return `
        <div class="product-mini-card" onclick="window.openProductDetail(${prod.id})">
          <div class="product-mini-thumb">
            <span class="product-mini-badge neo-badge ${badgeClass}">${badgeText}</span>
            <img src="${escapeHtml(prod.image_url || '/uploads/logo.svg')}" alt="${escapeHtml(prod.name)}" onerror="this.src='/uploads/logo.svg'">
          </div>
          <div class="product-mini-body">
            <h3 class="product-mini-title">${escapeHtml(prod.name)}</h3>
            <div class="product-mini-footer">
              <span class="product-mini-price">${priceText}</span>
              <span class="product-mini-stock-dot ${isOutOfStock ? 'out-of-stock' : 'in-stock'}" title="${isOutOfStock ? 'Habis' : 'Tersedia'}"></span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // MODAL: Detail Produk Logic
  let currentDetailProduct = null;
  let selectedVariantId = null;

  window.openProductDetail = function(productId) {
    const prod = cachedProducts.find(p => p.id === productId);
    if (!prod) return;

    currentDetailProduct = prod;
    selectedVariantId = null;

    const overlay = document.getElementById('product-detail-modal-overlay');
    const imgEl = document.getElementById('detail-product-img');
    const titleEl = document.getElementById('detail-product-title');
    const headerTitleEl = document.getElementById('detail-product-header-title');
    const badgeEl = document.getElementById('detail-product-badge');
    const descEl = document.getElementById('detail-product-desc');
    const variantsWrap = document.getElementById('detail-product-variants-wrap');
    const variantsList = document.getElementById('detail-product-variants-list');

    if (!overlay) return;

    headerTitleEl.textContent = prod.is_paid ? 'DETAIL PRODUK STORE' : 'DETAIL PRODUK KLAIM';
    badgeEl.textContent = prod.is_paid ? 'STORE' : 'GRATIS';
    badgeEl.className = `neo-badge ${prod.is_paid ? 'badge-yellow' : 'badge-mint'}`;
    imgEl.src = prod.image_url || '/uploads/logo.svg';
    titleEl.textContent = prod.name;
    descEl.textContent = prod.description || 'Akses resmi produk digital siap pakai.';

    // Variants Handling
    const hasVariants = prod.variants && Array.isArray(prod.variants) && prod.variants.length > 0;
    if (hasVariants) {
      variantsWrap.style.display = 'block';
      selectedVariantId = prod.variants[0].id;

      variantsList.innerHTML = prod.variants.map((v, idx) => {
        const isSel = idx === 0;
        return `
          <div class="variant-select-option ${isSel ? 'selected' : ''}" data-variant-id="${v.id}" onclick="window.selectDetailVariant(${v.id})">
            <div>
              <strong style="text-transform: uppercase;">${escapeHtml(v.name)}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Stok: ${v.stock || 0} unit</div>
            </div>
            <div style="font-weight: 900; font-size: 0.95rem;">
              Rp ${(v.price || 0).toLocaleString('id-ID')}
            </div>
          </div>
        `;
      }).join('');
    } else {
      variantsWrap.style.display = 'none';
      variantsList.innerHTML = '';
    }

    updateDetailModalUI();
    overlay.classList.add('active');
  };

  window.selectDetailVariant = function(variantId) {
    selectedVariantId = variantId;
    const items = document.querySelectorAll('.variant-select-option');
    items.forEach(el => {
      if (parseInt(el.getAttribute('data-variant-id'), 10) === variantId) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
    updateDetailModalUI();
  };

  function updateDetailModalUI() {
    if (!currentDetailProduct) return;
    const prod = currentDetailProduct;
    const priceEl = document.getElementById('detail-product-price');
    const stockBadgeEl = document.getElementById('detail-product-stock-badge');
    const infoBox = document.getElementById('detail-product-info-box');
    const actionBtn = document.getElementById('detail-product-action-btn');

    let currentPrice = prod.price || 0;
    let currentStock = prod.remaining_claims || 0;

    if (selectedVariantId && prod.variants) {
      const activeVar = prod.variants.find(v => v.id === selectedVariantId);
      if (activeVar) {
        currentPrice = activeVar.price || 0;
        currentStock = activeVar.stock || 0;
      }
    }

    const isOutOfStock = currentStock <= 0;
    if (prod.is_paid) {
      priceEl.textContent = `Rp ${currentPrice.toLocaleString('id-ID')}`;
    } else {
      priceEl.textContent = 'Gratis';
    }

    if (isOutOfStock) {
      stockBadgeEl.className = 'neo-badge badge-pink';
      stockBadgeEl.textContent = 'Stok Habis';
    } else {
      stockBadgeEl.className = 'neo-badge badge-green';
      stockBadgeEl.textContent = `Tersedia (${currentStock} Slot)`;
    }

    infoBox.style.display = 'none';
    infoBox.innerHTML = '';

    if (prod.is_paid) {
      if (isOutOfStock) {
        actionBtn.className = 'neo-btn disabled';
        actionBtn.disabled = true;
        actionBtn.textContent = 'STOK HABIS';
        actionBtn.onclick = null;
      } else {
        actionBtn.className = 'neo-btn neo-btn-yellow';
        actionBtn.disabled = false;
        actionBtn.textContent = `BELI SEKARANG — Rp ${currentPrice.toLocaleString('id-ID')}`;
        actionBtn.onclick = () => {
          window.closeProductDetail();
          window.buyProduct(prod.id, selectedVariantId);
        };
      }
    } else {
      if (prod.already_claimed) {
        actionBtn.className = 'neo-btn neo-btn-mint';
        actionBtn.disabled = false;
        actionBtn.textContent = 'SUDAH DIKLAIM — LIHAT RIWAYAT';
        actionBtn.onclick = () => {
          window.closeProductDetail();
          window.appSwitchToHistory();
        };
        if (prod.cooldown_remaining_seconds && prod.cooldown_remaining_seconds > 0) {
          const nextDate = new Date(Date.now() + prod.cooldown_remaining_seconds * 1000);
          infoBox.style.display = 'block';
          infoBox.innerHTML = `<strong>Cooldown Aktif:</strong> Anda dapat mengklaim produk ini kembali pada <strong>${nextDate.toLocaleString('id-ID')}</strong>.`;
        }
      } else if (isOutOfStock) {
        actionBtn.className = 'neo-btn disabled';
        actionBtn.disabled = true;
        actionBtn.textContent = 'KUOTA HABIS';
        actionBtn.onclick = null;
      } else {
        actionBtn.className = 'neo-btn neo-btn-yellow';
        actionBtn.disabled = false;
        actionBtn.textContent = 'KLAIM SEKARANG';
        actionBtn.onclick = () => {
          window.closeProductDetail();
          window.claimProduct(prod.id);
        };
      }
    }
  }

  window.closeProductDetail = function() {
    const overlay = document.getElementById('product-detail-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  };

  const detailCloseBtn = document.getElementById('detail-product-close-btn');
  if (detailCloseBtn) detailCloseBtn.addEventListener('click', window.closeProductDetail);
  const detailOverlay = document.getElementById('product-detail-modal-overlay');
  if (detailOverlay) {
    detailOverlay.addEventListener('click', (e) => {
      if (e.target === detailOverlay) window.closeProductDetail();
    });
  }

  // Claim Product Action
  window.claimProduct = async function (productId) {
    try {
      showToast(`Memproses permintaan klaim...`, 'warning');

      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          user_token: USER_TOKEN,
          device_id: DEVICE_ID,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        showToast(data.message, 'error');
        loadProducts();
        return;
      }

      showToast('Klaim berhasil diproses.', 'success');
      openClaimModal(data.claim);
      loadProducts();
      updateHistoryCount();
    } catch (err) {
      showToast('Gagal memproses koneksi jaringan.', 'error');
    }
  };

  // Open Claim Result Modal
  function openClaimModal(claim) {
    modalTitle.innerText = `Akses: ${claim.product_name}`;
    
    let contentHtml = '';
    const raw = claim.content || '';

    const isHttpUrl = raw.startsWith('http://') || raw.startsWith('https://');
    if (claim.item_type === 'link' || isHttpUrl) {
      contentHtml = `
        <div style="margin-bottom: 14px;">
          <h4 style="font-size: 1.15rem; font-weight: 900;">Tautan Undangan Berhasil Dibuat</h4>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Gunakan tombol di bawah untuk membuka langsung atau menyalin tautan.</p>
        </div>

        <div class="detail-box">
          <div class="detail-row">
            <span class="detail-label">Tautan Lisensi</span>
          </div>
          <div style="word-break: break-all; font-size: 0.88rem; font-weight: 700; margin: 8px 0;">
            ${escapeHtml(raw)}
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 14px;">
          ${isHttpUrl ? `
            <a href="${escapeHtml(raw)}" target="_blank" rel="noopener noreferrer" class="neo-btn neo-btn-cyan" style="flex: 1;">
              Buka Tautan ↗
            </a>
          ` : ''}
          <button onclick="window.copyText('${escapeJsString(raw)}', 'Tautan')" class="neo-btn neo-btn-yellow" style="flex: 1;">
            Salin Tautan
          </button>
        </div>
      `;
    } else {
      let email = raw;
      let pass = '';
      if (raw.includes(':')) {
        const parts = raw.split(':');
        email = parts[0];
        pass = parts.slice(1).join(':');
      } else if (raw.includes('|')) {
        const parts = raw.split('|');
        email = parts[0];
        pass = parts.slice(1).join('|');
      }

      contentHtml = `
        <div style="margin-bottom: 14px;">
          <h4 style="font-size: 1.15rem; font-weight: 900;">Kredensial Akun Berhasil Diambil</h4>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Detail akun otomatis tercatat pada riwayat perangkat ini.</p>
        </div>

        <div class="detail-box">
          ${pass ? `
            <div class="detail-row">
              <span class="detail-label">Email / Pengguna</span>
              <span class="detail-val">${escapeHtml(email)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Kata Sandi</span>
              <span class="detail-val">${escapeHtml(pass)}</span>
            </div>
          ` : `
            <div class="detail-row">
              <span class="detail-label">Detail Kredensial</span>
              <span class="detail-val">${escapeHtml(raw)}</span>
            </div>
          `}
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px;">
          ${pass ? `
            <button onclick="window.copyText('${escapeJsString(email)}', 'Email')" class="neo-btn neo-btn-white" style="flex: 1; font-size: 0.82rem;">
              Salin Email
            </button>
            <button onclick="window.copyText('${escapeJsString(pass)}', 'Kata Sandi')" class="neo-btn neo-btn-white" style="flex: 1; font-size: 0.82rem;">
              Salin Sandi
            </button>
          ` : ''}
          <button onclick="window.copyText('${escapeJsString(raw)}', 'Detail Akun')" class="neo-btn neo-btn-yellow" style="width: 100%;">
            Salin Seluruh Akun
          </button>
        </div>
      `;
    }

    if (claim.notes) {
      contentHtml += `
        <div style="background: var(--surface-box); border: 2px solid var(--border-color); border-radius: 6px; padding: 10px 12px; margin-top: 14px; font-size: 0.82rem; font-weight: 700;">
          <strong>Petunjuk Penggunaan:</strong> ${escapeHtml(claim.notes)}
        </div>
      `;
    }

    // Upselling & Voucher Promo Banner
    contentHtml += `
      <div class="neo-box" style="margin-top: 16px; background: var(--surface-card); border-left: 6px solid var(--pink); padding: 12px; text-align: left;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <strong style="font-size: 0.88rem; color: var(--pink);">👑 MAU AKUN PRIVAT & BERGARANSI?</strong>
          <span class="neo-badge badge-yellow" style="font-size: 0.68rem; font-weight: 800;">REKOMENDASI</span>
        </div>
        <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 8px;">
          Akun gratis ini adalah akun shared/bersama. Mau akun privat 100% milik Anda sendiri tanpa gangguan? Beli langsung di <strong>Store kami</strong> dengan QRIS instan!
        </p>
        <div style="background: var(--surface-box); border: 1.5px dashed var(--border-color); padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 0.78rem; font-weight: 800;">Kupon Diskon: <code style="color: var(--pink);">${escapeHtml(claim.promo_coupon || 'CLAIMPROMO5')}</code></span>
          <button onclick="window.copyText('${escapeJsString(claim.promo_coupon || 'CLAIMPROMO5')}', 'Kode Kupon')" class="neo-btn neo-btn-white btn-sm" style="font-size: 0.7rem; padding: 2px 8px;">
            Salin Kupon
          </button>
        </div>
        <button onclick="claimModalOverlay.classList.remove('active'); setCatalogFilter('store'); window.scrollTo({top: 400, behavior: 'smooth'});" class="neo-btn neo-btn-yellow" style="width: 100%; margin-top: 10px; font-weight: 900; font-size: 0.8rem;">
          LIHAT PRODUK STORE 🛒
        </button>
      </div>
    `;

    modalBodyContent.innerHTML = contentHtml;
    claimModalOverlay.classList.add('active');
  }

  // Checkout QRIS Store Handlers (ShopeePay Port 7000)
  let currentOrderCode = null;
  let orderStatusPollTimer = null;
  let orderCountdownTimer = null;

  const checkoutModalOverlay = document.getElementById('checkout-modal-overlay');
  const checkoutCloseBtn = document.getElementById('checkout-close-btn');
  const checkoutCancelBtn = document.getElementById('checkout-cancel-btn');
  const checkoutProductName = document.getElementById('checkout-product-name');
  const checkoutAmount = document.getElementById('checkout-amount');
  const checkoutQrImg = document.getElementById('checkout-qr-img');
  const checkoutTimer = document.getElementById('checkout-timer');

  function closeCheckoutModal() {
    if (checkoutModalOverlay) checkoutModalOverlay.classList.remove('active');
    if (orderStatusPollTimer) {
      clearInterval(orderStatusPollTimer);
      orderStatusPollTimer = null;
    }
    if (orderCountdownTimer) {
      clearInterval(orderCountdownTimer);
      orderCountdownTimer = null;
    }
    currentOrderCode = null;
  }

  if (checkoutCloseBtn) checkoutCloseBtn.addEventListener('click', closeCheckoutModal);
  if (checkoutCancelBtn) checkoutCancelBtn.addEventListener('click', closeCheckoutModal);
  if (checkoutModalOverlay) {
    checkoutModalOverlay.addEventListener('click', (e) => {
      if (e.target === checkoutModalOverlay) closeCheckoutModal();
    });
  }

  window.checkCurrentOrderStatus = async function (manualClick = false) {
    if (!currentOrderCode) return;
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(currentOrderCode)}/status`);
      const data = await res.json();
      if (data.success && data.status === 'paid') {
        closeCheckoutModal();
        showToast('Pembayaran Berhasil! Akun siap digunakan.', 'success');
        openClaimModal({
          name: data.product_name,
          content: data.content,
          notes: data.notes,
          item_type: 'account',
          promo_coupon: 'CLAIMPROMO5'
        });
        loadProducts();
      } else if (manualClick) {
        showToast('Pembayaran belum terdeteksi. Silakan scan QRIS dan selesaikan bayar.', 'info');
      }
    } catch (e) {
      console.warn('Error polling order status:', e);
    }
  };

  window.buyProduct = async function (productId, variantId = null) {
    const prod = cachedProducts.find(p => p.id === productId);
    if (!prod) return;

    showToast('Menghubungkan ke gateway pembayaran...', 'info');

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          variant_id: variantId,
          user_token: getUserToken()
        })
      });
      const data = await res.json();
      if (!data.success) {
        return showToast(data.message || 'Gagal membuat pesanan.', 'error');
      }

      const order = data.order;
      currentOrderCode = order.order_code;

      if (checkoutProductName) checkoutProductName.textContent = order.product_name;
      if (checkoutAmount) checkoutAmount.textContent = 'Rp ' + Number(order.amount).toLocaleString('id-ID');

      // Set QR Code (dari gateway atau generator fallback)
      const qrDataUrl = order.qr_url || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(order.qris_string)}`;
      if (checkoutQrImg) checkoutQrImg.src = qrDataUrl;

      // Timer countdown (15 minutes)
      let secondsLeft = (order.expires_in_minutes || 15) * 60;
      if (orderCountdownTimer) clearInterval(orderCountdownTimer);
      function updateTimer() {
        const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
        const s = (secondsLeft % 60).toString().padStart(2, '0');
        if (checkoutTimer) checkoutTimer.textContent = `${m}:${s}`;
        if (secondsLeft <= 0) {
          clearInterval(orderCountdownTimer);
          closeCheckoutModal();
          showToast('Waktu pembayaran QRIS telah habis.', 'error');
        }
        secondsLeft--;
      }
      updateTimer();
      orderCountdownTimer = setInterval(updateTimer, 1000);

      // Start auto poll every 3 seconds
      if (orderStatusPollTimer) clearInterval(orderStatusPollTimer);
      orderStatusPollTimer = setInterval(() => {
        window.checkCurrentOrderStatus(false);
      }, 3000);

      if (checkoutModalOverlay) checkoutModalOverlay.classList.add('active');
    } catch (e) {
      console.error('Error buyProduct:', e);
      showToast('Terjadi kendala jaringan saat memproses pesanan.', 'error');
    }
  };

  // Close Modal
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
      claimModalOverlay.classList.remove('active');
    });
  }

  if (claimModalOverlay) {
    claimModalOverlay.addEventListener('click', (e) => {
      if (e.target === claimModalOverlay) {
        claimModalOverlay.classList.remove('active');
      }
    });
  }

  window.appSwitchToHistory = function () {
    switchTab('history');
  };

  // Load User History
  async function loadHistory() {
    try {
      historyContainer.innerHTML = `
        <div style="text-align: center; padding: 28px;" class="neo-box">
          <p style="font-size: 1rem; font-weight: 800;">Memuat riwayat akun tersimpan...</p>
        </div>
      `;

      const res = await fetch(`/api/history?token=${encodeURIComponent(USER_TOKEN)}&device=${encodeURIComponent(DEVICE_ID)}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Gagal mengambil riwayat');
      }

      cachedHistory = data.history || [];
      
      // Auto-restore token if matching by device
      if (cachedHistory.length > 0 && cachedHistory[0].user_token && cachedHistory[0].user_token !== USER_TOKEN) {
        USER_TOKEN = cachedHistory[0].user_token;
        localStorage.setItem('revd_claim_token', USER_TOKEN);
        sessionStorage.setItem('revd_claim_token', USER_TOKEN);
        document.cookie = `user_claim_token=${USER_TOKEN}; path=/; max-age=157680000; SameSite=Lax`;
      }

      renderHistory(cachedHistory);
      updateHistoryCount();
      buildNotifications();
    } catch (err) {
      historyContainer.innerHTML = `
        <div style="text-align: center; padding: 24px;" class="neo-box">
          <p style="font-size: 1rem; font-weight: 800; color: #BE123C;">Gagal memuat riwayat: ${err.message}</p>
        </div>
      `;
    } finally {
      dismissPreloader();
    }
  }

  // Global helpers for Account Token copy and restore modal
  window.copyUserToken = function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(USER_TOKEN).then(() => {
        showToast('Token disalin! Simpan untuk sinkronisasi di perangkat lain.', 'success');
      }).catch(() => {
        fallbackCopyToken();
      });
    } else {
      fallbackCopyToken();
    }
  };

  function fallbackCopyToken() {
    const tempInput = document.createElement('input');
    tempInput.value = USER_TOKEN;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand('copy');
      showToast('Token disalin!', 'success');
    } catch (e) {
      showToast('Gagal menyalin token otomatis.', 'warning');
    }
    document.body.removeChild(tempInput);
  }

  // View Token Modal Handlers
  window.openViewTokenModal = function () {
    const display = document.getElementById('view-token-display');
    if (display) display.textContent = USER_TOKEN;
    const modal = document.getElementById('view-token-modal-overlay');
    if (modal) modal.classList.add('active');
  };

  window.closeViewTokenModal = function () {
    const modal = document.getElementById('view-token-modal-overlay');
    if (modal) modal.classList.remove('active');
  };

  // Restore Token Modal Handlers
  window.openRestoreTokenModal = function () {
    const modal = document.getElementById('restore-token-modal-overlay');
    const input = document.getElementById('input-restore-token-modal');
    if (input) input.value = '';
    if (modal) modal.classList.add('active');
    if (input) setTimeout(() => input.focus(), 150);
  };

  window.closeRestoreTokenModal = function () {
    const modal = document.getElementById('restore-token-modal-overlay');
    if (modal) modal.classList.remove('active');
  };

  window.submitRestoreTokenFromModal = function () {
    const input = document.getElementById('input-restore-token-modal');
    const val = input ? input.value : '';
    if (val && val.trim().length >= 6) {
      const cleanToken = val.trim();
      USER_TOKEN = cleanToken;
      localStorage.setItem('revd_claim_token', cleanToken);
      sessionStorage.setItem('revd_claim_token', cleanToken);
      document.cookie = `user_claim_token=${cleanToken}; path=/; max-age=157680000; SameSite=Lax`;
      window.closeRestoreTokenModal();
      showToast('Token berhasil dipulihkan! Memuat ulang riwayat...', 'success');
      setTimeout(() => {
        loadHistory();
        loadProducts();
      }, 400);
    } else {
      showToast('Format Token tidak valid. Harap periksa kembali.', 'error');
    }
  };

  // History Account Detail Modal Handlers
  window.showHistoryDetailModal = function (idx) {
    const item = (window._cachedHistoryItems || [])[idx];
    if (!item) return;

    const raw = item.claimed_content || '';
    const isUrl = raw.startsWith('http://') || raw.startsWith('https://');
    const dateStr = new Date(item.claimed_at).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let activeStatusBadge = '';
    if (item.cooldown_days > 0 && item.expire_at) {
      const expMs = new Date(item.expire_at).getTime() - Date.now();
      if (expMs > 0) {
        const d = Math.floor(expMs / (24 * 3600 * 1000));
        const h = Math.floor((expMs % (24 * 3600 * 1000)) / (3600 * 1000));
        const m = Math.ceil((expMs % (3600 * 1000)) / (60 * 1000));
        const timeStr = d > 0 ? `${d}h ${h}j` : `${h}j ${m}m`;
        activeStatusBadge = `<span class="neo-badge badge-mint" style="font-size: 0.72rem;">Sisa Aktif: ${timeStr}</span>`;
      } else {
        activeStatusBadge = `<span class="neo-badge badge-gray" style="font-size: 0.72rem;">Masa Aktif Selesai</span>`;
      }
    }

    const titleEl = document.getElementById('history-detail-title');
    if (titleEl) titleEl.textContent = `DETAIL: ${item.product_name}`;

    const contentEl = document.getElementById('history-detail-content');
    if (contentEl) {
      contentEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <span class="neo-badge badge-${item.color_theme || 'yellow'}">${escapeHtml(item.badge_text || 'PRODUK')}</span>
          <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">Waktu Akses: ${dateStr} WIB</span>
            ${activeStatusBadge}
          </div>
        </div>

        <div class="neo-box" style="padding: 14px; background: var(--surface-box); margin-bottom: 12px;">
          <label style="display: block; font-size: 0.74rem; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; color: var(--text-muted); letter-spacing: 0.3px;">
            ${isUrl ? 'Tautan Undangan / Akses:' : 'Kredensial Akun (Email / Password):'}
          </label>
          <div style="font-family: monospace; font-size: 0.92rem; font-weight: 800; word-break: break-all; color: var(--text-main); white-space: pre-wrap;">${escapeHtml(raw)}</div>
        </div>

        ${item.claimed_notes ? `
          <div class="neo-box" style="padding: 12px; background: var(--surface); margin-bottom: 14px;">
            <strong style="font-size: 0.74rem; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 4px; letter-spacing: 0.3px;">Catatan Penggunaan:</strong>
            <div style="font-size: 0.82rem; line-height: 1.5; color: var(--text-main);">${escapeHtml(item.claimed_notes)}</div>
          </div>
        ` : ''}

        <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; margin-top: 14px;">
          ${isUrl ? `
            <a href="${escapeHtml(raw)}" target="_blank" rel="noopener noreferrer" class="neo-btn neo-btn-cyan" style="font-size: 0.82rem; padding: 8px 14px; font-weight: 800;">
              Buka Tautan ↗
            </a>
          ` : ''}
          <button onclick="window.copyText('${escapeJsString(raw)}', 'Detail Akun')" class="neo-btn neo-btn-yellow" style="font-size: 0.82rem; padding: 8px 14px; font-weight: 800;">
            Salin Data
          </button>
          <button onclick="window.closeHistoryDetailModal()" class="neo-btn neo-btn-white" style="font-size: 0.82rem; padding: 8px 14px; font-weight: 800;">
            Tutup
          </button>
        </div>
      `;
    }

    const overlay = document.getElementById('history-detail-modal-overlay');
    if (overlay) overlay.classList.add('active');
  };

  window.closeHistoryDetailModal = function () {
    const overlay = document.getElementById('history-detail-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  };

  // Render History Items
  function renderHistory(items) {
    window._cachedHistoryItems = items || [];

    const accountKeyCard = `
      <div style="display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;">
        <button class="neo-btn neo-btn-white" style="flex: 1; min-width: 130px; padding: 12px 14px; font-size: 0.88rem; font-weight: 900; display: inline-flex; align-items: center; justify-content: center; gap: 8px;" onclick="window.openViewTokenModal()">
          <span>🔑</span> TOKEN
        </button>
        <button class="neo-btn neo-btn-yellow" style="flex: 1; min-width: 155px; padding: 12px 14px; font-size: 0.88rem; font-weight: 900; display: inline-flex; align-items: center; justify-content: center; gap: 8px;" onclick="window.openRestoreTokenModal()">
          <span>📥</span> MASUKKAN TOKEN
        </button>
      </div>
    `;

    if (items.length === 0) {
      historyContainer.innerHTML = `
        ${accountKeyCard}
        <div style="text-align: center; padding: 36px 20px;" class="neo-box">
          <div class="neo-badge badge-pink" style="margin-bottom: 10px; font-size: 0.72rem;">STATUS KOSONG</div>
          <h3 style="font-size: 1.15rem; font-weight: 900; margin-bottom: 6px;">Belum Ada Riwayat Klaim</h3>
          <p style="color: var(--text-muted); margin-bottom: 16px; font-size: 0.88rem;">Anda belum mengambil produk digital apapun dengan Token ini.</p>
          <div style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
            <button onclick="window.appSwitchToCatalog()" class="neo-btn neo-btn-yellow">
              Buka Katalog Produk
            </button>
          </div>
        </div>
      `;
      return;
    }

    historyContainer.innerHTML = `
      ${accountKeyCard}
      <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <p style="font-weight: 800; font-size: 0.95rem;">
          Total Diklaim: <span class="neo-badge badge-yellow">${items.length} Item</span>
        </p>
        <span class="neo-badge badge-gray" style="font-size: 0.72rem; text-transform: none;">
          Tersimpan &amp; Sinkron Otomatis
        </span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${items.map((item, idx) => {
          const dateStr = new Date(item.claimed_at).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          let activeStatusBadge = '';
          if (item.cooldown_days > 0 && item.expire_at) {
            const expMs = new Date(item.expire_at).getTime() - Date.now();
            if (expMs > 0) {
              const d = Math.floor(expMs / (24 * 3600 * 1000));
              const h = Math.floor((expMs % (24 * 3600 * 1000)) / (3600 * 1000));
              const m = Math.ceil((expMs % (3600 * 1000)) / (60 * 1000));
              const timeStr = d > 0 ? `${d}h ${h}j` : `${h}j ${m}m`;
              activeStatusBadge = `<span class="neo-badge badge-mint" style="font-size: 0.72rem;">Sisa Aktif: ${timeStr}</span>`;
            } else {
              activeStatusBadge = `<span class="neo-badge badge-gray" style="font-size: 0.72rem;">Masa Aktif Selesai</span>`;
            }
          }

          return `
            <div class="neo-box" style="padding: 14px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <div>
                  <h4 style="font-size: 1.05rem; font-weight: 900;">${escapeHtml(item.product_name)}</h4>
                  <div style="display: flex; gap: 6px; align-items: center; margin-top: 3px; flex-wrap: wrap;">
                    <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Waktu Akses: ${dateStr} WIB</span>
                    ${activeStatusBadge}
                  </div>
                </div>
                <span class="neo-badge badge-${item.color_theme || 'yellow'}">${escapeHtml(item.badge_text || 'PRODUK')}</span>
              </div>

              <button onclick="window.showHistoryDetailModal(${idx})" class="neo-btn neo-btn-yellow" style="width: 100%; margin-top: 8px; font-size: 0.82rem; padding: 8px 12px; font-weight: 900;">
                LIHAT DETAIL AKUN ↗
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  window.appSwitchToCatalog = function () {
    switchTab('catalog');
  };

  // Update badge count in bottom nav
  async function updateHistoryCount() {
    try {
      const res = await fetch(`/api/history?token=${encodeURIComponent(USER_TOKEN)}&device=${encodeURIComponent(DEVICE_ID)}`);
      const data = await res.json();
      if (data.success && data.history) {
        const count = data.history.length;
        if (historyBadgeCount) {
          historyBadgeCount.innerText = count;
          historyBadgeCount.style.display = count > 0 ? 'inline-block' : 'none';
        }
      }
    } catch (e) {}
  }

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

  // Modal event listeners
  const viewTokenCloseBtn = document.getElementById('view-token-close-btn');
  if (viewTokenCloseBtn) viewTokenCloseBtn.addEventListener('click', window.closeViewTokenModal);
  const viewTokenCancelBtn = document.getElementById('view-token-cancel-btn');
  if (viewTokenCancelBtn) viewTokenCancelBtn.addEventListener('click', window.closeViewTokenModal);
  const viewTokenOverlay = document.getElementById('view-token-modal-overlay');
  if (viewTokenOverlay) {
    viewTokenOverlay.addEventListener('click', (e) => {
      if (e.target === viewTokenOverlay) window.closeViewTokenModal();
    });
  }

  const restoreCloseBtn = document.getElementById('restore-token-close-btn');
  if (restoreCloseBtn) restoreCloseBtn.addEventListener('click', window.closeRestoreTokenModal);
  const restoreCancelBtn = document.getElementById('restore-token-cancel-btn');
  if (restoreCancelBtn) restoreCancelBtn.addEventListener('click', window.closeRestoreTokenModal);
  const restoreOverlay = document.getElementById('restore-token-modal-overlay');
  if (restoreOverlay) {
    restoreOverlay.addEventListener('click', (e) => {
      if (e.target === restoreOverlay) window.closeRestoreTokenModal();
    });
  }

  const restoreInput = document.getElementById('input-restore-token-modal');
  if (restoreInput) {
    restoreInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.submitRestoreTokenFromModal();
      }
    });
  }

  const historyDetailCloseBtn = document.getElementById('history-detail-close-btn');
  if (historyDetailCloseBtn) historyDetailCloseBtn.addEventListener('click', window.closeHistoryDetailModal);
  const historyDetailOverlay = document.getElementById('history-detail-modal-overlay');
  if (historyDetailOverlay) {
    historyDetailOverlay.addEventListener('click', (e) => {
      if (e.target === historyDetailOverlay) window.closeHistoryDetailModal();
    });
  }

  // ====================================================
  // USER AUTHENTICATION & PROFILE SYSTEM
  // ====================================================
  let currentUser = null;
  let authMode = 'login'; // 'login' or 'register'
  let googleClientId = '';

  const profileGuestView = document.getElementById('profile-guest-view');
  const profileMemberView = document.getElementById('profile-member-view');
  const profileStatusBadge = document.getElementById('profile-status-badge');
  const guestTokenDisplay = document.getElementById('guest-token-display');
  const btnCopyGuestToken = document.getElementById('btn-copy-guest-token');

  const tabAuthLogin = document.getElementById('tab-auth-login');
  const tabAuthRegister = document.getElementById('tab-auth-register');
  const authForm = document.getElementById('auth-form');
  const authAlert = document.getElementById('auth-alert');
  const authUsername = document.getElementById('auth-username');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const fieldAuthEmail = document.getElementById('field-auth-email');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');

  const profileAvatarInitial = document.getElementById('profile-avatar-initial');
  const profileMemberUsername = document.getElementById('profile-member-username');
  const profileMemberEmail = document.getElementById('profile-member-email');
  const profileMemberToken = document.getElementById('profile-member-token');
  const profileMemberType = document.getElementById('profile-member-type');
  const profileStatClaims = document.getElementById('profile-stat-claims');
  const profileStatOrders = document.getElementById('profile-stat-orders');
  const btnCopyMemberToken = document.getElementById('btn-copy-member-token');
  const btnAuthLogout = document.getElementById('btn-auth-logout');

  const inputImportToken = document.getElementById('input-import-token');
  const btnRunImportToken = document.getElementById('btn-run-import-token');
  const importTokenAlert = document.getElementById('import-token-alert');

  function showAuthAlert(msg, isSuccess = false) {
    if (!authAlert) return;
    authAlert.style.display = 'block';
    authAlert.style.background = isSuccess ? '#ecfdf5' : '#fef2f2';
    authAlert.style.color = isSuccess ? '#065f46' : '#991b1b';
    authAlert.style.borderColor = isSuccess ? '#059669' : '#dc2626';
    authAlert.textContent = msg;
  }

  function hideAuthAlert() {
    if (authAlert) authAlert.style.display = 'none';
  }

  function setAuthMode(mode) {
    authMode = mode;
    hideAuthAlert();
    if (mode === 'login') {
      if (tabAuthLogin) {
        tabAuthLogin.className = 'neo-btn neo-btn-mint';
      }
      if (tabAuthRegister) {
        tabAuthRegister.className = 'neo-btn neo-btn-white';
      }
      if (fieldAuthEmail) fieldAuthEmail.style.display = 'none';
      if (btnAuthSubmit) btnAuthSubmit.textContent = 'MASUK KE AKUN';
    } else {
      if (tabAuthRegister) {
        tabAuthRegister.className = 'neo-btn neo-btn-mint';
      }
      if (tabAuthLogin) {
        tabAuthLogin.className = 'neo-btn neo-btn-white';
      }
      if (fieldAuthEmail) fieldAuthEmail.style.display = 'block';
      if (btnAuthSubmit) btnAuthSubmit.textContent = 'DAFTAR AKUN BARU';
    }
  }

  if (tabAuthLogin) tabAuthLogin.addEventListener('click', () => setAuthMode('login'));
  if (tabAuthRegister) tabAuthRegister.addEventListener('click', () => setAuthMode('register'));

  function renderProfileSection() {
    if (guestTokenDisplay) guestTokenDisplay.value = USER_TOKEN;

    if (!currentUser) {
      if (profileGuestView) profileGuestView.style.display = 'block';
      if (profileMemberView) profileMemberView.style.display = 'none';
      if (profileStatusBadge) {
        profileStatusBadge.textContent = 'MODE TAMU';
        profileStatusBadge.className = 'neo-badge badge-cyan';
      }
    } else {
      if (profileGuestView) profileGuestView.style.display = 'none';
      if (profileMemberView) profileMemberView.style.display = 'block';
      if (profileStatusBadge) {
        profileStatusBadge.textContent = 'MEMBER RESMI';
        profileStatusBadge.className = 'neo-badge badge-mint';
      }

      const initial = (currentUser.name || currentUser.username || 'U')[0].toUpperCase();
      if (profileAvatarInitial) profileAvatarInitial.textContent = initial;
      if (profileMemberUsername) profileMemberUsername.textContent = '@' + currentUser.username;
      if (profileMemberEmail) profileMemberEmail.textContent = currentUser.email || 'Tanpa Email';
      if (profileMemberToken) profileMemberToken.textContent = currentUser.user_token;
      if (profileMemberType) profileMemberType.textContent = currentUser.has_google ? 'GOOGLE SSO' : 'MEMBER';

      if (currentUser.stats) {
        if (profileStatClaims) profileStatClaims.textContent = currentUser.stats.total_claims || 0;
        if (profileStatOrders) profileStatOrders.textContent = currentUser.stats.total_orders || 0;
      }
    }
  }

  async function checkUserAuth() {
    try {
      const token = localStorage.getItem('revd_auth_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/user/profile', { headers });
      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;
        USER_TOKEN = currentUser.user_token;
        localStorage.setItem('revd_claim_token', USER_TOKEN);
        sessionStorage.setItem('revd_claim_token', USER_TOKEN);
      } else {
        currentUser = null;
      }
    } catch (e) {
      currentUser = null;
    }
    renderProfileSection();
  }

  // Handle Login / Register Submit
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAuthAlert();

      const username = authUsername.value.trim();
      const password = authPassword.value;
      const email = authEmail ? authEmail.value.trim() : '';

      if (!username || !password) {
        showAuthAlert('Username dan password wajib diisi.');
        return;
      }

      btnAuthSubmit.disabled = true;
      btnAuthSubmit.textContent = 'MEMPROSES...';

      const url = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = {
        username,
        password,
        guest_token: USER_TOKEN,
      };
      if (authMode === 'register' && email) payload.email = email;

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!data.success) {
          showAuthAlert(data.message || 'Gagal memproses autentikasi.');
          btnAuthSubmit.disabled = false;
          btnAuthSubmit.textContent = authMode === 'register' ? 'DAFTAR AKUN BARU' : 'MASUK KE AKUN';
          return;
        }

        // Store tokens
        localStorage.setItem('revd_auth_token', data.token);
        currentUser = data.user;
        USER_TOKEN = data.user.user_token;
        localStorage.setItem('revd_claim_token', USER_TOKEN);
        sessionStorage.setItem('revd_claim_token', USER_TOKEN);

        authUsername.value = '';
        authPassword.value = '';
        if (authEmail) authEmail.value = '';

        let succMsg = data.message || 'Berhasil masuk ke akun!';
        if (data.migrated && (data.migrated.orders > 0 || data.migrated.claims > 0)) {
          succMsg += ` (${data.migrated.orders} pesanan & ${data.migrated.claims} klaim browser disinkronkan)`;
        }
        showToast(succMsg, 'success');

        await checkUserAuth();
        loadHistory();
        loadProducts();
      } catch (err) {
        showAuthAlert('Terjadi kesalahan jaringan.');
      } finally {
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = authMode === 'register' ? 'DAFTAR AKUN BARU' : 'MASUK KE AKUN';
      }
    });
  }

  // Handle Logout
  if (btnAuthLogout) {
    btnAuthLogout.addEventListener('click', async () => {
      try {
        const token = localStorage.getItem('revd_auth_token');
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
      } catch (e) {}

      localStorage.removeItem('revd_auth_token');
      currentUser = null;

      // Generate fresh guest token
      if (window.crypto && window.crypto.randomUUID) {
        USER_TOKEN = 'usr_' + window.crypto.randomUUID();
      } else {
        USER_TOKEN = 'usr_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      }
      localStorage.setItem('revd_claim_token', USER_TOKEN);
      sessionStorage.setItem('revd_claim_token', USER_TOKEN);

      showToast('Anda telah keluar dari akun. Mode tamu aktif kembali.', 'info');
      renderProfileSection();
      loadHistory();
      loadProducts();
    });
  }

  // Manual Token Import
  if (btnRunImportToken && inputImportToken) {
    btnRunImportToken.addEventListener('click', async () => {
      const oldToken = inputImportToken.value.trim();
      if (!oldToken || !oldToken.startsWith('usr_')) {
        if (importTokenAlert) {
          importTokenAlert.style.display = 'block';
          importTokenAlert.style.background = '#fef2f2';
          importTokenAlert.style.color = '#991b1b';
          importTokenAlert.textContent = 'Token harus diawali usr_';
        }
        return;
      }

      btnRunImportToken.disabled = true;
      btnRunImportToken.textContent = '...';

      try {
        const token = localStorage.getItem('revd_auth_token');
        const res = await fetch('/api/user/import-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ old_token: oldToken }),
        });
        const data = await res.json();

        if (importTokenAlert) {
          importTokenAlert.style.display = 'block';
          importTokenAlert.style.background = data.success ? '#ecfdf5' : '#fef2f2';
          importTokenAlert.style.color = data.success ? '#065f46' : '#991b1b';
          importTokenAlert.textContent = data.message;
        }

        if (data.success) {
          inputImportToken.value = '';
          showToast(data.message, 'success');
          await checkUserAuth();
          loadHistory();
        }
      } catch (err) {
        if (importTokenAlert) {
          importTokenAlert.style.display = 'block';
          importTokenAlert.style.background = '#fef2f2';
          importTokenAlert.style.color = '#991b1b';
          importTokenAlert.textContent = 'Gagal memproses impor token.';
        }
      } finally {
        btnRunImportToken.disabled = false;
        btnRunImportToken.textContent = 'IMPOR';
      }
    });
  }

  // Copy Guest Token
  if (btnCopyGuestToken && guestTokenDisplay) {
    btnCopyGuestToken.addEventListener('click', () => {
      copyToClipboard(guestTokenDisplay.value);
      showToast('Token guest berhasil disalin ke clipboard!', 'success');
    });
  }

  // Copy Member Token
  if (btnCopyMemberToken && profileMemberToken) {
    btnCopyMemberToken.addEventListener('click', () => {
      copyToClipboard(profileMemberToken.textContent);
      showToast('Token akun permanen berhasil disalin!', 'success');
    });
  }

  // Google Sign-In Callback Handler
  window.handleGoogleCredentialResponse = async function(response) {
    if (!response || !response.credential) return;
    try {
      showToast('Memverifikasi akun Google...', 'info');
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
          guest_token: USER_TOKEN,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        showToast(data.message || 'Login Google gagal.', 'error');
        return;
      }

      localStorage.setItem('revd_auth_token', data.token);
      currentUser = data.user;
      USER_TOKEN = data.user.user_token;
      localStorage.setItem('revd_claim_token', USER_TOKEN);
      sessionStorage.setItem('revd_claim_token', USER_TOKEN);

      let msg = 'Login Google berhasil!';
      if (data.migrated && (data.migrated.orders > 0 || data.migrated.claims > 0)) {
        msg += ` (${data.migrated.orders} order & ${data.migrated.claims} klaim disinkronkan)`;
      }
      showToast(msg, 'success');

      await checkUserAuth();
      loadHistory();
      loadProducts();
    } catch (err) {
      showToast('Gagal memproses autentikasi Google.', 'error');
    }
  };

  function initGoogleAuth(clientId) {
    const sec = document.getElementById('google-signin-section');
    if (!clientId) {
      if (sec) sec.style.display = 'none';
      return;
    }
    googleClientId = clientId;
    if (sec) sec.style.display = 'block';

    const checkGsi = setInterval(() => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        clearInterval(checkGsi);
        try {
          google.accounts.id.initialize({
            client_id: googleClientId,
            callback: window.handleGoogleCredentialResponse,
          });
          const btnCont = document.getElementById('google-btn-container');
          if (btnCont) {
            google.accounts.id.renderButton(btnCont, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              width: 280,
            });
          }
        } catch (e) {
          console.error('Error initializing Google Sign-In:', e);
        }
      }
    }, 200);

    setTimeout(() => clearInterval(checkGsi), 5000);
  }

  // ====================================================
  // NOTIFICATION CENTER SYSTEM
  // ====================================================
  const btnNotificationBell = document.getElementById('btn-notification-bell');
  const notifBadge = document.getElementById('notif-badge');
  const notificationModalOverlay = document.getElementById('notification-modal-overlay');
  const notifModalClose = document.getElementById('notif-modal-close');
  const btnNotifCloseBottom = document.getElementById('btn-notif-close-bottom');
  const btnMarkAllRead = document.getElementById('btn-mark-all-read');
  const notifModalList = document.getElementById('notif-modal-list');

  let activeNotifications = [];

  function buildNotifications() {
    const list = [
      {
        id: 'notif_welcome',
        tag: 'PENGUMUMAN',
        badgeClass: 'badge-cyan',
        title: 'Selamat Datang di Hub Layanan',
        time: 'Sistem',
        desc: 'Jelajahi berbagai akun digital premium bergaransi dan nikmati kuota klaim gratis berkala setiap hari.'
      }
    ];

    if (siteSettings && siteSettings.promo_coupon_code) {
      list.unshift({
        id: 'notif_promo_' + siteSettings.promo_coupon_code,
        tag: 'PROMO KHUSUS',
        badgeClass: 'badge-yellow',
        title: `Voucher Diskon ${siteSettings.promo_discount_percent || 10}% Aktif!`,
        time: 'Terbatas',
        desc: `Gunakan kode kupon "${siteSettings.promo_coupon_code}" saat pemesanan untuk potongan harga langsung.`
      });
    }

    if (cachedHistory && cachedHistory.length > 0) {
      const latestOrder = cachedHistory[0];
      const isPaid = latestOrder.is_paid || latestOrder.order_id;
      list.unshift({
        id: 'notif_order_' + (latestOrder.order_id || latestOrder.id),
        tag: isPaid ? 'TRANSAKSI' : 'KLAIM',
        badgeClass: 'badge-mint',
        title: isPaid ? `Pesanan #${latestOrder.order_id || latestOrder.id} Siap Digunakan` : `Klaim ${latestOrder.product_name || 'Akun'} Berhasil`,
        time: formatDate(latestOrder.created_at || latestOrder.claimed_at),
        desc: `Akses akun Anda telah tersimpan dengan aman pada tab Riwayat.`
      });
    }

    activeNotifications = list;
    updateNotificationBadge();
  }

  function updateNotificationBadge() {
    if (!notifBadge) return;
    const readIds = JSON.parse(localStorage.getItem('revd_read_notifs') || '[]');
    const unreadCount = activeNotifications.filter(n => !readIds.includes(n.id)).length;
    if (unreadCount > 0) {
      notifBadge.style.display = 'inline-block';
      notifBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    } else {
      notifBadge.style.display = 'none';
    }
  }

  function renderNotificationList() {
    if (!notifModalList) return;
    const readIds = JSON.parse(localStorage.getItem('revd_read_notifs') || '[]');

    if (activeNotifications.length === 0) {
      notifModalList.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">
          Tidak ada pemberitahuan baru saat ini.
        </div>
      `;
      return;
    }

    notifModalList.innerHTML = activeNotifications.map(n => {
      const isRead = readIds.includes(n.id);
      return `
        <div class="neo-box" style="padding: 12px; background: ${isRead ? 'var(--surface-box)' : 'var(--bg-main)'}; border-left: ${isRead ? 'var(--border-thick)' : '4px solid #06b6d4'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span class="neo-badge ${n.badgeClass}" style="font-size: 0.65rem; padding: 1px 6px;">${n.tag}</span>
            <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 700;">${n.time}</span>
          </div>
          <div style="font-weight: 900; font-size: 0.85rem; color: var(--text-main); margin-bottom: 3px;">${escapeHtml(n.title)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">${escapeHtml(n.desc)}</div>
        </div>
      `;
    }).join('');
  }

  function openNotificationModal() {
    buildNotifications();
    renderNotificationList();
    if (notificationModalOverlay) notificationModalOverlay.classList.add('active');
  }

  function closeNotificationModal() {
    if (notificationModalOverlay) notificationModalOverlay.classList.remove('active');
  }

  if (btnNotificationBell) {
    btnNotificationBell.addEventListener('click', openNotificationModal);
  }
  if (notifModalClose) {
    notifModalClose.addEventListener('click', closeNotificationModal);
  }
  if (btnNotifCloseBottom) {
    btnNotifCloseBottom.addEventListener('click', closeNotificationModal);
  }
  if (notificationModalOverlay) {
    notificationModalOverlay.addEventListener('click', (e) => {
      if (e.target === notificationModalOverlay) closeNotificationModal();
    });
  }

  if (btnMarkAllRead) {
    btnMarkAllRead.addEventListener('click', () => {
      const allIds = activeNotifications.map(n => n.id);
      localStorage.setItem('revd_read_notifs', JSON.stringify(allIds));
      updateNotificationBadge();
      renderNotificationList();
      showToast('Semua notifikasi ditandai telah dibaca.', 'info');
    });
  }

  // Initial load
  loadSiteSettings();
  checkUserAuth();
  buildNotifications();
  const initialTab = getTabFromPath(window.location.pathname);
  if (window.history && window.history.replaceState) {
    window.history.replaceState({ tab: initialTab }, '', window.location.pathname);
  }
  if (initialTab !== 'catalog') {
    switchTab(initialTab, false);
    if (initialTab === 'developer') {
      dismissPreloader();
    }
    // Background preload katalog agar cache siap saat berpindah tab
    loadProducts();
  } else {
    loadProducts();
  }
})();
