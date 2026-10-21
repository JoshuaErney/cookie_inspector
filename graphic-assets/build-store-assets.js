// Builds the Chrome Web Store images into graphic-assets/store/:
//   screenshots/store-1..5-*.png   five 1280x800 screenshots
//   promo-small-440x280.png        small promo tile (required by the store)
//   promo-marquee-1400x560.png     marquee promo tile (optional, needed to be featured)
//
// Run with `npm run assets`. The popup is captured live from the real extension with the same made-up
// demo data as `npm run screenshots` (tests/demo.js), then laid out here. The logo comes from
// graphic-assets/logo/icon.svg and the type is the bundled Inter font, so nothing is fetched from the network.
//
// Chrome's guidance for promo tiles is "avoid text", so the two tiles carry no words.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { launchExtension, REPO_ROOT } = require('../tests/helpers');
const { seedDemo, openPopup, STATES, capturePopup } = require('../tests/demo');

const OUT = path.join(REPO_ROOT, 'graphic-assets', 'store');
const SHOTS = path.join(OUT, 'screenshots');
const url = (...p) => pathToFileURL(path.join(REPO_ROOT, ...p)).href;
const ICON = url('graphic-assets', 'logo', 'icon.svg');

// ─── 1. Capture the popup (2x) in the states the images show ────────────────

async function capturePopups() {
  const app = await launchExtension();
  const page = await app.context.newPage();
  const cdp = await app.context.newCDPSession(page);
  await page.goto(app.popupUrl);
  await seedDemo(app, page);

  const out = {};
  // `cropTo`: cut the popup just below this element (for views that end well above the bottom of the popup).
  const grab = async (key, theme, state, cropTo) => {
    await openPopup(app, page, theme);
    await STATES[state](page);
    let height = 560;
    if (cropTo) {
      const bottom = await page.evaluate((sel) => document.querySelector(sel).getBoundingClientRect().bottom, cropTo.selector);
      height = Math.min(560, Math.ceil(bottom + cropTo.pad));
    }
    out[key] = { src: `data:image/png;base64,${(await capturePopup(cdp, height)).toString('base64')}`, height };
  };

  await grab('main-light', 'light', 'main');
  await grab('detail-light', 'light', 'detail');
  await grab('create-light', 'light', 'create', { selector: '.tab-manual .form-samesite', pad: 8 });
  await grab('snapshots-light', 'light', 'snapshots', { selector: '#snapshotList', pad: 22 });
  await grab('main-dark', 'dark', 'main');
  await grab('detail-dark', 'dark', 'detail');
  await app.close();
  return out;
}

// ─── 2. Layouts ─────────────────────────────────────────────────────────────

const font = (w) => `@font-face{font-family:Inter;font-weight:${w};src:url("${url('fonts', `inter-latin-${w}.woff`)}") format("woff")}`;
const BASE_CSS = `${[400, 500, 600, 700].map(font).join('')}
*{box-sizing:border-box}
html,body{margin:0;overflow:hidden}
body{position:relative;font-family:Inter,-apple-system,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
.logo{display:block;border-radius:22.9%;filter:drop-shadow(0 10px 22px rgba(18,20,100,.45))}`;

const INDIGO_BG = `radial-gradient(1000px 760px at 88% -5%, rgba(140,143,255,.95) 0%, rgba(140,143,255,0) 62%),
  radial-gradient(900px 600px at 72% 108%, rgba(50,52,190,.55) 0%, rgba(50,52,190,0) 70%), #5b5ef4`;
const DARK_BG = `radial-gradient(900px 620px at 85% 5%, rgba(84,88,210,.40) 0%, rgba(84,88,210,0) 70%), #0d1117`;

// 1280x800 store screenshot: logo, headline and a line of copy on the left, the real popup on the right.
function screenshotHtml({ dark, headline, body, popup }) {
  const w = 480; // the popup is 400 CSS px wide, shown at 1.2x
  const h = Math.round(popup.height * 1.2);
  const shadow = dark
    ? '0 30px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.10)'
    : '0 30px 70px rgba(20,22,110,.45), 0 8px 24px rgba(20,22,110,.25)';
  return `<!doctype html><meta charset="utf-8"><style>${BASE_CSS}
body{width:1280px;height:800px;background:${dark ? DARK_BG : INDIGO_BG}}
.copy{position:absolute;left:96px;top:0;bottom:0;width:570px;display:flex;flex-direction:column;justify-content:center}
.brand{display:flex;align-items:center;gap:14px;margin:0 0 26px -2px;font-size:26px;font-weight:600;letter-spacing:-.005em}
h1{margin:0 0 22px;font-size:58px;line-height:1.08;font-weight:700;letter-spacing:-.02em}
p{margin:0;font-size:28px;line-height:1.35;font-weight:400;color:rgba(255,255,255,.88)}
p b{font-weight:600;color:#fff}
.card{position:absolute;left:696px;top:${Math.round((800 - h) / 2)}px;width:${w}px;height:${h}px;border-radius:16px;overflow:hidden;box-shadow:${shadow}}
.card img{display:block;width:${w}px;height:${h}px}
</style>
<div class="copy">
  <div class="brand"><img class="logo" src="${ICON}" width="52" height="52" alt="">Cookie Inspector</div>
  <h1>${headline}</h1>
  <p>${body}</p>
</div>
<div class="card"><img src="${popup.src}" alt=""></div>`;
}

// 440x280 small promo tile: the logo and a few abstract cookie rows. No text.
function smallTileHtml() {
  const row = (x, y, a, b, pill) => `<div class="row" style="left:${x}px;top:${y}px">
    <i class="chip"></i><span><s style="width:${a}px"></s><s class="dim" style="width:${b}px"></s></span><u style="background:${pill}"></u></div>`;
  return `<!doctype html><meta charset="utf-8"><style>${BASE_CSS}
body{width:440px;height:280px;background:
  radial-gradient(360px 280px at 22% 48%, rgba(132,136,255,.75) 0%, rgba(132,136,255,0) 70%),
  linear-gradient(135deg,#202277 0%,#3639c9 55%,#5558ee 100%)}
.logo{position:absolute;left:40px;top:56px;width:168px;height:168px;filter:drop-shadow(0 14px 28px rgba(14,16,90,.55))}
.row{position:absolute;width:176px;height:48px;border-radius:12px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.26);
  box-shadow:0 8px 20px rgba(14,16,90,.28);display:flex;align-items:center;gap:10px;padding:0 12px}
.chip{flex:none;width:15px;height:15px;border-radius:50%;background:#f7b53d}
.row span{flex:1;display:flex;flex-direction:column;gap:6px}
.row s{display:block;height:7px;border-radius:4px;background:rgba(255,255,255,.92);text-decoration:none}
.row s.dim{height:6px;background:rgba(255,255,255,.45)}
.row u{flex:none;width:26px;height:14px;border-radius:7px}
</style>
<img class="logo" src="${ICON}" alt="">
${row(236, 52, 62, 84, '#f7b53d')}
${row(250, 116, 50, 66, '#b4b7ff')}
${row(236, 180, 70, 52, '#b4b7ff')}`;
}

// 1400x560 marquee promo tile: the logo, and the real popup in dark and light. No text.
function marqueeHtml(back, front) {
  const s = 0.8; // popup CSS px -> tile px
  const card = (p, left, top, dark) => `<div class="card" style="left:${left}px;top:${top}px;width:${400 * s}px;height:${Math.round(p.height * s)}px;${dark ? 'box-shadow:0 30px 70px rgba(10,12,70,.6),0 0 0 1px rgba(255,255,255,.12)' : ''}">
    <img src="${p.src}" alt=""></div>`;
  return `<!doctype html><meta charset="utf-8"><style>${BASE_CSS}
body{width:1400px;height:560px;background:
  radial-gradient(620px 520px at 24% 52%, rgba(132,136,255,.70) 0%, rgba(132,136,255,0) 70%),
  radial-gradient(700px 520px at 92% 0%, rgba(150,153,255,.55) 0%, rgba(150,153,255,0) 70%),
  linear-gradient(120deg,#1f2175 0%,#3437c4 52%,#5457ec 100%)}
.logo{position:absolute;left:230px;top:140px;width:280px;height:280px;filter:drop-shadow(0 22px 44px rgba(12,14,84,.6))}
.card{position:absolute;border-radius:14px;overflow:hidden;box-shadow:0 30px 70px rgba(10,12,70,.5),0 8px 24px rgba(10,12,70,.3)}
.card img{display:block;width:100%;height:100%}
</style>
<img class="logo" src="${ICON}" alt="">
${card(back, 660, 38, true)}
${card(front, 850, 84, false)}`;
}

// ─── 3. Render ──────────────────────────────────────────────────────────────

const SLIDES = [
  { file: 'store-1-this-site.png', popup: 'main-light', headline: 'Start with the site you’re on',
    body: 'Switch between <b>This site</b> and <b>All sites</b>. Search, sort, and filter by session, HttpOnly, insecure, or duplicate.' },
  { file: 'store-2-decode.png', popup: 'detail-light', headline: 'Decode values instantly',
    body: 'JSON, JWT, URL-encoded, and Base64 values are decoded right under the raw value.' },
  { file: 'store-3-create-edit.png', popup: 'create-light', headline: 'Create and edit cookies',
    body: 'Fill in each attribute, or paste JSON or Base64 to create many cookies at once.' },
  { file: 'store-4-snapshots.png', popup: 'snapshots-light', headline: 'Snapshot and restore',
    body: 'Save up to 10 copies of your cookies and put them back whenever you need them.' },
  { file: 'store-5-dark-offline.png', popup: 'main-dark', dark: true, headline: 'Light, dark, and fully offline',
    body: 'No accounts, no analytics, no network requests. Everything stays in your browser.' },
];

(async () => {
  const popups = await capturePopups();
  fs.mkdirSync(SHOTS, { recursive: true });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cookie-inspector-assets-'));
  const browser = await chromium.launch();
  const render = async (html, width, height, file) => {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const htmlFile = path.join(tmp, 'page.html');
    fs.writeFileSync(htmlFile, html);
    await page.goto(pathToFileURL(htmlFile).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width, height } });
    await page.close();
    console.log(`Wrote ${path.relative(REPO_ROOT, file)} (${width}x${height})`);
  };

  for (const s of SLIDES) {
    await render(screenshotHtml({ dark: !!s.dark, headline: s.headline, body: s.body, popup: popups[s.popup] }), 1280, 800, path.join(SHOTS, s.file));
  }
  await render(smallTileHtml(), 440, 280, path.join(OUT, 'promo-small-440x280.png'));
  await render(marqueeHtml(popups['detail-dark'], popups['main-light']), 1400, 560, path.join(OUT, 'promo-marquee-1400x560.png'));

  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch((e) => {
  console.error('Store image build crashed:', e);
  process.exit(1);
});
