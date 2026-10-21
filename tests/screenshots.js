// Regenerates the popup screenshots used by the README and the website (screenshots/main|detail|create|snapshots-light|dark.png).
// Run with `npm run screenshots`. Everything shown is made-up demo data in a throwaway Chromium profile.
'use strict';

const fs = require('fs');
const path = require('path');
const { launchExtension, REPO_ROOT } = require('./helpers');

const OUT = path.join(REPO_ROOT, 'screenshots');
const b64url = (s) => Buffer.from(s).toString('base64url');
const JWT = `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url('{"sub":"demo-user","name":"Demo User","role":"editor","iat":1767225600,"exp":1893456000}')}.c2lnbmF0dXJl`;
const PREFS = Buffer.from('{"theme":"dark","lang":"en","notifications":true}').toString('base64');

(async () => {
  const app = await launchExtension();
  const page = await app.context.newPage();
  const cdp = await app.context.newCDPSession(page);
  await page.goto(app.popupUrl);

  const day = 86400;
  const now = Math.floor(Date.now() / 1000);
  await page.evaluate(async ({ JWT, PREFS, now, day }) => {
    const set = (url, name, value, extra = {}) => chrome.cookies.set({ url, name, value, expirationDate: now + day * 30, ...extra });
    await set('https://www.example.com/', 'session_id', '9f2c61a07be44d58b1d3c0e5a7f84e12', { httpOnly: true, secure: true, expirationDate: undefined });
    await set('https://www.example.com/', 'auth_token', JWT, { httpOnly: true, secure: true, expirationDate: now + day * 7 });
    await set('https://www.example.com/', 'user_prefs', PREFS, { expirationDate: now + day * 365 });
    await set('https://www.example.com/', 'cart', '%7B%22items%22%3A2%2C%22currency%22%3A%22USD%22%7D', { expirationDate: now + day * 3 });
    await set('https://www.example.com/', 'consent', 'accepted', { domain: '.example.com', expirationDate: now + day * 180 });
    await set('https://www.example.com/', '_ga', 'GA1.2.1234567890.1700000000', { domain: '.example.com', expirationDate: now + day * 400 });
    await set('https://cdn.example.com/', 'asset_token', 'a1b2c3', { httpOnly: true, secure: true });
    await set('https://news.example.org/', 'edition', 'us');
    await set('https://shop.example.net/', 'cart_id', '48213', { httpOnly: true });
    await set('https://docs.example.dev/', 'theme', 'dark');
  }, { JWT, PREFS, now, day });

  // A fake website tab, so the popup opens on "This site". Served locally; no real network.
  await app.context.route('https://www.example.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<title>Example</title>' }));
  const site = await app.context.newPage();
  await site.goto('https://www.example.com/');

  const open = async (theme) => {
    await page.bringToFront();
    await page.evaluate((t) => chrome.storage.local.set({ theme: t }), theme);
    await page.goto(app.popupUrl);
    await page.waitForFunction(() => document.getElementById('stats').textContent !== 'Loading...');
    await page.mouse.move(390, 10);
    await page.waitForTimeout(250);
  };
  // The popup is a fixed 400x560 box; capture just that, at 2x for sharpness.
  const shot = async (name, theme) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 400, height: 560, scale: 2 } });
    fs.writeFileSync(path.join(OUT, `${name}-${theme}.png`), Buffer.from(data, 'base64'));
  };

  fs.mkdirSync(OUT, { recursive: true });
  for (const theme of ['light', 'dark']) {
    await open(theme);
    await shot('main', theme);

    const jwtRow = page.locator('.cookie-item:has(.cookie-name:text-is("auth_token"))');
    await jwtRow.locator('.btn-expand').click();
    await jwtRow.evaluate((el) => { el.scrollIntoView({ block: 'start' }); document.getElementById('cookieList').scrollTop -= 40; });
    await page.waitForTimeout(250);
    await shot('detail', theme);

    await open(theme);
    await page.click('#createToggle');
    await page.fill('.tab-manual .form-name', 'theme');
    await page.fill('.tab-manual .form-value', 'dark');
    await page.fill('.tab-manual .form-domain', 'www.example.com');
    await page.waitForTimeout(250);
    await shot('create', theme);

    await open(theme);
    await page.click('#settingsToggle');
    for (const label of ['Clean state', 'Before login test']) {
      await page.fill('#snapshotLabel', label);
      await page.click('#saveSnapshot');
      await page.waitForTimeout(1200); // different timestamps
    }
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(300);
    await shot('snapshots', theme);
    await page.evaluate(() => chrome.storage.local.remove('cookie_snapshots'));
  }

  await app.close();
  console.log(`Wrote screenshots to ${OUT}`);
})().catch((e) => {
  console.error('Screenshot run crashed:', e);
  process.exit(1);
});
