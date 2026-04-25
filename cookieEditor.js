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

  let allCookies = [];

  // Icons
  const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  const chevronIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  const gearIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

  settingsIconContainer.innerHTML = gearIcon;


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
    const days = Math.floor(hours / 24);
    if (days > 0) return `Expires in ${days}d`;
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
    const list = document.getElementById('snapshotList');
    const saveBtn = document.getElementById('saveSnapshot');
    const countBadge = document.getElementById('snapshotCount');

    if (countBadge) countBadge.textContent = `${snapshots.length} / 10`;
    if (saveBtn) saveBtn.disabled = snapshots.length >= 10;

    if (snapshots.length === 0) {
      list.innerHTML = '<div class="snapshot-empty">No snapshots saved yet</div>';
      return;
    }

    list.innerHTML = snapshots.map(s => `
      <div class="snapshot-item">
        <div class="snapshot-info">
          <span class="snapshot-date">${new Date(s.date).toLocaleString()}</span>
          <span class="snapshot-cookie-count">${s.cookies.length} cookies</span>
        </div>
        <div class="snapshot-actions">
          <button class="btn-restore-snap" data-id="${s.id}">Restore</button>
          <button class="btn-delete-snap" data-id="${s.id}">Delete</button>
        </div>
      </div>
    `).join('');
  };

  settingsToggle.addEventListener('click', () => {
    const isOpen = document.querySelector('.app-container').classList.toggle('settings-open');
    settingsToggle.classList.toggle('active', isOpen);
    if (isOpen) renderSnapshots();
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
        url: getCookieUrl(c),
        name: c.name, value: c.value, domain: c.domain,
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


  // Rendering

  const cookieItemHTML = (cookie) => {
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
        </div>
      </div>`;
  };

  const domainGroupHTML = (domain, cookies) => `
    <div class="domain-group">
      <div class="domain-header">
        <div class="domain-info">
          <span>${domain}</span>
          <span class="badge">${cookies.length}</span>
        </div>
        <div class="group-actions">
          <button class="btn-secondary btn-sessionize" data-domain="${domain}">Make Session-Only</button>
          <button class="btn-bulk-delete" data-domain="${domain}">Clear Domain</button>
        </div>
      </div>
      ${cookies.map(cookieItemHTML).join('')}
    </div>`;

  const render = (filterText = '') => {
    const lowerFilter = filterText.toLowerCase();
    const filtered = allCookies.filter(c =>
      c.domain.toLowerCase().includes(lowerFilter) ||
      c.name.toLowerCase().includes(lowerFilter) ||
      c.value.toLowerCase().includes(lowerFilter)
    );

    const groups = filtered.reduce((acc, cookie) => {
      acc[cookie.domain] = acc[cookie.domain] || [];
      acc[cookie.domain].push(cookie);
      return acc;
    }, {});

    if (filtered.length === 0) {
      const isSearch = filterText.length > 0;
      statsDisplay.textContent = isSearch ? `No results for "${filterText}"` : 'No cookies found';
      cookieList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${isSearch ? '🔍' : '🍪'}</div>
          <div class="empty-title">${isSearch ? 'No results' : 'No cookies found'}</div>
          <div class="empty-body">${isSearch
            ? `No cookies match "<strong>${escHtml(filterText)}</strong>"`
            : 'There are no cookies stored in your browser.'
          }</div>
        </div>`;
      return;
    }

    statsDisplay.textContent = `${filtered.length} cookies across ${Object.keys(groups).length} domains`;
    cookieList.innerHTML = Object.entries(groups).map(([d, c]) => domainGroupHTML(d, c)).join('');
  };


  // Init

  allCookies = await chrome.cookies.getAll({});
  render();


  // Events

  searchInput.addEventListener('input', debounce((e) => render(e.target.value), 250));

  saveSnapshotBtn.addEventListener('click', async () => {
    const { cookie_snapshots: snapshots = [] } = await chrome.storage.local.get(['cookie_snapshots']);
    if (snapshots.length >= 10) return showToast('Maximum of 10 snapshots reached', 'error');
    const updated = [{ id: Date.now(), date: Date.now(), cookies: allCookies }, ...snapshots];
    await chrome.storage.local.set({ cookie_snapshots: updated });
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
