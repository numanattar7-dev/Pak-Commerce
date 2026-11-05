# Pak Commerce Theme Package Format — `pakcommerce-theme@1`

A theme is a **ZIP archive** containing a required manifest and optional assets. Themes control **design only** — they never affect products, orders, customers, payments, courier settings or COD configuration.

## Layout

```
pakcommerce-theme.json          ← required manifest (root of the archive)
assets/*.png|jpg|jpeg|webp|woff2  ← optional static assets (stored in R2 if configured)
sections/*.json                 ← optional; must be valid JSON; reserved in v1 (not applied)
```

## Manifest (`pakcommerce-theme.json`)

```json
{
  "format": "pakcommerce-theme@1",
  "name": "Gulmarg Heritage",
  "description": "Classic emerald theme for unstitched fabrics",
  "version": "1.0.0",
  "config": {
    "theme": { "primary": "#059669", "accent": "#d97706" },
    "hero": { "title": "Premium unstitched", "ctaText": "Shop now" },
    "home": {
      "sections": [
        { "id": "home-hero", "type": "hero", "enabled": true, "settings": {}, "blocks": [] },
        { "id": "faq-1", "type": "faq", "enabled": true,
          "settings": { "heading": "Questions?" },
          "blocks": [ { "id": "b1", "enabled": true, "settings": { "question": "COD?", "answer": "Yes." } } ] }
      ]
    }
  }
}
```

### Manifest fields
| Field | Required | Rules |
|---|---|---|
| `format` | optional | Must be `pakcommerce-theme@1` when present |
| `name` | ✔ | 3–80 chars |
| `description` | optional | ≤ 500 chars |
| `version` | ✔ | semver-like `1.0.0` |
| `config` | ✔ | Design-only config object (see below) |

### `config` sections (all optional)
| Section | Notes |
|---|---|
| `branding` | `logoUrl`, `faviconUrl` (absolute path or http(s) URL), `tagline` ≤ 200 |
| `theme` | `primary`, `accent` — `#RRGGBB` |
| `announcement` | `enabled` (bool), `text` ≤ 280 |
| `hero` | `enabled`, `badge`/`title`/`subtitle`/`ctaText` ≤ 500, `ctaLink` (safe URL) |
| `sections` | `showFeatures` (bool), `featuredCount` 0–24, `aboutBlurb` ≤ 500 |
| `home` | `sections[]` — ordered homepage sections (see below); ≤ 30 sections |
| `header` | `menuLinks[]` ≤ 20 × `{label ≤ 80, href}` |
| `footer` | `quickLinks[]` ≤ 20, `aboutText` ≤ 2000, `social{…}`, `copyright` ≤ 200 |
| `payments` | `COD`/`IBFT`/`RAAST`/`JAZZCASH`/`EASYPAISA` booleans (toggles visibility only) |
| `checkout` | `confirmationMsg` ≤ 500, `allowNotes` (bool) |
| `seo` | `metaTitle` ≤ 200, `metaDescription` ≤ 300 |

### Home section types
`hero`, `features`, `featuredProducts` — content edited via the dedicated panels (settings ignored) · `richText` — `{heading, body, align: left|center}` · `imageWithText` — `{imageUrl, heading, body, ctaText, ctaLink, imageSide: left|right}` · `faq` — `{heading}` + up to 50 blocks `{question ≤ 500, answer ≤ 4000}`.
Sections may carry an `id` (2–80 chars `[a-z0-9-]`, unique, auto-generated if missing). All URLs must be absolute paths or `http(s)` — `javascript:`, `data:` and `vbscript:` are rejected.

## Limits & security
- ZIP ≤ 5 MB · ≤ 100 entries · ≤ 2 MB per file · ≤ 24 assets · ≤ 10 MB total assets
- Allowed file types: `.json`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.woff2`
- Path traversal (`../`, absolute, drive letters) and executable/script/HTML/SVG files are rejected
- JSON is parsed, never evaluated; unknown config sections are rejected
- Installing a theme never overwrites the published theme — imports always create an **UNPUBLISHED** theme
- Assets are stored opaquely in R2 (if configured) and never executed

## Installation flow
1. Upload ZIP → server validates → errors are listed verbatim (nothing is installed on failure)
2. Theme appears in **Online store → Themes** as `UNPUBLISHED`
3. Preview it (renders on the real storefront renderer) → **Publish** when ready — your previous theme stays in the library for one-click rollback
