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

  const getCookieUrl = (cookie) => {
    const prefix = cookie.secure ? 'https://' : 'http://';
    const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
    return `${prefix}${domain}${cookie.path}`;
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

  const tryDecode = (value) => {
    try {
      const parsed = JSON.parse(value);
      return { type: 'JSON', data: JSON.stringify(parsed, null, 2) };
    } catch (e) {}
    try {
      const decoded = atob(value);
      if (/[^ -~]/.test(decoded)) throw new Error();
      return { type: 'Base64', data: decoded };
    } catch (e) {}
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
      .replace(/"/g, '&quot;');

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
      await Promise.all(snapshot.cookies.map(c => chrome.cookies.set({
        url: getCookieUrl(c), name: c.name, value: c.value, domain: c.domain,
        path: c.path, secure: c.secure, httpOnly: c.httpOnly,
        expirationDate: c.expirationDate, sameSite: c.sameSite,
      })));
      allCookies = await chrome.cookies.getAll({});
      render();
      showToast('Snapshot restored');
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
          <button class="btn-primary ${isEdit ? 'btn-save-edit' : 'btn-create-cookie'}"
            ${isEdit ? `
              data-orig-name="${escHtml(cookie.name)}"
              data-orig-domain="${escHtml(cookie.domain)}"
              data-orig-path="${escHtml(cookie.path)}"
              data-orig-secure="${cookie.secure}"
            ` : ''}>
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
      const { name, value, domain, path, expires, sameSite, secure, httpOnly } = readForm(panel.querySelector('.tab-manual'));

      if (!name)   return showToast('Name is required', 'error');
      if (!domain) return showToast('Domain is required', 'error');

      const params = { url: getCookieUrl({ secure, domain, path }), name, value, domain, path, secure, httpOnly, sameSite };
      if (expires) params.expirationDate = new Date(expires).getTime() / 1000;

      try {
        await chrome.cookies.set(params);
        allCookies = await chrome.cookies.getAll({});
        closeAllPanels();
        render();
        showToast(`Cookie "${name}" created`);
      } catch (err) {
        showToast('Failed to create — check domain format', 'error');
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
          parsed = JSON.parse(atob(raw));
        } catch (e2) {
          return showToast('Could not parse — invalid JSON or Base64', 'error');
        }
      }

      const cookies = Array.isArray(parsed) ? parsed : [parsed];
      if (cookies.some(c => !c.name || !c.domain)) {
        return showToast('Each cookie must have a name and domain', 'error');
      }

      try {
        await Promise.all(cookies.map(c => chrome.cookies.set({
          url:            getCookieUrl(c),
          name:           c.name,
          value:          c.value ?? '',
          domain:         c.domain,
          path:           c.path ?? '/',
          secure:         c.secure ?? false,
          httpOnly:       c.httpOnly ?? false,
          sameSite:       c.sameSite ?? 'lax',
          ...(c.expirationDate ? { expirationDate: c.expirationDate } : {}),
        })));
        allCookies = await chrome.cookies.getAll({});
        closeAllPanels();
        render();
        showToast(`Created ${cookies.length} cookie${cookies.length > 1 ? 's' : ''}`);
      } catch (err) {
        showToast('Failed to create — check cookie format', 'error');
      }
    }

    if (e.target.classList.contains('btn-cancel-create')) {
      closeAllPanels();
    }
  });


  // Rendering

  const cookieItemHTML = (cookie, duplicateNames) => {
    const decoded = tryDecode(cookie.value);
    const safeId  = `${cookie.name}-${cookie.domain}`.replace(/[^\w-]/g, '_');
    const expires = cookie.expirationDate
      ? new Date(cookie.expirationDate * 1000).toLocaleString()
      : 'Session';

    return `
      <div class="cookie-item ${!cookie.httpOnly ? 'warning-bg' : ''}">
        <div class="cookie-main">
          <div class="cookie-info">
            <span class="cookie-name">${escHtml(cookie.name)}</span>
            <div class="security-labels">
              ${!cookie.httpOnly ? '<span class="label xss">No HttpOnly</span>' : ''}
              ${duplicateNames.has(cookie.name) ? '<span class="label duplicate">Duplicate</span>' : ''}
              <span class="label expiry">${getRelativeTime(cookie.expirationDate)}</span>
            </div>
          </div>
          <div class="cookie-actions">
            <button class="btn-expand" data-id="${safeId}">${chevronIcon}</button>
            <button class="btn-delete"
              data-name="${cookie.name}" data-domain="${cookie.domain}"
              data-secure="${cookie.secure}" data-path="${cookie.path}">
              Delete
            </button>
          </div>
        </div>
        <div class="cookie-detail" id="detail-${safeId}" style="display:none">
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
            <div class="meta-pair"><span>SameSite</span><span>${cookie.sameSite || '—'}</span></div>
            <div class="meta-pair"><span>Expires</span><span>${expires}</span></div>
            <div class="meta-pair"><span>Host Only</span><span>${cookie.hostOnly ? 'Yes' : 'No'}</span></div>
          </div>
          <div class="detail-footer">
            <button class="btn-edit-cookie"
              data-name="${cookie.name}"
              data-domain="${cookie.domain}"
              data-path="${cookie.path}">
              Edit Cookie
            </button>
          </div>
        </div>
      </div>`;
  };

  const domainGroupHTML = (domain, cookies, duplicateNames, pinnedDomains) => {
    const isPinned = pinnedDomains.has(domain);
    return `
    <div class="domain-group">
      <div class="domain-header ${isPinned ? 'pinned' : ''}">
        <div class="domain-info">
          <span>${domain}</span>
          <span class="badge">${cookies.length}</span>
        </div>
        <div class="group-actions">
          <button class="btn-pin-domain ${isPinned ? 'pinned' : ''}" data-domain="${domain}" title="${isPinned ? 'Unpin domain' : 'Pin to top'}">${pinIcon}</button>
          <button class="btn-secondary btn-sessionize" data-domain="${domain}">Make Session-Only</button>
          <button class="btn-bulk-delete" data-domain="${domain}">Clear Domain</button>
        </div>
      </div>
      ${cookies.map(c => cookieItemHTML(c, duplicateNames)).join('')}
    </div>`;
  };

  const render = (filterText = '') => {
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
    cookieList.innerHTML = groupEntries.map(([d, c]) => domainGroupHTML(d, c, duplicateNames, pinnedDomains)).join('');
  };


  // Init

  const { pinned_domains: savedPins = [] } = await chrome.storage.local.get(['pinned_domains']);
  pinnedDomains = new Set(savedPins);

  allCookies = await chrome.cookies.getAll({});
  render();


  // Events

  chrome.cookies.onChanged.addListener(({ cookie, removed }) => {
    const idx = allCookies.findIndex(c =>
      c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path
    );
    if (removed) {
      if (idx >= 0) allCookies.splice(idx, 1);
    } else {
      if (idx >= 0) allCookies[idx] = cookie;
      else allCookies.push(cookie);
    }
    render(searchInput.value);
  });

  searchInput.addEventListener('input', debounce((e) => render(e.target.value), 250));

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    render(searchInput.value);
  });

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      render(searchInput.value);
    });
  });

  saveSnapshotBtn.addEventListener('click', async () => {
    const { cookie_snapshots: snapshots = [] } = await chrome.storage.local.get(['cookie_snapshots']);
    if (snapshots.length >= 10) return showToast('Maximum of 10 snapshots reached', 'error');
    const labelInput = document.getElementById('snapshotLabel');
    const label      = labelInput?.value.trim() || '';
    const updated    = [{ id: Date.now(), date: Date.now(), label, cookies: allCookies }, ...snapshots];
    await chrome.storage.local.set({ cookie_snapshots: updated });
    if (labelInput) labelInput.value = '';
    renderSnapshots();
    showToast('Snapshot saved');
  });

  cookieList.addEventListener('click', async (e) => {
    const target = e.target;

    if (target.closest('.btn-expand')) {
      const btn    = target.closest('.btn-expand');
      const detail = document.getElementById(`detail-${btn.dataset.id}`);
      const isOpen = detail.style.display !== 'none';
      detail.style.display = isOpen ? 'none' : 'block';
      btn.classList.toggle('expanded', !isOpen);
      return;
    }

    if (target.classList.contains('btn-edit-cookie')) {
      const { name, domain, path } = target.dataset;
      const cookie = allCookies.find(c => c.name === name && c.domain === domain && c.path === path);
      if (!cookie) return;
      const safeId = `${name}-${domain}`.replace(/[^\w-]/g, '_');
      const detail = document.getElementById(`detail-${safeId}`);
      detail.innerHTML = cookieFormHTML(cookie);
      return;
    }

    if (target.classList.contains('btn-save-edit')) {
      const form = target.closest('.cookie-edit-form');
      const { name, value, domain, path, expires, sameSite, secure, httpOnly } = readForm(form);

      if (!name)   return showToast('Name is required', 'error');
      if (!domain) return showToast('Domain is required', 'error');

      const origName   = target.dataset.origName;
      const origDomain = target.dataset.origDomain;
      const origPath   = target.dataset.origPath;
      const origSecure = target.dataset.origSecure === 'true';

      await chrome.cookies.remove({
        url: getCookieUrl({ domain: origDomain, secure: origSecure, path: origPath }),
        name: origName,
      });

      const params = { url: getCookieUrl({ secure, domain, path }), name, value, domain, path, secure, httpOnly, sameSite };
      if (expires) params.expirationDate = new Date(expires).getTime() / 1000;

      try {
        await chrome.cookies.set(params);
        allCookies = await chrome.cookies.getAll({});
        render(searchInput.value);
        showToast('Cookie updated');
      } catch (err) {
        showToast('Failed to save — check domain format', 'error');
      }
      return;
    }

    if (target.classList.contains('btn-cancel-edit')) {
      render(searchInput.value);
      return;
    }

    if (target.closest('.btn-pin-domain')) {
      const domain = target.closest('.btn-pin-domain').dataset.domain;
      if (pinnedDomains.has(domain)) pinnedDomains.delete(domain);
      else pinnedDomains.add(domain);
      await chrome.storage.local.set({ pinned_domains: [...pinnedDomains] });
      render(searchInput.value);
      return;
    }

    if (target.classList.contains('btn-delete')) {
      const { name, domain, secure, path } = target.dataset;
      await chrome.cookies.remove({ url: getCookieUrl({ name, domain, secure: secure === 'true', path }), name });
      allCookies = allCookies.filter(c => !(c.name === name && c.domain === domain));
      render(searchInput.value);
    }

    if (target.classList.contains('btn-sessionize')) {
      const domain = target.dataset.domain;
      await Promise.all(
        allCookies.filter(c => c.domain === domain).map(c => chrome.cookies.set({
          url: getCookieUrl(c), name: c.name, value: c.value, domain: c.domain,
          path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
        }))
      );
      allCookies = await chrome.cookies.getAll({});
      render(searchInput.value);
    }

    if (target.classList.contains('btn-bulk-delete')) {
      const domain = target.dataset.domain;
      await Promise.all(
        allCookies.filter(c => c.domain === domain).map(c =>
          chrome.cookies.remove({ url: getCookieUrl(c), name: c.name })
        )
      );
      allCookies = allCookies.filter(c => c.domain !== domain);
      render(searchInput.value);
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
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('Not a cookie array');
        await Promise.all(data.map(c => chrome.cookies.set({
          url: getCookieUrl(c), name: c.name, value: c.value, domain: c.domain,
          path: c.path, secure: c.secure, httpOnly: c.httpOnly,
          expirationDate: c.expirationDate, sameSite: c.sameSite,
        })));
        allCookies = await chrome.cookies.getAll({});
        render();
        showToast(`Imported ${data.length} cookies`);
      } catch (err) {
        showToast('Import failed — invalid file', 'error');
      }
    };
    reader.readAsText(e.target.files[0]);
  });

});
