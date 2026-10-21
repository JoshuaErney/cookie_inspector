// Unit tests for the cookie value decoder (JSON, JWT, URL-encoded, Base64/Base64url).
// The decoder lives inside cookieEditor.js; this file pulls that block out and runs it in Node.
'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'cookieEditor.js'), 'utf8');
const START = '// Decoding for the detail panel';
const END = '  const debounce';
const from = source.indexOf(START);
const to = source.indexOf(END, from);
if (from < 0 || to < 0) {
  console.error(`Could not find the decoder block in cookieEditor.js (looking for "${START}" ... "${END}"). Update tests/decode.test.js.`);
  process.exit(1);
}
const { tryDecode } = new Function(`${source.slice(from, to)}\nreturn { tryDecode };`)();

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? `  — ${JSON.stringify(detail)}` : ''}`);
};
const typeOf = (value) => tryDecode(value)?.type ?? null;

// ---- Values that should decode
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64url');
const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYiLCJleHAiOjE5MDAwMDAwMDB9.c2ln';

check('JSON object', typeOf('{"a":1}') === 'JSON');
check('JSON array', typeOf('[1,2,3]') === 'JSON');
check('JWT', typeOf(jwt) === 'JWT');
check('JWT output shows the exp claim and warns the signature is unchecked',
  /exp: /.test(tryDecode(jwt).data) && /signature not verified/.test(tryDecode(jwt).data));
check('Base64 text', typeOf(b64('Hello World, this is a cookie')) === 'Base64');
check('Base64 text containing a newline', typeOf(b64('line1\nline2 and more')) === 'Base64');
check('Base64 JSON', typeOf(b64('{"a":1}')) === 'Base64 JSON');
check('Base64 JSON with non-ASCII (UTF-8)', typeOf(b64('{"name":"José"}')) === 'Base64 JSON');
check('base64url JSON (no padding, - and _)', typeOf(b64url('{"user":"jose","role":"admin","pad":"??>>"}')) === 'Base64 JSON');
check('URL-encoded JSON', typeOf('%7B%22a%22%3A1%7D') === 'URL-encoded JSON');
check('URL-encoded text', typeOf('hello%20world%21') === 'URL-encoded');

// ---- Values that must NOT be labelled as decoded
const plain = [
  '1', '0', 'true', 'false', 'null', '"quoted"', 'en-US', 'GA1.2.123456789.1234567890', '1700000000',
  'abcdefghijkl', 'password', 'Standard', 'session', 'cookieconsent', 'accepted', 'necessary,analytics',
  '550e8400-e29b-41d4-a716-446655440000', '0123456789abcdef0123456789abcdef', 'dGVzdA', 'Mozilla', '',
];
plain.forEach((value) => check(`not decoded: ${JSON.stringify(value)}`, tryDecode(value) === null, tryDecode(value)));

// ---- Random token-like values (seeded, so the result is reproducible)
let seed = 0x2f6e2b1;
const rand = () => { // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const token = (alphabet, length) => Array.from({ length }, () => alphabet[Math.floor(rand() * alphabet.length)]).join('');
const falsePositives = (alphabet, length, runs = 2000) => {
  let hits = 0;
  for (let i = 0; i < runs; i++) if (tryDecode(token(alphabet, length))) hits++;
  return hits;
};

check('random 32-char alphanumeric tokens: none decoded', falsePositives(ALNUM, 32) === 0);
check('random 22-char base64url tokens: none decoded', falsePositives(ALNUM + '-_', 22) === 0);
check('random 40-char hex tokens: none decoded', falsePositives('0123456789abcdef', 40) === 0);
check('random 16-char alphanumeric tokens: none decoded', falsePositives(ALNUM, 16) === 0);
check('random 12-char alphanumeric tokens: at most 0.2% decoded', falsePositives(ALNUM, 12) <= 4);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll decoder checks passed');
process.exit(failures ? 1 : 0);
