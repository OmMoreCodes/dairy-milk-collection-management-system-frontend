// Shared helpers used by every page of the Dairy Milk Collection
// Management System. Depends on js/config.js (API_BASE_URL).

const AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'user';
const AUTH_ORG_KEY = 'organization';

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
  statement: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>'
};

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html' },
  { key: 'farmers', label: 'Farmers', href: 'farmers.html' },
  { key: 'collection', label: 'Collection', href: 'collection.html' },
  { key: 'history', label: 'History', href: 'history.html' },
  { key: 'rates', label: 'Rates', href: 'rates.html' },
  { key: 'reports', label: 'Reports', href: 'reports.html' },
  { key: 'statement', label: 'Statement', href: 'statement.html' }
];

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  farmers: 'Farmers',
  collection: 'Record Milk Collection',
  history: 'Collection History',
  rates: 'Milk Rates',
  reports: 'Reports',
  statement: 'Farmer Statement'
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
    '<span class="topbar-avatar">' + escapeHtml((user.name || 'D').charAt(0).toUpperCase()) + '</span>' +
    '<span class="topbar-username">' + escapeHtml(user.name || 'Dairy Operator') + '</span>' +
    '</div>';

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
    logoutBtn.addEventListener('click', handleLogout);
  }
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
