# Cookie Inspector: pick-up-later notes

Written 2026-10-20 at the end of the code-review and bug-fix session. Read this first when you resume. It covers where things stand, what has been decided, what to build next and in what order, and the gotchas that cost time in this session.

## 1. Where things stand

| Item | State |
|---|---|
| Local repo | `~/Documents/GitHub/cookie_inspector` |
| GitHub | `https://github.com/JoshuaErney/cookie_inspector` |
| Store listing | https://chromewebstore.google.com/detail/cookie-inspector/hlkphfjopipfemagmodglbccjgbmhjkm (checked 2026-10-20: live, v2.0.0, updated May 1 2026, 3 users, no ratings; may have changed since) |
| Working branch | `fix/review-bugs`, 5 commits on top of `main` (`44437d0`) |
| Pushed? | **No.** The push was blocked in that session (see section 6). |
| Working tree | Clean when the notes were written (this file may be untracked) |
| Manifest version | `2.0.0`, same as the live listing. **Bump it before uploading a new package**; the store rejects a repeat version. |

Commits on `fix/review-bugs`, oldest first:

1. `a922b8e` Fix data-loss and reporting bugs found in code review
2. `c9fed04` Bundle Inter locally instead of loading it from Google Fonts
3. `4456dca` Fix privacy policy markup, contact link and storage wording
4. `819749e` Add end-to-end and decoder tests
5. `b2ce370` Link the live Chrome Web Store listing

**To push (run in your own terminal):**

```bash
cd ~/Documents/GitHub/cookie_inspector
git push -u origin fix/review-bugs
```

Then open a pull request into `main` when you are ready. Nothing has been merged to `main`. Do not merge or publish to the store until you have clicked through the branch in your own Chrome (section 5).

## 2. What the review session fixed

All of these were reproduced in a real Chromium before fixing, and the tests now cover them (the old code fails 15 of the new checks).

- **Edit lost data on a failed save.** The popup removed the old cookie before setting the new one. Now it sets first and removes the original only if the cookie's identity (name + domain + path) changed, with a clear error toast if the set fails.
- **Host-only cookies got duplicated on edit.** Passing `domain` to `chrome.cookies.set` turns a host-only cookie into a domain cookie and leaves the original behind. The code now sends `domain` only when it starts with ".".
- **Delete desync and duplicate ids.** Rows used cookie data in attributes and element ids. They now carry a numeric `data-i` index into `renderedCookies` (groups use `data-g`).
- **Secure cookies could not be overwritten** because the URL used `http://`. `getCookieUrl` now always uses `https://`.
- **Restore and Import reported success even when some cookies failed.** `setCookies` uses `Promise.allSettled` and returns `{ok, failed, firstError}`; `reportResult` turns that into an honest toast.
- **Snapshot save failed silently when storage was full.** It now shows "Snapshot not saved — browser storage is full…".
- **Constant re-rendering.** Every `onChanged` event rebuilt the whole list, which made the form wipe itself and made seeding 500 cookies take 43 s. Renders are now debounced (120 ms) and skipped while an edit form is open.
- **Search and list mismatch**, and **attribute breaking** with quotes in cookie values: fixed by the index-based rendering.
- **Decoder gaps.** Base64/base64url (strict UTF-8, control characters rejected), JWT (shows iat/nbf/exp plus "signature not verified"), URL-encoded, and JSON. Random token-like values are not mislabelled (seeded false-positive tests).
- **Partitioned (CHIPS) cookies** were missing because `getAll({})` omits them. `loadAllCookies` merges `getAll({})` and `getAll({partitionKey:{}})` and dedupes.
- **Google Fonts dependency removed.** Inter (SIL OFL 1.1, Latin subset, WOFF) is bundled in `fonts/` with `LICENSE.txt`, so the popup makes no network requests (verified by the e2e test).
- **Privacy policy / landing page.** Fixed the corrupted `tar`/`+get` attribute, added pinned domains to the storage description, contact now points to GitHub issues, "Last updated: October 2026".
- **Store link** added to the README and the landing page button.

## 3. Decisions already made (don't re-ask)

1. **Create form:** a domain typed *without* a leading dot makes a host-only cookie. Kept.
2. **Snapshot storage cap:** keep the 10 MB `chrome.storage.local` cap and the 10-snapshot limit. A temporary or paid way to expand it is a possible later idea, not planned.
3. **Clear Domain deletes every cookie for that domain**, not just the ones currently visible. Small follow-up: with a search active the group badge shows fewer cookies than will be deleted, so put the true count in the confirmation (and Undo covers mistakes).
4. **Restore gets both Merge and Replace.**
   - *Merge* (today's behavior): re-applies the snapshot's cookies, deletes nothing. Fix the README wording ("back to that state" is wrong for Merge).
   - *Replace*: also deletes the site's cookies that are not in the snapshot, behind a confirmation. It only makes sense for **per-domain** snapshots; Replace on a whole-browser snapshot would log the user out of every site not in it.
5. **Build order** (agreed): see section 4.
6. **Per-site permissions:** Joshua likes the idea, but it is **not decided**. Notes: it improves trust and review friction (the store currently warns about "all websites"), not performance; the performance win comes from the "This site" scope. The documented route is `optional_host_permissions` plus `chrome.permissions.request` from a click. `activeTab` was not confirmed to cover `chrome.cookies` (the docs available in that session did not mention cookies), so do not rely on it without checking current MV3 docs. Test the upgrade path for existing users (what happens to their current grant) before shipping. Treat it as its own step after the features below.

## 4. Roadmap, in the agreed order

Effort is a rough guess: S = small, M = medium.

1. **"This site / All" toggle (S).** Default scope becomes the current tab's site (cookies whose domain matches the tab hostname or a parent domain); "All" is today's view. Biggest practical win: most opens are about one site, and rendering drops from ~0.6 s at 3,000 cookies to near-instant. Fall back to All on tabs with no site (new tab, `chrome://`). Fits well with optional host permissions later.
2. **Undo for deletes (S–M).** Keep removed cookies in memory for ~10 s and show "Deleted N cookies — Undo"; undo re-creates them with `toSetDetails`. Replaces confirmation dialogs and backs up Clear Domain. Closing the popup loses the undo unless it is held in `chrome.storage.session`.
3. **Cookie size display (S).** Bytes per cookie, per domain and in total, with sort-by-size. Helps diagnose "431 / Request Header Too Large" (browsers cap a single cookie around 4 KB; servers often reject a combined `Cookie` header somewhere around 8 KB, varies by server). Most useful together with "This site".
4. **`cookies.txt` export and "Copy as cURL" (S).** Netscape format for `curl -b` / `wget` / `yt-dlp` (HttpOnly lines use the `#HttpOnly_` prefix). Add a one-line warning that the output contains live session tokens.
5. **Per-domain snapshots with Merge and Replace (M).** Add a `domain` field to snapshots; existing snapshots stay "all sites". Snapshots shrink from MBs to KBs. Replace limited to per-domain snapshots (decision 4).
6. **Import preview (M).** Before applying: "N new, N overwrite existing, N invalid (with reasons)" plus affected domains, then confirm. Reuse `validateCookie`.
7. **Smarter security flags (M, needs design).** Today every cookie without HttpOnly gets the `warning-bg` row class and a "No HttpOnly" label (`cookieEditor.js` ~L558–563), and the filters `no-httponly` / `insecure` sit near L642. That flags analytics and consent cookies that scripts are meant to read, so users will learn to ignore it. Better: flag missing HttpOnly only on cookies that look like sessions or auth tokens, add `__Host-` / `__Secure-` misuse and similar checks, and label them "heuristic" (a false "looks fine" is worse than no flag).

## 5. Other open items

For Joshua to do:

- Push the branch (section 1).
- `npm install` locally and commit the generated `package-lock.json` (it could not be generated in the sandbox).
- Load the branch unpacked in your own Chrome (`chrome://extensions` → Developer mode → Load unpacked) and click through edit, delete, import, restore and snapshot save. The tests only ran in headless Chromium.
- Bump `version` in `manifest.json` before building a store package, and confirm the privacy-policy URL on the listing is the hosted `privacy-policy.html`.

Known gaps and backlog:

- Per-render cost is unchanged (~0.5–0.65 s at 3,000 cookies, ~114k DOM nodes). Options: lazy-render the detail panels, or virtualize the list.
- Stats line says "1 cookies" (pluralization).
- README says Restore goes "back to that state" (true only for Replace).
- Accessibility pass (keyboard, labels, contrast), incognito (`storeId`) support, CSP `style-src` hardening, WOFF2 fonts (brotli was unavailable), splitting `cookieEditor.js` (915 lines) into modules.

## 6. Technical notes and gotchas

**Code facts worth remembering**

- Chrome's `cookie.domain` has a leading "." for domain cookies and none for host-only cookies. That drives `toSetDetails`.
- Cookie identity is `cookieKey(c)` = partition site + domain + path + name. Use it, not the name, for matching and dedupe.
- `chrome.storage.local` keys: `cookie_snapshots`, `pinned_domains`, `theme`. Snapshot limit is 10 (`snapshots.length >= 10`).
- Manifest: `permissions: ["cookies","storage"]`, `host_permissions: ["<all_urls>"]`, CSP `script-src 'self'; object-src 'self'`.
- `tests/decode.test.js` extracts code between the comment `// Decoding for the detail panel` and the line `  const debounce` in `cookieEditor.js`. If you rename or move either marker, update the test.
- The popup is the whole extension: `cookieEditor.html` / `.css` / `.js`. `index.html` and `privacy-policy.html` are the GitHub Pages site and are not part of the package.

**Running things**

```bash
npm install
npx playwright install chromium
npm test              # 37 decoder checks, then 50 end-to-end checks
npm run test:decode
npm run test:e2e      # HEADED=1 to watch
```

The e2e tests copy the repo to a temp folder, give the copy a generated manifest `key` for a stable extension id, and launch full Chromium (`channel: 'chromium'`; the headless shell cannot load extensions). They assert zero network requests outside `chrome-extension:`, `data:` and `blob:`.

Store package contents: `manifest.json`, `cookieEditor.html`, `cookieEditor.css`, `cookieEditor.js`, `fonts/`, `icons/`. Nothing else.

**Environment gotchas for the next Claude session**

- The cloud sandbox cannot reach `registry.npmjs.org` or GitHub raw hosts (proxy 403). The shell on Joshua's machine (a Linux VM mounted at `$HOME/mnt/cookie_inspector`) has no outbound network either, and `git push` from it fails with a 403 from the proxy. The `add_repo` route needs his GitHub account linked in claude.ai, and the cloud `gh` token was invalid. **Pushing will not work from a session until the GitHub account is linked; otherwise he runs the push himself.**
- The device shell cannot delete files unless `device_request_delete_permission` is granted for the session. If git commands leave `.lock` or `tmp_obj_*` files, that is why.
- No git identity is configured on the device. Commits were made with `git -c user.name="Joshua Erney" -c user.email="joshuaerney@icloud.com"` (no config changed), with the `Co-Authored-By` and `Claude-Session` trailers.
- Never push without being asked. Push to a branch, not `main`.

## 7. Starter message for the next session

> Resume Cookie Inspector from `NEXT_STEPS.md` (also in the Cookie Inspector project). Check whether `fix/review-bugs` has been pushed, then start on roadmap item 1, the "This site / All" toggle, on a new branch off `fix/review-bugs`. Keep the existing tests passing and add tests for the new behavior.
