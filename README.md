# 🍪 Cookie Inspector

A clean, offline-first Chrome extension for inspecting, decoding, and managing browser cookies — with dark mode, live updates, snapshots, and import/export.

<!-- Chrome Web Store badge — add once approved -->
<!-- [![Chrome Web Store](https://img.shields.io/chrome-web-store/v/EXTENSION_ID)](https://chrome.google.com/webstore/detail/EXTENSION_ID) -->

> **Chrome Web Store listing coming soon.**

---

## Screenshots

![Banner](screenshots/banner-image.png)

**Cookie Inspector — Main View**
View and search all cookies grouped by domain, with security indicators and expandable detail panels.

<table>
  <tr>
    <td align="center"><strong>Light Mode</strong></td>
    <td align="center"><strong>Dark Mode</strong></td>
  </tr>
  <tr>
    <td><img src="screenshots/cookie-inspector-main-light.png" alt="Main view – light mode" /></td>
    <td><img src="screenshots/cookie-inspector-main-dark.png" alt="Main view – dark mode" /></td>
  </tr>
</table>

**Snapshots**
Save up to 10 point-in-time copies of your cookies and restore them at any time.

<table>
  <tr>
    <td align="center"><strong>Light Mode</strong></td>
    <td align="center"><strong>Dark Mode</strong></td>
  </tr>
  <tr>
    <td><img src="screenshots/snapshot-feature-light.png" alt="Snapshots – light mode" /></td>
    <td><img src="screenshots/snapshot-feature-dark.png" alt="Snapshots – dark mode" /></td>
  </tr>
</table>

**Snapshot Management**
Manage your saved snapshots — view when each was taken, how many cookies it contains, and restore or delete with one click.

<table>
  <tr>
    <td align="center"><strong>Light Mode</strong></td>
    <td align="center"><strong>Dark Mode</strong></td>
  </tr>
  <tr>
    <td><img src="screenshots/snapshot-feature2-light.png" alt="Snapshot management – light mode" /></td>
    <td><img src="screenshots/snapshot-feature2-dark.png" alt="Snapshot management – dark mode" /></td>
  </tr>
</table>

---

## Features

### Cookie Inspection

View every cookie stored in your browser, grouped by domain. A stats bar shows the total count and number of domains at a glance. The list updates in real time as websites set or remove cookies while the popup is open — no need to close and reopen.

### Cookie Detail Panel

Expand any cookie with the chevron to reveal its full metadata — raw value, path, secure flag, HttpOnly, SameSite policy, expiration date, and host-only status. If the cookie value is JSON or Base64 encoded, the decoded output is shown automatically.

### Cookie Creation & Editing

- **Manual form** — create a cookie field-by-field with full control over every attribute
- **JSON / Base64 paste** — paste a cookie object, an array of cookies, or Base64-encoded JSON to create one or many cookies at once
- **Inline editing** — expand any cookie and click Edit to modify its fields directly in the detail panel

### Filtering & Sorting

Filter the cookie list by attribute using quick-select chips:

- **All** — show everything
- **Session** — cookies with no expiration date
- **No HttpOnly** — cookies accessible to JavaScript (potential XSS risk)
- **Insecure** — cookies without the Secure flag
- **Duplicate** — cookies whose name appears on more than one domain

Sort domain groups by: **Domain A–Z**, **Name A–Z**, **Expiry**, or **Cookie Count**.

### Security Indicators

- Cookies missing the `HttpOnly` flag show a **No HttpOnly** label with an amber left border
- Cookies whose name appears on multiple domains show a **Duplicate** label
- The **Insecure** filter surfaces cookies missing the Secure flag

### Domain Pinning

Pin any domain to keep it anchored at the top of the list, regardless of the active sort order. Pin state is saved across sessions.

### Cookie Management

- **Delete** — remove any individual cookie instantly
- **Clear Domain** — bulk delete all cookies for a domain in one click
- **Make Session-Only** — strip expiration dates from all cookies under a domain

### Snapshots

Save up to 10 named, point-in-time copies of all your cookies. Each snapshot records when it was taken and how many cookies it contains. Restore any snapshot to bring your cookies back to that state, or delete ones you no longer need.

### Export & Import

Export all current cookies to a timestamped JSON file for backup or transfer. Import a previously exported file to restore cookies across sessions or devices.

### Dark Mode

Automatically respects your system's dark/light preference. Toggle manually at any time using the theme button in the header — your preference is saved across sessions.

### Privacy First

Cookie Inspector is entirely offline. No data is ever collected, transmitted, or shared. All storage is local to your browser.

---

## Installation

### From the Chrome Web Store

> Coming soon — link will be added once approved.

### Manual (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the project folder

---

## Development

No build step required. Edit the source files directly and click the refresh icon on the extension card in `chrome://extensions/` to reload.

```
cookie_inspector/
├── manifest.json         # Extension config and permissions
├── cookieEditor.html     # Popup UI
├── cookieEditor.js       # All application logic
├── cookieEditor.css      # Styles and theme tokens
├── privacy-policy.html   # GitHub Pages privacy policy
├── screenshots/          # Screenshots used in this README
└── icons/                # Extension icons (16px, 32px, 48px, 128px)
```

---

## License

MIT

---

<p align="center">
  Built by <a href="https://github.com/joshuaerney">@joshuaerney</a>
</p>
