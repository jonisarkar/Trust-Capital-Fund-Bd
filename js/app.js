// app.js — Router, sidebar, toast, theme, utilities
// ============================================================

const App = (() => {

  // ---- TOAST ----
  function toast(msg, type = 'info', duration = 3500) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  }

  // ---- MODAL ----
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
  }
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'));
    document.body.style.overflow = '';
  }

  // ---- CONFIRM DIALOG ----
  function confirm(title, message, onConfirm, danger = true) {
    const overlay = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const confirmBtn = document.getElementById('confirm-ok');
    confirmBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
    confirmBtn.textContent = danger ? 'Delete' : 'Confirm';
    const clone = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(clone, confirmBtn);
    clone.addEventListener('click', () => { closeModal('confirm-modal'); onConfirm(); });
    openModal('confirm-modal');
  }

  // ---- ROUTER ----
  const pages = {};
  let currentPage = '';

  function registerPage(name, initFn) { pages[name] = initFn; }

  async function navigate(page) {
    if (currentPage === page) {
      // Still re-run init to refresh data on repeat clicks
      if (pages[page]) await pages[page]();
      return;
    }
    // update nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    // switch section
    document.querySelectorAll('.page-section').forEach(el => {
      el.classList.toggle('active', el.id === `page-${page}`);
    });
    currentPage = page;
    // init page
    if (pages[page]) await pages[page]();
    // update header title
    const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (activeNav) {
      const icon = activeNav.querySelector('.nav-icon')?.textContent || '';
      const label = activeNav.querySelector('.nav-label')?.textContent || '';
      document.getElementById('page-title').textContent = `${icon} ${label}`;
    }
    history.pushState({page}, '', `#${page}`);
  }

  // ---- SIDEBAR TOGGLE ----
  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('main-content');
    const toggle  = document.getElementById('sidebar-toggle');
    const menuToggle = document.getElementById('menu-toggle');
    const backdrop   = document.getElementById('sidebar-backdrop');

    if (!sidebar || !content) return;

    // Desktop Toggle (Collapsed/Expanded)
    toggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = sidebar.classList.toggle('collapsed');
      content.classList.toggle('sidebar-collapsed', isCollapsed);
      localStorage.setItem('sidebar_collapsed', isCollapsed);
    });

    // Mobile Toggle (Open/Close Drawer)
    const toggleMobileMenu = (forceState) => {
      const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('mobile-open');
      sidebar.classList.toggle('mobile-open', isOpen);
      backdrop?.classList.toggle('active', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    menuToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileMenu();
    });

    backdrop?.addEventListener('click', () => toggleMobileMenu(false));

    // Restore Desktop State
    const wasCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (wasCollapsed && window.innerWidth > 1024) {
      sidebar.classList.add('collapsed');
      content.classList.add('sidebar-collapsed');
    }

    // Nav Item Clicks (Event Delegation for reliability)
    sidebar?.addEventListener('click', (e) => {
      const el = e.target.closest('.nav-item[data-page]');
      if (!el) return;
      
      const page = el.dataset.page;
      if (page) {
        navigate(page);
        if (window.innerWidth <= 1024) {
          toggleMobileMenu(false);
        }
      }
    });

    // Requested Fix 4: Touch events on sidebar items
    sidebar?.addEventListener('touchend', (e) => {
      const item = e.target.closest('.nav-item, .sidebar a, .sidebar button');
      if (item) {
        e.stopPropagation();
        item.click();
      }
    });

    // Sidebar item-এ touch করলে যেন dim না হয় (Requested Fix)
    sidebar?.addEventListener('touchstart', (e) => {
      const item = e.target.closest('.nav-item, .sidebar a, .sidebar button');
      if (item) {
        e.stopPropagation(); // Overlay-এ touch যেতে দেবে না
      }
    }, { passive: true });

    // Requested Fix 2: Prevent overlay from blocking sidebar touches
    backdrop?.addEventListener('touchend', (e) => {
      e.stopPropagation();
      toggleMobileMenu(false);
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        toggleMobileMenu(false);
        // Ensure desktop state is applied correctly when scaling up
        const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
        sidebar.classList.toggle('collapsed', isCollapsed);
        content.classList.toggle('sidebar-collapsed', isCollapsed);
      } else {
        // Remove desktop classes on mobile to prevent layout issues
        sidebar.classList.remove('collapsed');
        content.classList.remove('sidebar-collapsed');
      }
    });
  }

  // ---- THEME ----
  async function initTheme() {
    const saved = await DB.getSetting('theme', 'dark');
    applyTheme(saved);
  }
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  async function toggleTheme() {
    const current = document.documentElement.dataset.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    await DB.setSetting('theme', next);
  }

  // ---- UTILS ----
  function formatCurrency(n) {
    return '৳ ' + (n || 0).toLocaleString('en-BD', { minimumFractionDigits: 0 });
  }
  function formatDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }
    catch { return d; }
  }
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function monthName(m) { return MONTH_NAMES[(m-1)] || m; }

  // ---- PAGE HEADER ACTIONS ----
  function initHeaderActions() {
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    document.getElementById('logout-btn')?.addEventListener('click', Auth.logout);
  }

  // ---- SLIDE-OVER ----
  function openSlideOver() {
    document.getElementById('slide-over-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeSlideOver() {
    document.getElementById('slide-over-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ---- INIT ----
  async function init() {
    // Safety: always hide loader after 6s no matter what
    const loader = document.getElementById('loading-overlay');
    const safetyTimer = setTimeout(() => {
      loader?.classList.add('hidden');
      setTimeout(() => loader?.remove(), 500);
    }, 6000);

    try {
      await DB.initSettings();
      await Auth.init();
      initSidebar();
      await initTheme();
      initHeaderActions();

      // close modals on overlay click (except those with forms to prevent data loss)
      document.addEventListener('click', e => {
        if (e.target.classList.contains('modal-overlay')) {
          // Do not close if the modal has a form inside (like Member Modal)
          if (e.target.querySelector('form')) return;
          closeAllModals();
        }
      });
      document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => closeAllModals());
      });
      document.getElementById('slide-over-overlay')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeSlideOver();
      });
      document.getElementById('slide-over-close')?.addEventListener('click', closeSlideOver);

      // handle back/forward
      window.addEventListener('popstate', e => {
        if (e.state?.page) navigate(e.state.page);
      });

      // Determine start page
      const hash = location.hash.replace('#','') || 'dashboard';
      await navigate(hash);
    } catch(err) {
      console.error('App init error:', err);
    } finally {
      clearTimeout(safetyTimer);
      // Hide loading
      loader?.classList.add('hidden');
      setTimeout(() => loader?.remove(), 500);
    }
  }

  return {
    init, navigate, registerPage,
    toast, openModal, closeModal, closeAllModals, confirm,
    openSlideOver, closeSlideOver,
    formatCurrency, formatDate, monthName, MONTH_NAMES,
    applyTheme, toggleTheme
  };
})();
