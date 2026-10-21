// Regenerates the popup screenshots used by the README and the website (graphic-assets/screenshots/main|detail|create|snapshots-light|dark.png).
// Run with `npm run screenshots`. Everything shown is made-up demo data in a throwaway Chromium profile.
'use strict';

const fs = require('fs');
const path = require('path');
const { launchExtension, REPO_ROOT } = require('./helpers');
const { seedDemo, openPopup, STATES, capturePopup } = require('./demo');

const OUT = path.join(REPO_ROOT, 'graphic-assets', 'screenshots');

(async () => {
  const app = await launchExtension();
  const page = await app.context.newPage();
  const cdp = await app.context.newCDPSession(page);
  await page.goto(app.popupUrl);
  await seedDemo(app, page);

  fs.mkdirSync(OUT, { recursive: true });
  for (const theme of ['light', 'dark']) {
    for (const name of ['main', 'detail', 'create', 'snapshots']) {
      await openPopup(app, page, theme);
      await STATES[name](page);
      fs.writeFileSync(path.join(OUT, `${name}-${theme}.png`), await capturePopup(cdp));
    }
  }

  await app.close();
  console.log(`Wrote screenshots to ${OUT}`);
})().catch((e) => {
  console.error('Screenshot run crashed:', e);
  process.exit(1);
});
