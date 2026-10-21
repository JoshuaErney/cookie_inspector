// Unit tests for the "This site" scope: which URLs count as a site, and which cookies apply to it.
// The helpers live inside cookieEditor.js; this file pulls that block out and runs it in Node.
'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'cookieEditor.js'), 'utf8');
const START = '// Site scope:';
const END = '// End of site scope';
const from = source.indexOf(START);
const to = source.indexOf(END, from);
if (from < 0 || to < 0) {
  console.error(`Could not find the site scope block in cookieEditor.js (looking for "${START}" ... "${END}"). Update tests/scope.test.js.`);
  process.exit(1);
}
const block = source.slice(from, to);
const { siteFromUrl, cookieMatchesSite } = new Function('chrome', `${block}\nreturn { siteFromUrl, cookieMatchesSite };`)({});
// getActiveSite talks to chrome.tabs, so each case below builds it against a stand-in `chrome`.
const getActiveSiteWith = (chromeStub) => new Function('chrome', `${block}\nreturn getActiveSite;`)(chromeStub);

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? `  — ${JSON.stringify(detail)}` : ''}`);
};

// ---- siteFromUrl: only http(s) pages have a site
check('https URL -> hostname', siteFromUrl('https://www.example.com/a/b?x=1#y') === 'www.example.com');
check('http URL -> hostname', siteFromUrl('http://example.com/') === 'example.com');
check('port is not part of the hostname', siteFromUrl('http://localhost:3000/app') === 'localhost');
check('hostname is lower-cased', siteFromUrl('https://WWW.Example.COM/') === 'www.example.com');
check('IPv4 address', siteFromUrl('http://127.0.0.1:8080/') === '127.0.0.1');
check('IPv6 address loses its brackets', siteFromUrl('http://[::1]:8080/') === '::1');
check('internationalised hostname is punycode', siteFromUrl('https://bücher.example/') === 'xn--bcher-kva.example');
check('chrome:// page has no site', siteFromUrl('chrome://extensions/') === null);
check('about:blank has no site', siteFromUrl('about:blank') === null);
check('file: URL has no site', siteFromUrl('file:///Users/me/index.html') === null);
check('extension page has no site', siteFromUrl('chrome-extension://abcdefghijklmnopabcdefghijklmnop/cookieEditor.html') === null);
check('data: URL has no site', siteFromUrl('data:text/html,hi') === null);
check('ftp: URL has no site', siteFromUrl('ftp://example.com/') === null);
check('garbage has no site', siteFromUrl('not a url') === null);
check('undefined (no tab URL available) has no site', siteFromUrl(undefined) === null);
check('empty string has no site', siteFromUrl('') === null);

// ---- cookieMatchesSite
const match = (domain, host) => cookieMatchesSite({ domain }, host);

// Domain cookies (leading dot): the host itself and every subdomain
check('domain cookie matches its own host', match('.example.com', 'example.com'));
check('domain cookie matches a subdomain', match('.example.com', 'www.example.com'));
check('domain cookie matches a deep subdomain', match('.example.com', 'a.b.example.com'));
check('domain cookie does not match a sibling site', !match('.example.com', 'example.org'));
check('domain cookie does not match a parent of its domain', !match('.www.example.com', 'example.com'));
check('domain cookie does not match a subdomain\'s sibling', !match('.api.example.com', 'www.example.com'));
check('domain cookie does not match a lookalike suffix (label boundary)', !match('.cope.test', 'www.scope.test'));
check('domain cookie does not match a lookalike prefix', !match('.example.com', 'example.com.evil.test'));
check('domain cookie does not match the bare suffix text', !match('.xample.com', 'example.com'));

// Host-only cookies (no dot): exactly that host
check('host-only cookie matches its exact host', match('www.example.com', 'www.example.com'));
check('host-only cookie is not sent to a subdomain', !match('example.com', 'www.example.com'));
check('host-only cookie is not sent to the parent', !match('www.example.com', 'example.com'));
check('host-only cookie does not match a lookalike suffix', !match('cope.test', 'scope.test'));
check('host-only localhost', match('localhost', 'localhost'));
check('host-only IPv4', match('127.0.0.1', '127.0.0.1'));
check('host-only IPv6', match('::1', '::1'));
check('host-only IPv4 does not match another address', !match('127.0.0.1', '127.0.0.2'));

check('cookie domain case does not matter', match('.EXAMPLE.com', 'www.example.com'));

// ---- getActiveSite
(async () => {
  const queries = [];
  const stub = ({ self, tabs }) => ({
    tabs: {
      getCurrent: async () => self,
      query: async (q) => { queries.push(q); return typeof tabs === 'function' ? tabs(q) : tabs; },
    },
  });

  // Toolbar popup: no current tab; the active tab of the current window is the site
  queries.length = 0;
  let site = await getActiveSiteWith(stub({ self: undefined, tabs: [{ id: 5, url: 'https://www.example.com/page' }] }))();
  check('popup: uses the active tab of the current window', site === 'www.example.com' && queries.length === 1 && queries[0].active === true && queries[0].currentWindow === true, queries);
  check('popup on a chrome:// page: no site', (await getActiveSiteWith(stub({ self: undefined, tabs: [{ id: 5, url: 'chrome://extensions/' }] }))()) === null);
  check('popup where the tab URL is hidden: no site', (await getActiveSiteWith(stub({ self: undefined, tabs: [{ id: 5 }] }))()) === null);
  check('popup with no tab at all: no site', (await getActiveSiteWith(stub({ self: undefined, tabs: [] }))()) === null);

  // Page open in a tab of its own: skip itself, take the most recently used other tab in its window
  queries.length = 0;
  site = await getActiveSiteWith(stub({
    self: { id: 2, windowId: 7 },
    tabs: [
      { id: 1, url: 'about:blank',               lastAccessed: 10 },
      { id: 2,                                   lastAccessed: 99 }, // this page: most recent, but must be skipped
      { id: 3, url: 'https://old.example.com/', lastAccessed: 20 },
      { id: 4, url: 'https://new.example.com/', lastAccessed: 30 },
    ],
  }))();
  check('own tab: picks the most recently used other tab', site === 'new.example.com', site);
  check('own tab: only looks at its own window', queries.length === 1 && queries[0].windowId === 7, queries);
  check('own tab: most recent other tab has no site -> no site',
    (await getActiveSiteWith(stub({ self: { id: 2, windowId: 7 }, tabs: [{ id: 1, url: 'https://a.test/', lastAccessed: 1 }, { id: 3, url: 'chrome://extensions/', lastAccessed: 2 }] }))()) === null);
  check('own tab with no other tabs: no site', (await getActiveSiteWith(stub({ self: { id: 2, windowId: 7 }, tabs: [{ id: 2, lastAccessed: 1 }] }))()) === null);

  check('chrome.tabs failing: no site, no exception', (await getActiveSiteWith({ tabs: { getCurrent: async () => { throw new Error('boom'); }, query: async () => [] } })()) === null);

  if (failures) {
    console.log(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll scope checks passed');
})();

