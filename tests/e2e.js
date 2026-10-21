// End-to-end tests: the real popup, running as an extension in real Chromium, against real cookies.
// Run with `npm run test:e2e` (set HEADED=1 to watch).
'use strict';

const fs = require('fs');
const { launchExtension } = require('./helpers');

const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass: Boolean(pass) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${!pass && detail !== undefined ? `  — ${JSON.stringify(detail)}` : ''}`);
};

(async () => {
  const app = await launchExtension();
  const page = await app.context.newPage();
  page.setDefaultTimeout(8000);

  const pageErrors = [];
  const externalRequests = [];
  // Fake "website" tabs opened by the scope tests; their own traffic is not the popup's.
  const sitePages = new Set();
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
  app.context.on('request', (r) => {
    if (/^(chrome-extension|data|blob):/.test(r.url())) return;
    let owner = null;
    try { owner = r.frame()?.page(); } catch (e) { /* requests with no frame */ }
    if (!sitePages.has(owner)) externalRequests.push(r.url());
  });

  // ---- helpers
  const load = async () => {
    await page.goto(app.popupUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('stats').textContent !== 'Loading...');
  };
  const ext = (fn, arg) => page.evaluate(fn, arg);
  const toast = () => page.evaluate(() => document.getElementById('toast').textContent);
  const cssString = (x) => x.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const group = (d) => page.locator(`.domain-group:has(.domain-info > span:first-child:text-is("${cssString(d)}"))`);
  const row = (name, d) => (d ? group(d) : page).locator(`.cookie-item:has(.cookie-name:text-is("${cssString(name)}"))`);
  const cookiesNamed = (name) => ext(async (n) => (await chrome.cookies.getAll({ name: n })).map((c) => ({
    domain: c.domain, path: c.path, value: c.value, secure: c.secure, hostOnly: c.hostOnly, session: c.session,
  })), name);
  const editRow = async (name, d) => {
    await row(name, d).locator('.btn-expand').click();
    await row(name, d).locator('.btn-edit-cookie').click();
  };
  const expiresIn30Days = Math.floor(Date.now() / 1000) + 86400 * 30;

  await load();

  // ---------- Privacy: the popup must be fully offline ----------
  await ext(() => document.fonts.ready);
  const faces = await ext(() => [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`));
  check('Inter is bundled: all four weights loaded from the extension', faces.length === 4 && faces.every((f) => f.startsWith('Inter') && f.endsWith('loaded')), faces);

  // ---------- Editing never loses the original ----------
  await ext(async (exp) => {
    await chrome.cookies.set({ url: 'https://edit1.test/', name: 'ed1', value: 'keepme', expirationDate: exp });
    await chrome.cookies.set({ url: 'https://edit2.test/', name: 'ed2', value: 'keepme', expirationDate: exp });
  }, expiresIn30Days);
  await load();
  await editRow('ed1', 'edit1.test');
  await row('ed1', 'edit1.test').locator('.form-domain').fill('bad domain!!');
  await row('ed1', 'edit1.test').locator('.btn-save-edit').click();
  await page.waitForTimeout(400);
  check('edit with invalid domain: explains why', /hostname/i.test(await toast()), await toast());
  check('edit with invalid domain: original kept', (await cookiesNamed('ed1')).length === 1);

  await load();
  await editRow('ed2', 'edit2.test');
  await row('ed2', 'edit2.test').locator('.form-value').fill('a;b'); // Chrome rejects ';' in values
  await row('ed2', 'edit2.test').locator('.btn-save-edit').click();
  await page.waitForTimeout(400);
  const ed2 = await cookiesNamed('ed2');
  check('edit rejected by Chrome: error toast', /^Failed to save/.test(await toast()), await toast());
  check('edit rejected by Chrome: original kept unchanged', ed2.length === 1 && ed2[0].value === 'keepme', ed2);

  await ext(() => chrome.cookies.set({ url: 'https://edit3.test/', name: 'ed3', value: 'x' }));
  await load();
  await editRow('ed3', 'edit3.test');
  await row('ed3', 'edit3.test').locator('.form-name').fill('ed3_renamed');
  await row('ed3', 'edit3.test').locator('.btn-save-edit').click();
  await page.waitForTimeout(500);
  check('edit rename: old gone, new present', (await cookiesNamed('ed3')).length === 0 && (await cookiesNamed('ed3_renamed')).length === 1);

  // Flipping Secure on the same cookie needs an https URL to overwrite a Secure cookie
  await ext(async () => {
    await chrome.cookies.set({ url: 'https://sec.test/', name: 'sec1', value: '1', secure: true });
    await chrome.cookies.set({ url: 'https://sec.test/', name: 'insec1', value: '1' });
  });
  await load();
  await editRow('sec1', 'sec.test');
  await row('sec1', 'sec.test').locator('.form-secure').uncheck();
  await row('sec1', 'sec.test').locator('.btn-save-edit').click();
  await page.waitForTimeout(500);
  const sec1 = await cookiesNamed('sec1');
  check('edit Secure -> not Secure: single cookie, flag changed', sec1.length === 1 && sec1[0].secure === false, sec1);
  await editRow('insec1', 'sec.test');
  await row('insec1', 'sec.test').locator('.form-secure').check();
  await row('insec1', 'sec.test').locator('.btn-save-edit').click();
  await page.waitForTimeout(500);
  const insec1 = await cookiesNamed('insec1');
  check('edit not Secure -> Secure: single cookie, flag changed', insec1.length === 1 && insec1[0].secure === true, insec1);

  // ---------- Host-only cookies stay host-only ----------
  await ext(async (exp) => {
    await chrome.cookies.set({ url: 'https://ho.test/', name: 'ho', value: 'v1', expirationDate: exp });
    await chrome.cookies.set({ url: 'https://app.test/', name: 'h1', value: 'v', expirationDate: exp });
  }, expiresIn30Days);
  await load();
  await editRow('ho', 'ho.test');
  await row('ho', 'ho.test').locator('.form-value').fill('v2');
  await row('ho', 'ho.test').locator('.btn-save-edit').click();
  await page.waitForTimeout(500);
  const ho = await cookiesNamed('ho');
  check('edit host-only cookie: no duplicate, still host-only', ho.length === 1 && ho[0].hostOnly && ho[0].value === 'v2', ho);

  await load();
  await group('app.test').locator('.btn-sessionize').click();
  await page.waitForTimeout(500);
  const h1 = await cookiesNamed('h1');
  check('Make Session-Only on a host-only cookie: one cookie, now session, still host-only', h1.length === 1 && h1[0].session && h1[0].hostOnly, h1);
  check('Make Session-Only: success toast', /session-only/.test(await toast()), await toast());

  // ---------- Same name, different path ----------
  await ext(async () => {
    await chrome.cookies.set({ url: 'https://multi.test/', name: 'sid', value: 'A', path: '/a' });
    await chrome.cookies.set({ url: 'https://multi.test/', name: 'sid', value: 'B', path: '/b' });
  });
  await load();
  check('no element ids that can collide', (await ext(() => document.querySelectorAll('[id^="detail-"]').length)) === 0);
  const sidRows = row('sid', 'multi.test');
  const rowForPath = (p) => sidRows.filter({ has: page.locator(`.meta-pair:has(span:text-is("Path")) span:text-is("${p}")`) });
  await rowForPath('/a').locator('.btn-expand').click();
  check('expanding /a opens only that row', (await sidRows.locator('.cookie-detail:visible').count()) === 1);
  await rowForPath('/a').locator('.btn-delete').click();
  await page.waitForTimeout(500);
  check('delete /a: UI still shows /b', (await sidRows.count()) === 1);
  const sid = await cookiesNamed('sid');
  check('delete /a: only /b remains in the browser', sid.length === 1 && sid[0].path === '/b', sid);

  // ---------- Restore and import report honestly ----------
  await ext(() => chrome.cookies.set({ url: 'https://snap.test/', name: 'good1', value: 'g' }));
  await load();
  await page.click('#settingsToggle');
  await page.fill('#snapshotLabel', 't');
  await page.click('#saveSnapshot');
  await page.waitForTimeout(400);
  await ext(async () => {
    const { cookie_snapshots: s } = await chrome.storage.local.get('cookie_snapshots');
    s[0].cookies.push({ name: '__Host-bad', value: 'x', domain: 'snap.test', path: '/', secure: false, httpOnly: false, sameSite: 'lax' });
    await chrome.storage.local.set({ cookie_snapshots: s });
    await chrome.cookies.remove({ url: 'https://snap.test/', name: 'good1' });
  });
  pageErrors.length = 0;
  await page.click('.btn-restore-snap');
  await page.waitForTimeout(800);
  check('restore with one bad cookie: toast says N restored, 1 rejected', /Restored \d+ cookies?, but 1 was rejected/.test(await toast()), await toast());
  check('restore with one bad cookie: good cookie restored', (await cookiesNamed('good1')).length === 1);
  check('restore with one bad cookie: no uncaught errors', pageErrors.length === 0, pageErrors);

  await load();
  const importJson = JSON.stringify([
    { name: 'i1', value: '1', domain: 'imp.test', path: '/', secure: false },
    { name: '__Host-bad', value: '1', domain: 'imp.test', path: '/', secure: false },
    { name: 'i3', value: '3', domain: 'imp.test', path: '/', secure: false },
  ]);
  await page.setInputFiles('#importFile', { name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(importJson) });
  await page.waitForTimeout(800);
  check('import with one bad cookie: toast says 2 imported, 1 rejected', /Imported 2 cookies, but 1 was rejected/.test(await toast()), await toast());
  const imported = await ext(async () => (await chrome.cookies.getAll({ domain: 'imp.test' })).map((c) => c.name));
  check('import: good cookies created', imported.sort().join() === 'i1,i3', imported);
  check('import: file input reset so the same file can be picked again', (await ext(() => document.getElementById('importFile').value)) === '');
  await page.setInputFiles('#importFile', { name: 'c.json', mimeType: 'application/json', buffer: Buffer.from('not json') });
  await page.waitForTimeout(400);
  check('import of non-JSON: clear message', /not valid JSON/.test(await toast()), await toast());

  // ---------- Edit form and expanded rows survive background changes ----------
  await ext(() => chrome.cookies.set({ url: 'https://keep.test/', name: 'k1', value: 'x' }));
  await load();
  await editRow('k1', 'keep.test');
  await row('k1', 'keep.test').locator('.form-value').fill('typing in progress');
  await ext(() => chrome.cookies.set({ url: 'https://unrelated.test/', name: 'bg', value: '1' }));
  await page.waitForTimeout(500);
  check('open edit form survives a background cookie change', (await page.locator('.cookie-edit-form').count()) === 1);
  check('...and keeps what was typed', (await row('k1', 'keep.test').locator('.form-value').inputValue()) === 'typing in progress');
  await row('k1', 'keep.test').locator('.btn-cancel-edit').click();
  check('cancelling the edit renders the new cookie too', (await row('bg', 'unrelated.test').count()) === 1);

  await load();
  await row('k1', 'keep.test').locator('.btn-expand').click();
  await ext(() => chrome.cookies.set({ url: 'https://unrelated.test/', name: 'bg2', value: '1' }));
  await page.waitForTimeout(500);
  check('expanded row stays expanded after a re-render', (await row('k1', 'keep.test').locator('.cookie-detail:visible').count()) === 1);

  // ---------- Search box and list agree ----------
  await load();
  await page.fill('#searchInput', 'zzz-no-match');
  await page.waitForTimeout(500);
  await page.click('#createToggle');
  await page.fill('.tab-manual .form-name', 'made');
  await page.fill('.tab-manual .form-domain', 'made.test');
  await page.click('.btn-create-cookie');
  await page.waitForTimeout(600);
  const statsAfterCreate = await ext(() => document.getElementById('stats').textContent);
  check('after create, the list still honours the search text', statsAfterCreate === 'No matching cookies', statsAfterCreate);
  await page.fill('#searchInput', '');
  await page.waitForTimeout(500);

  // ---------- Odd cookie names ----------
  await ext(() => chrome.cookies.set({ url: 'https://inj.test/', name: 'q"uote', value: '1' }));
  await ext(() => chrome.cookies.set({ url: 'https://inj.test/', name: 'a<b>c', value: '1' }));
  await load();
  check('names with quotes and angle brackets render as one row each', (await group('inj.test').locator('.cookie-item').count()) === 2);
  await row('q"uote', 'inj.test').locator('.btn-delete').click();
  await page.waitForTimeout(500);
  check('delete works for a name containing a quote', (await cookiesNamed('q"uote')).length === 0);

  // ---------- Partitioned (CHIPS) cookies ----------
  await ext(async () => {
    await chrome.cookies.set({ url: 'https://embed.test/', name: 'part', value: '1', secure: true, sameSite: 'no_restriction', partitionKey: { topLevelSite: 'https://top.test' } });
    await chrome.cookies.set({ url: 'https://embed.test/', name: 'plain1', value: '1' });
  });
  await load();
  check('partitioned cookie is listed with a label', (await row('part', 'embed.test').locator('.label:text-is("Partitioned")').count()) === 1);
  check('unpartitioned cookies are not duplicated by the second query', (await row('plain1', 'embed.test').count()) === 1);
  await row('part', 'embed.test').locator('.btn-delete').click();
  await page.waitForTimeout(500);
  check('partitioned cookie can be deleted', (await ext(async () => (await chrome.cookies.getAll({ name: 'part', partitionKey: {} })).length)) === 0);

  // ---------- Decoding in the detail panel ----------
  await ext(async () => {
    const enc = (s) => btoa(unescape(encodeURIComponent(s)));
    const values = {
      num: '123', bool: 'true',
      jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYiLCJleHAiOjE5MDAwMDAwMDB9.c2ln',
      b64json: enc('{"a":1}'), b64nl: enc('line1\nline2 and more'), b64utf: enc('{"name":"José"}'),
      urlenc: '%7B%22a%22%3A1%7D',
    };
    for (const [name, value] of Object.entries(values)) await chrome.cookies.set({ url: 'https://dec.test/', name, value });
  });
  await load();
  const decodedLabel = async (name) => {
    const r = row(name, 'dec.test');
    await r.locator('.btn-expand').click();
    return r.locator('.detail-key .label').first().textContent({ timeout: 800 }).catch(() => null);
  };
  check('"123" is not labelled as decoded', (await decodedLabel('num')) === null);
  check('"true" is not labelled as decoded', (await decodedLabel('bool')) === null);
  check('JWT decoded', (await decodedLabel('jwt')) === 'JWT');
  check('Base64 JSON decoded', (await decodedLabel('b64json')) === 'Base64 JSON');
  check('Base64 text with a newline decoded', (await decodedLabel('b64nl')) === 'Base64');
  check('Base64 with UTF-8 decoded', (await decodedLabel('b64utf')) === 'Base64 JSON');
  check('URL-encoded JSON decoded', (await decodedLabel('urlenc')) === 'URL-encoded JSON');

  // ---------- Creating cookies ----------
  await load();
  const createManual = async (name, domain) => {
    await page.click('#createToggle');
    await page.fill('.tab-manual .form-name', name);
    await page.fill('.tab-manual .form-domain', domain);
    await page.click('.btn-create-cookie');
    await page.waitForTimeout(500);
  };
  await createManual('c1', 'newho.test');
  await createManual('c2', '.newdom.test');
  const c1 = await cookiesNamed('c1');
  const c2 = await cookiesNamed('c2');
  check('domain without a dot -> host-only cookie', c1.length === 1 && c1[0].hostOnly, c1);
  check('domain with a dot -> domain cookie', c2.length === 1 && !c2[0].hostOnly, c2);
  await createManual('c3', 'localhost');
  await createManual('c4', '127.0.0.1');
  check('localhost cookie created', (await cookiesNamed('c3')).length === 1);
  check('IP-address cookie created', (await cookiesNamed('c4')).length === 1);

  await page.click('#createToggle');
  await page.fill('.tab-manual .form-name', 'bad1');
  await page.fill('.tab-manual .form-domain', 'x.test');
  await page.selectOption('.tab-manual .form-samesite', 'no_restriction');
  await page.click('.btn-create-cookie');
  await page.waitForTimeout(300);
  check('SameSite=None without Secure: says why', /SameSite=None requires/.test(await toast()), await toast());
  await page.fill('.tab-manual .form-name', '__Host-bad');
  await page.selectOption('.tab-manual .form-samesite', 'lax');
  await page.click('.btn-create-cookie');
  await page.waitForTimeout(300);
  check('__Host- without Secure: says why', /__Host-/.test(await toast()), await toast());

  await load(); // paste a cookie that has no path (it used to build a broken URL)
  await page.click('#createToggle');
  await page.click('.tab-btn[data-tab="paste"]');
  await page.fill('.paste-input', JSON.stringify({ name: 'pasted', value: 'v', domain: 'paste.test' }));
  await page.click('.btn-paste-create');
  await page.waitForTimeout(500);
  const pasted = await cookiesNamed('pasted');
  check('paste a cookie without a path', pasted.length === 1 && pasted[0].hostOnly, pasted);

  // ---------- "This site / All" scope ----------
  // Everything above ran with no website tab open, so the popup showed every cookie. Here a fake
  // website tab (served by Playwright, no real network) is open, as it is when the popup is used.
  const SITE = 'www.scope-a.test';
  const openSite = async (host) => {
    await app.context.route(`https://${host}/**`, (route) => route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>${host}</title>` }));
    const tab = await app.context.newPage();
    sitePages.add(tab);
    await tab.goto(`https://${host}/`);
    return tab;
  };
  const listedDomains = () => ext(() => [...document.querySelectorAll('.domain-header .domain-info > span:first-child')].map((e) => e.textContent).sort());
  const listedNames = () => ext(() => [...document.querySelectorAll('.cookie-item .cookie-name')].map((e) => e.textContent).sort());
  const statsText = () => ext(() => document.getElementById('stats').textContent);
  const pickScope = async (scope) => {
    await page.click(`.scope-btn[data-scope="${scope}"]`);
    await page.waitForTimeout(150);
  };
  const exportFile = async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
    return { name: download.suggestedFilename(), cookies: JSON.parse(fs.readFileSync(await download.path(), 'utf8')) };
  };

  await ext(async (exp) => {
    const set = (url, name, extra = {}) => chrome.cookies.set({ url, name, value: 'v', expirationDate: exp, ...extra });
    await set('https://www.scope-a.test/', 'sa_domain', { domain: '.scope-a.test' }); // domain cookie on the parent: applies to www
    await set('https://www.scope-a.test/', 'sa_host');                                 // host-only on www
    await set('https://scope-a.test/', 'sa_parent_host');                              // host-only on the parent: not sent to www
    await set('https://api.scope-a.test/', 'sa_sibling');                              // sibling subdomain
    await set('https://cope-a.test/', 'sa_trap', { domain: '.cope-a.test' });          // text-suffix lookalike of the site
    await set('https://other-scope.test/', 'sa_other');                                // another site entirely
    await set('https://www.scope-a.test/', 'shadow', { domain: '.scope-a.test' });     // same name twice within the site
    await set('https://www.scope-a.test/', 'shadow');
    await set('https://other-scope.test/', 'only_cross');                              // same name on this site and another one
    await set('https://www.scope-a.test/', 'only_cross');
  }, expiresIn30Days);

  const siteTab = await openSite(SITE);

  // Here the popup is a page in a tab of its own (the toolbar popup cannot be opened from a test), so it
  // must pick the most recently used *other* tab. First with the website tab in front, then with the
  // popup tab in front, where it has to skip itself.
  await load();
  check('popup in a background tab: the scope toggle shows the website tab\'s hostname', (await page.locator('#scopeRow').isVisible()) && (await page.locator('#scopeHost').textContent()) === SITE);
  await page.bringToFront();
  await load();
  check('popup tab in front: skips itself and shows the website tab\'s hostname', (await page.locator('#scopeHost').textContent()) === SITE);
  check('"This site" is the default scope', (await page.locator('.scope-btn[data-scope="site"]').getAttribute('aria-pressed')) === 'true' && (await page.locator('.scope-btn[data-scope="all"]').getAttribute('aria-pressed')) === 'false');
  check('This site: only the site\'s domains are listed', (await listedDomains()).join() === '.scope-a.test,www.scope-a.test', await listedDomains());
  check('This site: parent domain cookie and host-only cookie shown, siblings/lookalikes/other sites hidden',
    (await listedNames()).join() === 'only_cross,sa_domain,sa_host,shadow,shadow', await listedNames());
  check('This site: stats count only the site', (await statsText()) === '5 cookies across 2 domains', await statsText());
  check('This site: Duplicate only for a name repeated within the site',
    (await page.locator('.cookie-item:has(.cookie-name:text-is("shadow")) .label.duplicate').count()) === 2 &&
    (await row('only_cross').locator('.label.duplicate').count()) === 0);

  await pickScope('all');
  check('All: other sites and the site\'s siblings are listed again',
    (await group('other-scope.test').count()) === 1 && (await group('api.scope-a.test').count()) === 1 && (await group('.cope-a.test').count()) === 1);
  check('All: a name on two sites is a Duplicate again', (await page.locator('.cookie-item:has(.cookie-name:text-is("only_cross")) .label.duplicate').count()) === 2);
  check('All: the toggle shows All as selected', (await page.locator('.scope-btn[data-scope="all"]').getAttribute('aria-pressed')) === 'true');
  await pickScope('site');
  check('switching back to This site narrows the list again', (await listedDomains()).join() === '.scope-a.test,www.scope-a.test');

  // Search works inside the scope, and an empty result offers a way out
  await page.fill('#searchInput', 'sa_other');
  await page.waitForTimeout(500);
  check('search in This site does not find another site\'s cookie', (await statsText()) === 'No matching cookies', await statsText());
  await page.click('.btn-show-all');
  await page.waitForTimeout(300);
  check('"Show all sites" in the empty state switches to All and keeps the search', (await row('sa_other', 'other-scope.test').count()) === 1 && (await page.inputValue('#searchInput')) === 'sa_other');
  await page.fill('#searchInput', '');
  await page.waitForTimeout(500);
  await pickScope('site');

  // Live updates respect the scope
  await ext(async () => {
    await chrome.cookies.set({ url: 'https://www.scope-a.test/', name: 'sa_live', value: '1' });
    await chrome.cookies.set({ url: 'https://other-scope.test/', name: 'sa_live_other', value: '1' });
  });
  await page.waitForTimeout(500);
  check('live update: a new cookie for the site appears', (await row('sa_live', 'www.scope-a.test').count()) === 1);
  check('live update: a new cookie for another site stays hidden', (await row('sa_live_other').count()) === 0);

  // Export JSON covers what the scope shows
  const siteExport = await exportFile();
  check('Export in This site: only the site\'s cookies', siteExport.cookies.map((c) => c.name).sort().join() === 'only_cross,sa_domain,sa_host,sa_live,shadow,shadow', siteExport.cookies.map((c) => c.name));
  check('Export in This site: file name carries the hostname', /^cookies_www\.scope-a\.test_\d{4}-\d{2}-\d{2}\.json$/.test(siteExport.name), siteExport.name);
  check('Export in This site: toast names the site', /^Exported 6 cookies for www\.scope-a\.test$/.test(await toast()), await toast());
  await pickScope('all');
  const allExport = await exportFile();
  check('Export in All: every cookie, plain file name', allExport.cookies.some((c) => c.name === 'sa_other') && allExport.cookies.some((c) => c.name === 'sa_sibling') && /^cookies_\d{4}-\d{2}-\d{2}\.json$/.test(allExport.name), allExport.name);

  // A site with no cookies
  const emptyTab = await openSite('empty-scope.test');
  await page.bringToFront();
  await load();
  check('site with no cookies: says so', (await statsText()) === 'No cookies for empty-scope.test', await statsText());
  check('site with no cookies: empty state offers "Show all sites"', (await page.locator('.empty-state .btn-show-all').count()) === 1);
  await page.click('.btn-show-all');
  await page.waitForTimeout(300);
  check('...and it shows everything', /cookies across/.test(await statsText()) && (await group('other-scope.test').count()) === 1);
  await emptyTab.close();

  // No website in the window: the toggle is hidden and everything is shown
  await siteTab.close();
  await page.bringToFront();
  await load();
  check('no website tab: the scope toggle is hidden', !(await page.locator('#scopeRow').isVisible()));
  check('no website tab: shows all cookies', (await group('other-scope.test').count()) === 1 && /cookies across/.test(await statsText()), await statsText());

  check('no uncaught page errors during the run', pageErrors.length === 0, pageErrors);

  // ---------- Bursts of cookie changes while the popup is open ----------
  const outsider = await app.context.newPage();
  await outsider.goto(app.blankUrl);
  await load();
  const started = Date.now();
  await outsider.evaluate(async () => {
    for (let i = 0; i < 500; i++) await chrome.cookies.set({ url: `https://burst${i % 5}.test/`, name: `c${i}`, value: 'x'.repeat(200) });
  });
  const burstSeconds = (Date.now() - started) / 1000;
  await page.waitForTimeout(600);
  check('500 cookie writes with the popup open stay fast', burstSeconds < 10, `${burstSeconds.toFixed(1)}s`);
  check('...and the list catches up', /\d+ cookies across/.test(await ext(() => document.getElementById('stats').textContent)));

  // ---------- Privacy, checked last so it covers everything above ----------
  check('the popup never made a request outside the extension', externalRequests.length === 0, externalRequests);

  await app.close();
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('Test run crashed:', e);
  process.exit(1);
});
