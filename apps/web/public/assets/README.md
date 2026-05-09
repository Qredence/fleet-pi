# Brand Assets

Static brand assets served by Vite from `apps/web/public/assets/`.  
All files in this directory are served at `/assets/…` with no bundling step.

> **Placeholder notice** — files marked ⚠️ are build-time stubs.  
> Replace them with production-quality artwork before shipping.

---

## Directory structure

```
assets/
├── logo/
│   ├── logo.svg                        Fleet Pi logo — light / default variant
│   └── logo-dark.svg                   Fleet Pi logo — dark-background variant
├── icons/
│   ├── logo-qredence-light-192.png     Qredence icon 192 × 192 px  (light, any purpose)
│   ├── logo-qredence-light-512.png     Qredence icon 512 × 512 px  (light, any purpose)
│   ├── logo-qredence-dark-192.png      Qredence icon 192 × 192 px  (dark, maskable)
│   └── logo-qredence-dark-512.png      Qredence icon 512 × 512 px  (dark, maskable)
└── social/
    ├── logo-fleet-pi-light.svg         Fleet Pi logo — light variant (SVG)
    ├── logo-fleet-pi-light.png         Fleet Pi logo — light variant (PNG)
    ├── logo-fleet-pi-dark.svg          Fleet Pi logo — dark variant (SVG)
    └── logo-fleet-pi-dark.png          Fleet Pi logo — dark variant (PNG)
```

> `favicon.ico` (64/32/24/16 px multi-size) lives at `apps/web/public/favicon.ico`  
> (browsers expect it at the root `/favicon.ico`).

---

## File specs

### `logo/`

| File            | Format | Notes                                    |
| --------------- | ------ | ---------------------------------------- |
| `logo.svg`      | SVG    | Primary Fleet Pi logo, light variant     |
| `logo-dark.svg` | SVG    | Fleet Pi logo for dark/black backgrounds |

### `icons/`

| File                          | Format | Size         | Purpose                                 |
| ----------------------------- | ------ | ------------ | --------------------------------------- |
| `logo-qredence-light-192.png` | PNG    | 192 × 192 px | PWA manifest `any` (light theme)        |
| `logo-qredence-light-512.png` | PNG    | 512 × 512 px | PWA manifest `any` (light theme)        |
| `logo-qredence-dark-192.png`  | PNG    | 192 × 192 px | PWA manifest `maskable` (dark/adaptive) |
| `logo-qredence-dark-512.png`  | PNG    | 512 × 512 px | PWA manifest `maskable` (dark/adaptive) |

`purpose: maskable` icons should have a safe zone — keep the logo within the inner 80% of the canvas so adaptive icon shapes don't clip it.

### `social/`

| File                      | Format | Notes                                    |
| ------------------------- | ------ | ---------------------------------------- |
| `logo-fleet-pi-light.svg` | SVG    | Fleet Pi logo, light — for embeds / docs |
| `logo-fleet-pi-light.png` | PNG    | Raster version of above                  |
| `logo-fleet-pi-dark.svg`  | SVG    | Fleet Pi logo, dark — for embeds / docs  |
| `logo-fleet-pi-dark.png`  | PNG    | Raster version of above                  |

For OG / Twitter card images (1200 × 630 px), add `og-image.png` and `twitter-card.png` here and wire up the corresponding `<meta>` tags in `apps/web/src/routes/__root.tsx`.

---

## Usage in code

Reference assets as absolute paths — Vite copies `public/` verbatim to the build output:

```html
<!-- SVG logo -->
<img src="/assets/logo/logo.svg" alt="Fleet Pi" />

<!-- Raster icon -->
<img src="/assets/icons/logo-qredence-light-192.png" alt="Qredence" />
```

In TSX/JSX:

```tsx
<img
  src="/assets/social/logo-fleet-pi-dark.svg"
  alt="Fleet Pi"
  className="h-8 w-auto"
/>
```
