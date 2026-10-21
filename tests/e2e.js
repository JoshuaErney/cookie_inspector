// End-to-end tests: the real popup, running as an extension in real Chromium, against real cookies.
// Run with `npm run test:e2e` (set HEADED=1 to watch).
'use strict';

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
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
  app.context.on('request', (r) => {
    if (!/^(chrome-extension|data|blob):/.test(r.url())) externalRequests.push(r.url());
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
