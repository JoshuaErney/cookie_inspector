document.addEventListener('DOMContentLoaded', async () => {

  const cookieList            = document.getElementById('cookieList');
  const searchInput           = document.getElementById('searchInput');
  const statsDisplay          = document.getElementById('stats');
  const exportBtn             = document.getElementById('exportBtn');
  const importBtn             = document.getElementById('importBtn');
  const importFile            = document.getElementById('importFile');
  const themeToggle           = document.getElementById('themeToggle');
  const iconContainer         = document.getElementById('themeIconContainer');
  const saveSnapshotBtn       = document.getElementById('saveSnapshot');
  const settingsToggle        = document.getElementById('settingsToggle');
  const settingsIconContainer = document.getElementById('settingsIconContainer');
  const createToggle          = document.getElementById('createToggle');
  const createIconContainer   = document.getElementById('createIconContainer');
  const appContainer          = document.querySelector('.app-container');

  let allCookies    = [];
  let currentSort   = 'domain';
  let currentFilter = 'all';
  let pinnedDomains = new Set();
  let renderedCookies = [];            // cookies in the order last rendered; rows refer to them by index
  let renderedDomains = [];            // domain groups in the order last rendered
  const expandedKeys  = new Set();     // cookieKey()s whose detail panel is open
  const editOriginals = new WeakMap(); // edit form element -> the cookie being edited

  // Icons
  const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  const chevronIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  const gearIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
  const plusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  const pinIcon  = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`;

  settingsIconContainer.innerHTML = gearIcon;
  createIconContainer.innerHTML   = plusIcon;


  // Helpers

  // Always https: it can set, overwrite and remove both Secure and non-Secure cookies,
  // whereas an http:// URL cannot touch a Secure cookie.
  const getCookieUrl = (cookie) => {
    const host = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
    return `https://${host}${cookie.path || '/'}`;
  };

  const getRelativeTime = (expiry) => {
    if (!expiry) return 'Session';
    const diff = expiry - Math.floor(Date.now() / 1000);
    if (diff < 0) return 'Expired';
    const hours = Math.floor(diff / 3600);
    const days  = Math.floor(hours / 24);
    if (days > 0)  return `Expires in ${days}d`;
    if (hours > 0) return `Expires in ${hours}h`;
    return 'Expires soon';
  };

  // Decoding for the detail panel: JSON, JWT, URL-encoded, and Base64/Base64url (UTF-8).

  const printableRatio = (s) => {
    if (!s.length) return 0;
    let printable = 0;
    for (const ch of s) if (/[\x20-\x7E\t\n\r]/.test(ch)) printable++;
    return printable / [...s].length;
  };

  // Base64 or Base64url -> UTF-8 text, or null if the input isn't valid base64 text.
  const base64ToText = (input, minLength = 12) => {
    if (typeof input !== 'string') return null;
    const s = input.trim();
    if (s.length < minLength || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(s)) return null;
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    if (b64.length % 4 === 1) return null;
    try {
      const bin   = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      const text  = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text) ? null : text;
    } catch (e) {
      return null;
    }
  };

  // Pretty-prints JSON objects/arrays only; bare numbers, booleans and null are not worth labelling.
  const asJson = (s) => {
    try {
      const parsed = JSON.parse(s);
      return parsed !== null && typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : null;
    } catch (e) {
      return null;
    }
  };

  const decodeJwt = (value) => {
    const parts = value.split('.');
    if (parts.length !== 3 || !parts[0].startsWith('eyJ')) return null;
    try {
      const header  = JSON.parse(base64ToText(parts[0], 2));
      const payload = JSON.parse(base64ToText(parts[1], 2));
      if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') return null;
      const lines = [JSON.stringify({ header, payload }, null, 2), ''];
      for (const claim of ['iat', 'nbf', 'exp']) {
        if (typeof payload[claim] === 'number') lines.push(`${claim}: ${new Date(payload[claim] * 1000).toLocaleString()}`);
      }
      lines.push('(signature not verified)');
      return lines.join('\n');
    } catch (e) {
      return null;
    }
  };

  const tryDecode = (value) => {
    if (!value) return null;

    const json = asJson(value);
    if (json) return { type: 'JSON', data: json };

    const jwt = decodeJwt(value);
    if (jwt) return { type: 'JWT', data: jwt };

    if (/%[0-9A-Fa-f]{2}/.test(value)) {
      try {
        const decoded = decodeURIComponent(value);
        const inner   = asJson(decoded);
        return { type: inner ? 'URL-encoded JSON' : 'URL-encoded', data: inner ?? decoded };
      } catch (e) {}
    }

    const text = base64ToText(value);
    if (text !== null) {
      const inner = asJson(text);
      if (inner) return { type: 'Base64 JSON', data: inner };
      if (printableRatio(text) >= 0.7) return { type: 'Base64', data: text };
    }
    return null;
  };

  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  const escHtml = (str) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // Converts a unix timestamp to a datetime-local input value (local time)
  const toDatetimeLocal = (unixSeconds) => {
    const d   = new Date(unixSeconds * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const readForm = (container) => ({
    name:     container.querySelector('.form-name').value.trim(),
    value:    container.querySelector('.form-value').value,
    domain:   container.querySelector('.form-domain').value.trim(),
    path:     container.querySelector('.form-path').value.trim() || '/',
    expires:  container.querySelector('.form-expires').value,
    sameSite: container.querySelector('.form-samesite').value,
    secure:   container.querySelector('.form-secure').checked,
    httpOnly: container.querySelector('.form-httponly').checked,
  });

  let toastTimer;
  const showToast = (message, type = 'success') => {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type} visible`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
  };


  // Theme

  const updateThemeUI = (isDark) => {
    document.body.classList.toggle('dark-mode', isDark);
    if (iconContainer) iconContainer.innerHTML = isDark ? sunIcon : moonIcon;
  };

  chrome.storage.local.get(['theme'], (result) => {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    updateThemeUI(result.theme === 'dark' || (!result.theme && systemDark));
  });

  themeToggle.addEventListener('click', () => {
    const isNowDark = !document.body.classList.contains('dark-mode');
    chrome.storage.local.set({ theme: isNowDark ? 'dark' : 'light' });
    updateThemeUI(isNowDark);
  });


  // Cookie helpers

  // Cookie identity: name + domain + path (+ partition for CHIPS cookies).
  const cookieKey = (c) =>
    [c.partitionKey?.topLevelSite ?? '', c.domain, c.path, c.name].join('\u0000');

  const SAME_SITE = {
    no_restriction: 'no_restriction', none: 'no_restriction',
    lax: 'lax', strict: 'strict', unspecified: 'unspecified',
  };
  const normalizeSameSite = (value, fallback = 'unspecified') =>
    SAME_SITE[String(value ?? '').toLowerCase()] ?? fallback;

  // Builds chrome.cookies.set() details from a cookie-like object.
  // `domain` is only sent for domain cookies (leading dot). Sending it for a host-only
  // cookie silently turns it into a domain cookie and leaves the original behind.
  const toSetDetails = (c, { sameSiteFallback = 'unspecified' } = {}) => {
    if (!c || typeof c.name !== 'string' || !c.name) throw new Error('Cookie has no name');
    if (typeof c.domain !== 'string' || !c.domain)   throw new Error(`Cookie "${c.name}" has no domain`);
    const details = {
      url:      getCookieUrl(c),
      name:     c.name,
      value:    c.value == null ? '' : String(c.value),
      path:     c.path || '/',
      secure:   Boolean(c.secure),
      httpOnly: Boolean(c.httpOnly),
      sameSite: normalizeSameSite(c.sameSite, sameSiteFallback),
    };
    if (c.domain.startsWith('.')) details.domain = c.domain;
    if (c.expirationDate)         details.expirationDate = Number(c.expirationDate);
    if (c.partitionKey)           details.partitionKey = c.partitionKey;
    return details;
  };

  const toRemoveDetails = (c) => {
    const details = { url: getCookieUrl(c), name: c.name };
    if (c.partitionKey) details.partitionKey = c.partitionKey;
    return details;
  };

  // Catches the usual reasons Chrome rejects a cookie, with a message that says why.
  const validateCookie = ({ name, domain, path, secure, sameSite }) => {
    if (!name)   return 'Name is required';
    if (!domain) return 'Domain is required';
    if (/\s/.test(domain) || /[/:?#@]/.test(domain)) return 'Domain must be a hostname like example.com or .example.com';
    if (!String(path).startsWith('/')) return 'Path must start with /';
    if (sameSite === 'no_restriction' && !secure) return 'SameSite=None requires the Secure flag';
    if (name.startsWith('__Secure-') && !secure)  return '__Secure- cookies require the Secure flag';
    if (name.startsWith('__Host-')) {
      if (!secure)                 return '__Host- cookies require the Secure flag';
      if (domain.startsWith('.'))  return '__Host- cookies must be host-only (no leading dot)';
      if (path !== '/')            return '__Host- cookies must use Path=/';
    }
    return null;
  };

  // Sets many cookies without stopping at the first failure.
  const setCookies = async (cookies, options) => {
    const results  = await Promise.allSettled(cookies.map(async (c) => chrome.cookies.set(toSetDetails(c, options))));
    const rejected = results.filter((r) => r.status === 'rejected');
    return {
      ok:         results.length - rejected.length,
      failed:     rejected.length,
      firstError: rejected[0]?.reason?.message ?? null,
    };
  };

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const reportResult = ({ ok, failed, firstError }, doneText, failText) => {
    const total = ok + failed;
    if (failed === 0) return showToast(doneText(ok));
    if (ok === 0) {
      return showToast(
        total === 1 && firstError ? `${failText} — ${firstError}` : `${failText} — ${plural(total, 'cookie')} rejected by the browser`,
        'error'
      );
    }
    showToast(`${doneText(ok)}, but ${failed} ${failed === 1 ? 'was' : 'were'} rejected`, 'error');
  };

  // getAll({}) leaves out partitioned (CHIPS) cookies; they have to be requested separately.
  const loadAllCookies = async () => {
    const [plain, partitioned] = await Promise.all([
      chrome.cookies.getAll({}),
      chrome.cookies.getAll({ partitionKey: {} }).catch(() => []),
    ]);
    const byKey = new Map();
    [...plain, ...partitioned].forEach((c) => byKey.set(cookieKey(c), c));
    return [...byKey.values()];
  };

  const refreshCookies = async () => {
    allCookies = await loadAllCookies();
    render();
  };

  // Only the fields needed to recreate a cookie, so snapshots stay well under the storage quota.
  const slimCookie = (c) => {
    const slim = {
      name: c.name, value: c.value, domain: c.domain, path: c.path,
      secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
    };
    if (c.expirationDate) slim.expirationDate = c.expirationDate;
    if (c.partitionKey)   slim.partitionKey = c.partitionKey;
    return slim;
  };


  // Snapshots

  const renderSnapshots = async () => {
    const { cookie_snapshots: snapshots = [] } = await chrome.storage.local.get(['cookie_snapshots']);
    const list       = document.getElementById('snapshotList');
    const saveBtn    = document.getElementById('saveSnapshot');
    const countBadge = document.getElementById('snapshotCount');

    if (countBadge) countBadge.textContent = `${snapshots.length} / 10`;
    if (saveBtn)    saveBtn.disabled = snapshots.length >= 10;

    if (snapshots.length === 0) {
      list.innerHTML = '<div class="snapshot-empty">No snapshots saved yet</div>';
      return;
    }

    list.innerHTML = snapshots.map((s, i) => {
      const label = s.label || `Snapshot ${snapshots.length - i}`;
      return `
        <div class="snapshot-item">
          <div class="snapshot-info">
            <span class="snapshot-label">${escHtml(label)}</span>
            <span class="snapshot-cookie-count">${new Date(s.date).toLocaleString()} · ${s.cookies.length} cookies</span>
          </div>
          <div class="snapshot-actions">
            <button class="btn-restore-snap" data-id="${s.id}">Restore</button>
            <button class="btn-delete-snap" data-id="${s.id}">Delete</button>
          </div>
        </div>`;
    }).join('');
  };

  const closeAllPanels = () => {
    appContainer.classList.remove('settings-open', 'create-open');
    settingsToggle.classList.remove('active');
    createToggle.classList.remove('active');
  };

  settingsToggle.addEventListener('click', () => {
    const wasOpen = appContainer.classList.contains('settings-open');
    closeAllPanels();
    if (!wasOpen) {
      appContainer.classList.add('settings-open');
      settingsToggle.classList.add('active');
      renderSnapshots();
    }
  });

  document.getElementById('snapshotList').addEventListener('click', async (e) => {
    const restoreBtn = e.target.closest('.btn-restore-snap');
    const deleteBtn  = e.target.closest('.btn-delete-snap');

    if (restoreBtn) {
      const id = Number(restoreBtn.dataset.id);
      const { cookie_snapshots: snapshots = [] } = await chrome.storage.local.get(['cookie_snapshots']);
      const snapshot = snapshots.find(s => s.id === id);
      if (!snapshot) return showToast('Snapshot not found', 'error');
      const result = await setCookies(snapshot.cookies);
      await refreshCookies();
      reportResult(result, n => `Restored ${plural(n, 'cookie')}`, 'Restore failed');
    }

    if (deleteBtn) {
      const id = Number(deleteBtn.dataset.id);
      const { cookie_snapshots: snapshots = [] } = await chrome.storage.local.get(['cookie_snapshots']);
      await chrome.storage.local.set({ cookie_snapshots: snapshots.filter(s => s.id !== id) });
      renderSnapshots();
      showToast('Snapshot deleted');
    }
  });


  // Cookie Form (shared by create and edit)

  const cookieFormHTML = (cookie = null) => {
    const isEdit       = cookie !== null;
    const expiresValue = cookie?.expirationDate ? toDatetimeLocal(cookie.expirationDate) : '';

    const sameSiteOption = (val, label) =>
      `<option value="${val}" ${(cookie?.sameSite ?? 'lax') === val ? 'selected' : ''}>${label}</option>`;

    return `
      <div class="${isEdit ? 'cookie-edit-form' : 'cookie-create-form'}">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input class="form-input form-name" type="text" value="${escHtml(cookie?.name ?? '')}" placeholder="cookie_name" />
        </div>
        <div class="form-group">
          <label class="form-label">Value</label>
          <textarea class="form-textarea form-value" placeholder="cookie value">${escHtml(cookie?.value ?? '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Domain</label>
          <input class="form-input form-domain" type="text" value="${escHtml(cookie?.domain ?? '')}" placeholder=".example.com" />
          <span class="form-hint">Start with a dot (.example.com) to include subdomains; without it the cookie is host-only</span>
        </div>
        <div class="form-group">
          <label class="form-label">Path</label>
          <input class="form-input form-path" type="text" value="${escHtml(cookie?.path ?? '/')}" placeholder="/" />
        </div>
        <div class="form-group">
          <label class="form-label">Expires</label>
          <input class="form-input form-expires" type="datetime-local" value="${expiresValue}" />
          <span class="form-hint">Leave blank for a session cookie</span>
        </div>
        <div class="form-group">
          <label class="form-label">SameSite</label>
          <select class="form-select form-samesite">
            ${sameSiteOption('lax', 'Lax')}
            ${sameSiteOption('strict', 'Strict')}
            ${sameSiteOption('no_restriction', 'None')}
            ${sameSiteOption('unspecified', 'Unspecified')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Flags</label>
          <div class="form-toggles">
            <label class="form-toggle">
              <input type="checkbox" class="form-secure" ${cookie?.secure ? 'checked' : ''} /> Secure
            </label>
            <label class="form-toggle">
              <input type="checkbox" class="form-httponly" ${cookie?.httpOnly ? 'checked' : ''} /> HttpOnly
            </label>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn-primary ${isEdit ? 'btn-save-edit' : 'btn-create-cookie'}">
            ${isEdit ? 'Save Changes' : 'Create Cookie'}
          </button>
          <button class="btn-secondary ${isEdit ? 'btn-cancel-edit' : 'btn-cancel-create'}">Cancel</button>
        </div>
      </div>`;
  };


  // Create Panel

  const pasteFormHTML = () => `
    <div class="cookie-create-form">
      <div class="form-group">
        <label class="form-label">Cookie JSON or Base64</label>
        <textarea class="form-textarea paste-input" placeholder='{ "name": "session_id", "domain": ".example.com", "value": "abc123", ... }'></textarea>
        <span class="form-hint">Paste a cookie object, an array of cookies, or Base64-encoded JSON. Arrays create multiple cookies at once and match the export format.</span>
      </div>
      <div class="form-actions">
        <button class="btn-primary btn-paste-create">Create Cookie(s)</button>
        <button class="btn-secondary btn-cancel-create">Cancel</button>
      </div>
    </div>`;

  createToggle.addEventListener('click', () => {
    const wasOpen = appContainer.classList.contains('create-open');
    closeAllPanels();
    if (!wasOpen) {
      appContainer.classList.add('create-open');
      createToggle.classList.add('active');
      document.getElementById('createPanel').innerHTML = `
        <div class="panel-title">New Cookie</div>
        <div class="panel-tabs">
          <button class="tab-btn active" data-tab="manual">Manual</button>
          <button class="tab-btn" data-tab="paste">JSON / Base64</button>
        </div>
        <div class="tab-content tab-manual">${cookieFormHTML(null)}</div>
        <div class="tab-content tab-paste" style="display:none">${pasteFormHTML()}</div>`;
    }
  });

  // Turns the values read from the cookie form into a cookie object (expires -> expirationDate)
  const formToCookie = (form, extra = {}) => ({
    ...form,
    expirationDate: form.expires ? new Date(form.expires).getTime() / 1000 : undefined,
    ...extra,
  });

  document.getElementById('createPanel').addEventListener('click', async (e) => {
    const panel = document.getElementById('createPanel');

    if (e.target.classList.contains('tab-btn')) {
      const tab = e.target.dataset.tab;
      panel.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      panel.querySelectorAll('.tab-content').forEach(c => {
        c.style.display = c.classList.contains(`tab-${tab}`) ? 'flex' : 'none';
      });
      return;
    }

    if (e.target.classList.contains('btn-create-cookie')) {
      const form    = readForm(panel.querySelector('.tab-manual'));
      const problem = validateCookie(form);
      if (problem) return showToast(problem, 'error');

      try {
        await chrome.cookies.set(toSetDetails(formToCookie(form)));
        await refreshCookies();
        closeAllPanels();
        showToast(`Cookie "${form.name}" created`);
      } catch (err) {
        showToast(`Failed to create — ${err.message}`, 'error');
      }
    }

    if (e.target.classList.contains('btn-paste-create')) {
      const raw = panel.querySelector('.paste-input').value.trim();
      if (!raw) return showToast('Nothing to parse', 'error');

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        try {
          parsed = JSON.parse(base64ToText(raw, 2));
        } catch (e2) {
          return showToast('Could not parse — invalid JSON or Base64', 'error');
        }
      }

      const cookies = Array.isArray(parsed) ? parsed : [parsed];
      if (cookies.some(c => !c || !c.name || !c.domain)) {
        return showToast('Each cookie must have a name and domain', 'error');
      }

      const result = await setCookies(cookies, { sameSiteFallback: 'lax' });
      await refreshCookies();
      if (result.ok > 0) closeAllPanels();
      reportResult(result, n => `Created ${plural(n, 'cookie')}`, 'Create failed');
    }

    if (e.target.classList.contains('btn-cancel-create')) {
      closeAllPanels();
    }
  });


  // Rendering
  //
  // Rows never carry cookie data in attributes: each row/group holds an index into
  // renderedCookies / renderedDomains, so names with quotes or markup can't break the HTML
  // and two cookies that differ only by path can't be confused.

  const cookieItemHTML = (cookie, duplicateNames, i) => {
    const decoded = tryDecode(cookie.value);
    const isOpen  = expandedKeys.has(cookieKey(cookie));
    const expires = cookie.expirationDate
      ? new Date(cookie.expirationDate * 1000).toLocaleString()
      : 'Session';

    return `
      <div class="cookie-item ${!cookie.httpOnly ? 'warning-bg' : ''}" data-i="${i}">
        <div class="cookie-main">
          <div class="cookie-info">
            <span class="cookie-name">${escHtml(cookie.name)}</span>
            <div class="security-labels">
              ${!cookie.httpOnly ? '<span class="label xss">No HttpOnly</span>' : ''}
              ${duplicateNames.has(cookie.name) ? '<span class="label duplicate">Duplicate</span>' : ''}
              ${cookie.partitionKey ? '<span class="label expiry">Partitioned</span>' : ''}
              <span class="label expiry">${getRelativeTime(cookie.expirationDate)}</span>
            </div>
          </div>
          <div class="cookie-actions">
            <button class="btn-expand ${isOpen ? 'expanded' : ''}">${chevronIcon}</button>
            <button class="btn-delete">Delete</button>
          </div>
        </div>
        <div class="cookie-detail" style="display:${isOpen ? 'block' : 'none'}">
          <div class="detail-field">
            <div class="detail-key">Value</div>
            <div class="detail-val">${escHtml(cookie.value) || '<em>(empty)</em>'}</div>
          </div>
          ${decoded ? `
          <div class="detail-field">
            <div class="detail-key">Decoded <span class="label expiry">${decoded.type}</span></div>
            <pre class="detail-pre">${escHtml(decoded.data)}</pre>
          </div>` : ''}
          <div class="detail-meta">
            <div class="meta-pair"><span>Path</span><span>${escHtml(cookie.path)}</span></div>
            <div class="meta-pair"><span>Secure</span><span>${cookie.secure ? 'Yes' : 'No'}</span></div>
            <div class="meta-pair"><span>HttpOnly</span><span>${cookie.httpOnly ? 'Yes' : 'No'}</span></div>
            <div class="meta-pair"><span>SameSite</span><span>${escHtml(cookie.sameSite) || '—'}</span></div>
            <div class="meta-pair"><span>Expires</span><span>${expires}</span></div>
            <div class="meta-pair"><span>Host Only</span><span>${cookie.hostOnly ? 'Yes' : 'No'}</span></div>
            ${cookie.partitionKey ? `<div class="meta-pair"><span>Partition</span><span>${escHtml(cookie.partitionKey.topLevelSite)}</span></div>` : ''}
          </div>
          <div class="detail-footer">
            <button class="btn-edit-cookie">Edit Cookie</button>
          </div>
        </div>
      </div>`;
  };

  const domainGroupHTML = (domain, g, cookies, duplicateNames) => {
    const isPinned = pinnedDomains.has(domain);
    return `
    <div class="domain-group">
      <div class="domain-header ${isPinned ? 'pinned' : ''}">
        <div class="domain-info">
          <span>${escHtml(domain)}</span>
          <span class="badge">${cookies.length}</span>
        </div>
        <div class="group-actions">
          <button class="btn-pin-domain ${isPinned ? 'pinned' : ''}" data-g="${g}" title="${isPinned ? 'Unpin domain' : 'Pin to top'}">${pinIcon}</button>
          <button class="btn-secondary btn-sessionize" data-g="${g}">Make Session-Only</button>
          <button class="btn-bulk-delete" data-g="${g}">Clear Domain</button>
        </div>
      </div>
      ${cookies.map(c => cookieItemHTML(c, duplicateNames, renderedCookies.push(c) - 1)).join('')}
    </div>`;
  };

  const render = (filterText = searchInput.value) => {
    const lowerFilter = filterText.toLowerCase();

    const domainsByName = {};
    allCookies.forEach(c => {
      if (!domainsByName[c.name]) domainsByName[c.name] = new Set();
      domainsByName[c.name].add(c.domain);
    });
    const duplicateNames = new Set(
      Object.entries(domainsByName)
        .filter(([, domains]) => domains.size > 1)
        .map(([name]) => name)
    );

    const searched = allCookies.filter(c =>
      c.domain.toLowerCase().includes(lowerFilter) ||
      c.name.toLowerCase().includes(lowerFilter) ||
      c.value.toLowerCase().includes(lowerFilter)
    );

    const filtered = searched.filter(c => {
      switch (currentFilter) {
        case 'session':     return !c.expirationDate;
        case 'no-httponly': return !c.httpOnly;
        case 'insecure':    return !c.secure;
        case 'duplicate':   return duplicateNames.has(c.name);
        default:            return true;
      }
    });

    const groups = filtered.reduce((acc, cookie) => {
      acc[cookie.domain] = acc[cookie.domain] || [];
      acc[cookie.domain].push(cookie);
      return acc;
    }, {});

    let groupEntries = Object.entries(groups);

    switch (currentSort) {
      case 'name':
        groupEntries.forEach(([, c]) => c.sort((a, b) => a.name.localeCompare(b.name)));
        groupEntries.sort(([a], [b]) => a.localeCompare(b));
        break;
      case 'expiry':
        groupEntries.forEach(([, c]) => c.sort((a, b) => {
          if (!a.expirationDate && !b.expirationDate) return 0;
          if (!a.expirationDate) return 1;
          if (!b.expirationDate) return -1;
          return a.expirationDate - b.expirationDate;
        }));
        groupEntries.sort(([, ac], [, bc]) => {
          const earliest = (arr) => Math.min(...arr.filter(c => c.expirationDate).map(c => c.expirationDate), Infinity);
          return earliest(ac) - earliest(bc);
        });
        break;
      case 'count':
        groupEntries.sort(([, ac], [, bc]) => bc.length - ac.length);
        break;
      case 'domain':
      default:
        groupEntries.sort(([a], [b]) => a.localeCompare(b));
        break;
    }

    renderedCookies = [];
    renderedDomains = [];

    if (filtered.length === 0) {
      const isSearch = filterText.length > 0 || currentFilter !== 'all';
      statsDisplay.textContent = isSearch ? 'No matching cookies' : 'No cookies found';
      cookieList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${isSearch ? '🔍' : '🍪'}</div>
          <div class="empty-title">${isSearch ? 'No results' : 'No cookies found'}</div>
          <div class="empty-body">${isSearch
            ? 'Try adjusting your search or filter.'
            : 'There are no cookies stored in your browser.'
          }</div>
        </div>`;
      return;
    }

    const pinned   = groupEntries.filter(([d]) =>  pinnedDomains.has(d));
    const unpinned = groupEntries.filter(([d]) => !pinnedDomains.has(d));
    groupEntries = [...pinned, ...unpinned];

    statsDisplay.textContent = `${filtered.length} cookies across ${groupEntries.length} domains`;
    cookieList.innerHTML = groupEntries
      .map(([d, c]) => domainGroupHTML(d, renderedDomains.push(d) - 1, c, duplicateNames))
      .join('');
  };

  // Cookie changes can arrive in bursts, and re-rendering would destroy an open edit form,
  // so renders triggered by changes are coalesced and held back while a form is open.
  const requestRender = () => {
    if (cookieList.querySelector('.cookie-edit-form')) return;
    render();
  };
  const scheduleRender = debounce(requestRender, 120);


  // Init

  const { pinned_domains: savedPins = [] } = await chrome.storage.local.get(['pinned_domains']);
  pinnedDomains = new Set(savedPins);

  allCookies = await loadAllCookies();
  render();


  // Events

  chrome.cookies.onChanged.addListener(({ cookie, removed }) => {
    const key = cookieKey(cookie);
    const idx = allCookies.findIndex(c => cookieKey(c) === key);
    if (removed) {
      if (idx >= 0) allCookies.splice(idx, 1);
    } else {
      if (idx >= 0) allCookies[idx] = cookie;
      else allCookies.push(cookie);
    }
    scheduleRender();
  });

  searchInput.addEventListener('input', debounce((e) => render(e.target.value), 250));

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    render();
  });

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      render();
    });
  });

  saveSnapshotBtn.addEventListener('click', async () => {
    const { cookie_snapshots: snapshots = [] } = await chrome.storage.local.get(['cookie_snapshots']);
    if (snapshots.length >= 10) return showToast('Maximum of 10 snapshots reached', 'error');
    const labelInput = document.getElementById('snapshotLabel');
    const label      = labelInput?.value.trim() || '';
    const updated    = [{ id: Date.now(), date: Date.now(), label, cookies: allCookies.map(slimCookie) }, ...snapshots];
    try {
      await chrome.storage.local.set({ cookie_snapshots: updated });
    } catch (err) {
      return showToast('Snapshot not saved — browser storage is full. Delete an older snapshot and try again.', 'error');
    }
    if (labelInput) labelInput.value = '';
    renderSnapshots();
    showToast('Snapshot saved');
  });

  cookieList.addEventListener('click', async (e) => {
    const target   = e.target;
    const row      = target.closest('.cookie-item');
    const cookie   = row ? renderedCookies[Number(row.dataset.i)] : null;
    const groupBtn = target.closest('[data-g]');
    const domain   = groupBtn ? renderedDomains[Number(groupBtn.dataset.g)] : null;

    if (target.closest('.btn-expand') && cookie) {
      const btn    = target.closest('.btn-expand');
      const detail = row.querySelector('.cookie-detail');
      const isOpen = detail.style.display !== 'none';
      detail.style.display = isOpen ? 'none' : 'block';
      btn.classList.toggle('expanded', !isOpen);
      if (isOpen) expandedKeys.delete(cookieKey(cookie));
      else        expandedKeys.add(cookieKey(cookie));
      return;
    }

    if (target.classList.contains('btn-edit-cookie') && cookie) {
      const detail = row.querySelector('.cookie-detail');
      detail.innerHTML = cookieFormHTML(cookie);
      editOriginals.set(detail.querySelector('.cookie-edit-form'), cookie);
      return;
    }

    if (target.classList.contains('btn-save-edit')) {
      const formEl   = target.closest('.cookie-edit-form');
      const original = editOriginals.get(formEl);
      if (!original) return;

      const form    = readForm(formEl);
      const problem = validateCookie(form);
      if (problem) return showToast(problem, 'error');

      const updated = formToCookie(form, { partitionKey: original.partitionKey });

      // Write the new cookie first so a rejected edit can never lose the original.
      try {
        await chrome.cookies.set(toSetDetails(updated));
      } catch (err) {
        return showToast(`Failed to save — ${err.message} The original cookie was not changed.`, 'error');
      }

      // If name, domain or path changed this is a different cookie, so remove the old one.
      if (cookieKey(updated) !== cookieKey(original)) {
        try {
          await chrome.cookies.remove(toRemoveDetails(original));
        } catch (err) {
          showToast('Saved the new cookie, but could not remove the original', 'error');
        }
        if (expandedKeys.delete(cookieKey(original))) expandedKeys.add(cookieKey(updated));
      }

      await refreshCookies();
      showToast('Cookie updated');
      return;
    }

    if (target.classList.contains('btn-cancel-edit')) {
      render();
      return;
    }

    if (target.closest('.btn-pin-domain') && domain !== null) {
      if (pinnedDomains.has(domain)) pinnedDomains.delete(domain);
      else pinnedDomains.add(domain);
      await chrome.storage.local.set({ pinned_domains: [...pinnedDomains] });
      render();
      return;
    }

    if (target.classList.contains('btn-delete') && cookie) {
      try {
        await chrome.cookies.remove(toRemoveDetails(cookie));
      } catch (err) {
        return showToast(`Failed to delete — ${err.message}`, 'error');
      }
      const key = cookieKey(cookie);
      allCookies = allCookies.filter(c => cookieKey(c) !== key);
      expandedKeys.delete(key);
      render();
      return;
    }

    if (target.classList.contains('btn-sessionize') && domain !== null) {
      const persistent = allCookies.filter(c => c.domain === domain && c.expirationDate);
      if (persistent.length === 0) return showToast('Already session-only');
      const result = await setCookies(persistent.map(c => ({ ...c, expirationDate: undefined })));
      await refreshCookies();
      reportResult(result, n => `Made ${plural(n, 'cookie')} session-only`, 'Could not change cookies');
      return;
    }

    if (target.classList.contains('btn-bulk-delete') && domain !== null) {
      const results = await Promise.allSettled(
        allCookies.filter(c => c.domain === domain).map(c => chrome.cookies.remove(toRemoveDetails(c)))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      await refreshCookies();
      if (failed) showToast(`${plural(failed, 'cookie')} could not be deleted`, 'error');
    }
  });

  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(allCookies, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cookies_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${allCookies.length} cookies`);
  });

  importBtn.addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => {
      importFile.value = '';
      showToast('Import failed — could not read the file', 'error');
    };
    reader.onload = async (ev) => {
      importFile.value = ''; // lets the same file be imported again
      let data;
      try {
        data = JSON.parse(ev.target.result);
      } catch (err) {
        return showToast('Import failed — not valid JSON', 'error');
      }
      if (!Array.isArray(data)) return showToast('Import failed — expected an array of cookies', 'error');
      const result = await setCookies(data);
      await refreshCookies();
      reportResult(result, n => `Imported ${plural(n, 'cookie')}`, 'Import failed');
    };
    reader.readAsText(file);
  });

});
