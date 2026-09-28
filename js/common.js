// Shared helpers used by every page of the Dairy Milk Collection
// Management System. Depends on js/config.js (API_BASE_URL).

const AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'user';
const AUTH_ORG_KEY = 'organization';
const THEME_KEY = 'theme';
const FILTERS_KEY_PREFIX = 'filters:';

/* ------------------------------------------------------------------- theme */

// The light/dark choice is stored per browser in localStorage and applied by
// setting data-theme="dark" on <html>. Every page also carries a tiny inline
// snippet in <head> that applies the stored theme before first paint, so
// there is no white flash when reloading in dark mode. The public landing
// page intentionally stays in light mode.
function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme) {
  const effective = theme === 'dark' ? 'dark' : 'light';
  if (effective === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try {
    localStorage.setItem(THEME_KEY, effective);
  } catch {
    /* storage unavailable - theme applies for this page only */
  }
}

function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

const THEME_ICONS = {
  light:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  dark:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9l1.4 1.4"/><path d="M17.7 17.7l1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.9 19.1l1.4-1.4"/><path d="M17.7 6.3l1.4-1.4"/></svg>'
};

function renderThemeToggleButton() {
  const button = document.getElementById('themeToggleBtn');
  if (!button) return;
  const theme = getTheme();
  button.innerHTML = THEME_ICONS[theme];
  button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  button.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}

/* ------------------------------------------------------------------ session */

function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function getStoredOrganization() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_ORG_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveSession(token, user, organization) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user || {}));
  localStorage.setItem(AUTH_ORG_KEY, JSON.stringify(organization || {}));
}

function clearSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_ORG_KEY);
}

/* ------------------------------------------------- per-page filter persistence
   Each list/report page can store its current filter inputs under
   `filters:<pageKey>` so the user does not have to re-enter them after
   navigating away and coming back. Pages call saveFilters() when the
   form is submitted, and loadFilters() / applyStoredFilters() on init.
   Clearing the filters calls clearFilters() to wipe the entry. */

function saveFilters(pageKey, values) {
  try {
    localStorage.setItem(FILTERS_KEY_PREFIX + pageKey, JSON.stringify(values || {}));
  } catch {
    /* storage unavailable - filters apply for this page only */
  }
}

function loadFilters(pageKey) {
  try {
    return JSON.parse(localStorage.getItem(FILTERS_KEY_PREFIX + pageKey) || '{}');
  } catch {
    return {};
  }
}

function clearFilters(pageKey) {
  try {
    localStorage.removeItem(FILTERS_KEY_PREFIX + pageKey);
  } catch {
    /* storage unavailable */
  }
}

// Convenience: read every [data-filter-key] control inside the given form
// element and persist its current value (or empty string if blank).
function saveFormFilters(pageKey, formEl) {
  if (!formEl) return;
  const values = {};
  formEl.querySelectorAll('[data-filter-key]').forEach((control) => {
    values[control.getAttribute('data-filter-key')] = control.value || '';
  });
  saveFilters(pageKey, values);
}

// Reverse: restore values from localStorage into the form. Returns the
// applied values object so the caller can branch on which filters were
// restored (e.g. to decide whether to auto-submit).
function applyStoredFilters(pageKey, formEl) {
  if (!formEl) return {};
  const values = loadFilters(pageKey);
  formEl.querySelectorAll('[data-filter-key]').forEach((control) => {
    const key = control.getAttribute('data-filter-key');
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      control.value = values[key];
    }
  });
  return values;
}

// Protected pages call this on load. Sends the visitor to login.html when
// there is no JWT.
function requireAuth() {
  if (!getToken()) {
    window.location.replace('login.html');
    return false;
  }
  return true;
}

/* ---------------------------------------------------------------- api client */

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers.Authorization = 'Bearer ' + token;

  const response = await fetch(API_BASE_URL + path, { ...options, headers });

  if (response.status === 401) {
    clearSession();
    window.location.replace('login.html');
    throw new Error('Your session has expired. Please login again.');
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong. Please try again.');
  }
  return data;
}

// Downloads a protected file (PDF/Excel) by fetching it with the JWT and
// triggering a browser download from the returned blob.
async function apiDownload(path, fallbackFilename) {
  const token = getToken();
  const response = await fetch(API_BASE_URL + path, {
    headers: token ? { Authorization: 'Bearer ' + token } : {}
  });

  if (response.status === 401) {
    clearSession();
    window.location.replace('login.html');
    throw new Error('Your session has expired. Please login again.');
  }

  if (!response.ok) {
    let message = 'Download failed. Please try again.';
    try {
      const data = await response.json();
      if (data.message) message = data.message;
    } catch {
      /* binary or empty body */
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : fallbackFilename;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------- formatters */

function fmtAmount(value) {
  return '\u20B9' + Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtNumber(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  });
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return String(d).padStart(2, '0') + ' ' + MONTHS_SHORT[m - 1] + ' ' + y;
}

function todayISO() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
}

function monthStartISO() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    '01'
  ].join('-');
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* -------------------------------------------------------------------- toasts */

let toastTimer = null;

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  while (container.firstChild) container.removeChild(container.firstChild);

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.setAttribute('role', 'status');
  toast.innerHTML =
    '<span class="toast-dot"></span><span class="toast-message">' + escapeHtml(message) + '</span>';
  container.appendChild(toast);

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (container.firstChild) container.removeChild(container.firstChild);
  }, 3800);
}

/* -------------------------------------------------------------- app shell UI */

const NAV_ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  farmers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
  collection: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.7s6 6.3 6 10.8a6 6 0 1 1-12 0C6 9 12 2.7 12 2.7z"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  rates: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.3l-7.2 7.2a2 2 0 0 1-2.8 0L3 12.9V3h9.9l7.7 7.7a2 2 0 0 1 0 2.6z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
  statement: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/><circle cx="12" cy="8" r="8"/></svg>'
};

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html' },
  { key: 'farmers', label: 'Farmers', href: 'farmers.html' },
  { key: 'collection', label: 'Collection', href: 'collection.html' },
  { key: 'history', label: 'History', href: 'history.html' },
  { key: 'rates', label: 'Rates', href: 'rates.html' },
  { key: 'reports', label: 'Reports', href: 'reports.html' },
  { key: 'statement', label: 'Statement', href: 'statement.html' },
  { key: 'profile', label: 'Profile', href: 'profile.html' }
];

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  farmers: 'Farmers',
  collection: 'Record Milk Collection',
  history: 'Collection History',
  rates: 'Milk Rates',
  reports: 'Reports',
  statement: 'Farmer Statement',
  profile: 'My Profile'
};

// Renders the shared sidebar + topbar and wires the mobile menu and logout
// button. Each protected page calls initShell('its-nav-key') on load.
function initShell(activeKey) {
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  if (!sidebar || !topbar) return;

  const user = getStoredUser() || {};
  const organization = getStoredOrganization() || {};

  const navLinks = NAV_ITEMS.map((item) =>
    '<a href="' + item.href + '" class="sidebar-link' + (item.key === activeKey ? ' active' : '') + '">' +
    '<span class="sidebar-icon">' + (NAV_ICONS[item.key] || '') + '</span>' +
    '<span>' + item.label + '</span></a>'
  ).join('');

  sidebar.innerHTML =
    '<div class="sidebar-brand">' +
    '<span class="brand-mark">' + NAV_ICONS.collection + '</span>' +
    '<span class="brand-text">Dairy Milk Collection<span>Management System</span></span>' +
    '</div>' +
    '<nav class="sidebar-nav" aria-label="Application navigation">' + navLinks + '</nav>' +
    '<div class="sidebar-footer">' +
    '<button type="button" class="sidebar-logout" id="sidebarLogoutBtn">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>' +
    '<span>Logout</span></button>' +
    '</div>';

  topbar.innerHTML =
    '<button type="button" class="topbar-menu" id="menuBtn" aria-label="Open menu">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>' +
    '</button>' +
    '<div class="topbar-title"><h1>' + (PAGE_TITLES[activeKey] || 'Dashboard') + '</h1>' +
    '<p class="topbar-sub">' + escapeHtml(organization.dairyName || '') + '</p></div>' +
    '<div class="topbar-user">' +
    '<button type="button" class="theme-toggle" id="themeToggleBtn" aria-label="Toggle theme"></button>' +
    '<span class="topbar-avatar">' + escapeHtml((user.name || 'D').charAt(0).toUpperCase()) + '</span>' +
    '<span class="topbar-username">' + escapeHtml(user.name || 'Dairy Operator') + '</span>' +
    '</div>';

  // Theme toggle: reflects the current theme and switches on click.
  applyTheme(getTheme());
  renderThemeToggleButton();
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      toggleTheme();
      renderThemeToggleButton();
    });
  }

  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  document.addEventListener('click', (event) => {
    if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && event.target !== menuBtn && !menuBtn.contains(event.target)) {
      sidebar.classList.remove('open');
    }
  });

  const logoutBtn = document.getElementById('sidebarLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', openLogoutConfirmModal);
  }

  // Inject the shared logout confirmation modal once per page render.
  // Localised so each page can override strings, but the structure is fixed:
  // header with title + close X, body with a friendly message, footer with
  // Cancel + Confirm Logout buttons.
  if (!document.getElementById('logoutConfirmModal')) {
    const modal = document.createElement('div');
    modal.className = 'modal hidden';
    modal.id = 'logoutConfirmModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'logoutConfirmTitle');
    modal.innerHTML =
      '<div class="modal-card" style="max-width:420px;">' +
      '<div class="modal-header"><h3 id="logoutConfirmTitle">Confirm Logout</h3>' +
      '<button type="button" class="modal-close" id="logoutConfirmClose" aria-label="Close">&times;</button></div>' +
      '<div class="modal-body"><p class="dialog-text">Are you sure you want to log out of the Dairy Milk Collection Management System?</p></div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-ghost" id="logoutConfirmCancel">Cancel</button>' +
      '<button type="button" class="btn btn-danger" id="logoutConfirmOk">Logout</button>' +
      '</div></div>';
    document.body.appendChild(modal);

    const closeBtn = document.getElementById('logoutConfirmClose');
    const cancelBtn = document.getElementById('logoutConfirmCancel');
    const okBtn = document.getElementById('logoutConfirmOk');
    if (closeBtn) closeBtn.addEventListener('click', closeLogoutConfirmModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeLogoutConfirmModal);
    if (okBtn) okBtn.addEventListener('click', handleLogout);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeLogoutConfirmModal();
    });
  }

  // Global ESC handler: closes any open modal that follows the standard
  // .modal pattern. Wired once on document (idempotent guard).
  if (!window.__dairyEscWired) {
    window.__dairyEscWired = true;
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const openModal = Array.from(document.querySelectorAll('.modal:not(.hidden)'))[0];
      if (!openModal) return;
      // Prefer a dedicated close button, fall back to any modal-close button.
      const dedicated = openModal.querySelector('[id$="ModalClose"], [id$="ConfirmClose"], [id$="ConfirmCancel"]');
      const closeBtn = dedicated || openModal.querySelector('.modal-close');
      if (closeBtn instanceof HTMLElement) closeBtn.click();
      else openModal.classList.add('hidden');
    });
  }
}

function openLogoutConfirmModal() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) {
    modal.classList.remove('hidden');
    // Move focus to the Logout button so keyboard users can confirm with Enter
    // or cancel with Esc (handled by the global listener).
    const okBtn = document.getElementById('logoutConfirmOk');
    if (okBtn instanceof HTMLElement) okBtn.focus();
  }
}

function closeLogoutConfirmModal() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.classList.add('hidden');
}

async function handleLogout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Logout proceeds even if the API call fails.
  }
  clearSession();
  window.location.href = 'login.html';
}

/* ------------------------------------------------------------------ loading */

// Disables a button and shows a spinner while an async action runs.
async function withButtonLoading(button, asyncAction) {
  if (!button) return asyncAction();
  const originalHtml = button.innerHTML;
  button.disabled = true;
  button.classList.add('is-loading');
  button.innerHTML = '<span class="btn-spinner"></span> Please wait...';
  try {
    return await asyncAction();
  } finally {
    button.disabled = false;
    button.classList.remove('is-loading');
    button.innerHTML = originalHtml;
  }
}
