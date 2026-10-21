# Graphic assets

Every image in the project lives here.

| Folder | What it holds | Used by |
|---|---|---|
| `icons/` | Extension icons: 16, 32, 48 and 128 px | `manifest.json`. This is the only part of `graphic-assets/` that goes in the Chrome Web Store package. |
| `logo/` | Logo sources (SVG), 1024 px master, wordmark versions | See `logo/README.md`. |
| `screenshots/` | Popup screenshots in light and dark (8 files) | The README and the website. Regenerate with `npm run screenshots`. |
| `store/` | Chrome Web Store listing images and text | Upload in the developer dashboard. Regenerate with `npm run assets`. |

## Store images (`store/`)

| File | Size | Notes |
|---|---|---|
| `screenshots/store-1-this-site.png` to `store-5-dark-offline.png` | 1280 x 800 | The five listing screenshots (the store allows up to five). |
| `promo-small-440x280.png` | 440 x 280 | Small promo tile. Required. |
| `promo-marquee-1400x560.png` | 1400 x 560 | Marquee promo tile. Optional, but an extension can't be featured in the marquee without it. |
| `listing-description.txt` | | The store listing text. |

The promo tiles carry no text, following Chrome's "avoid text" guidance for promo images. All images are opaque PNGs.

`build-store-assets.js` builds the images (`npm run assets`). It captures the real popup with made-up demo data (the same data as `npm run screenshots`, kept in `tests/demo.js`), lays it out with the logo and the bundled Inter font, and writes the files above. To change a screenshot's headline or copy, edit `SLIDES` in that file. The times in the snapshot screenshot are the time you run it.
