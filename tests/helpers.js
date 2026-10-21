// Test helpers: launch real Chromium with the extension loaded from a temporary copy of this repo.
'use strict';

const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
// The temporary copy mirrors what ships in the Chrome Web Store package (README, "Packaging"):
// no dev folders, and inside graphic-assets/ only icons/ (the rest are screenshots and marketing images).
const SKIP = new Set(['.git', 'node_modules', 'tests']);
function shipsInPackage(src) {
  const rel = path.relative(REPO_ROOT, src);
  if (SKIP.has(rel)) return false;
  const [top, sub] = rel.split(path.sep);
  return !(top === 'graphic-assets' && sub !== undefined && sub !== 'icons');
}

// Chrome derives an extension's id from its public key, so we give the temporary copy a
// freshly generated key. That makes the id known up front and independent of the file path.
function extensionIdFromKey(der) {
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 32)
    .split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

async function launchExtension() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cookie-inspector-test-'));
  const extDir = path.join(tmp, 'extension');

  fs.cpSync(REPO_ROOT, extDir, { recursive: true, filter: shipsInPackage });

  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const manifestPath = path.join(extDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.key = der.toString('base64');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // A page with no scripts: used to change cookies from outside the popup (extension pages can use chrome.cookies).
  fs.writeFileSync(path.join(extDir, 'blank.html'), '<!doctype html><title>blank</title>');

  const id = extensionIdFromKey(der);
  const context = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
    channel: 'chromium', // full Chromium in new headless mode; the headless shell cannot load extensions
    headless: !process.env.HEADED,
    args: [
      `--disable-extensions-except=${extDir}`,
      `--load-extension=${extDir}`,
      '--disable-background-networking',
      '--no-first-run',
    ],
  });

  return {
    context,
    id,
    popupUrl: `chrome-extension://${id}/cookieEditor.html`,
    blankUrl: `chrome-extension://${id}/blank.html`,
    async close() {
      await context.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

module.exports = { launchExtension, REPO_ROOT };
