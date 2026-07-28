---
version: alpha
name: Fleet Pi
description: A local browser workspace for Pi-powered coding agents — calm chrome, loud tool output.
colors:
  # ─── Core semantic tokens (OKLCH, chroma-0 neutral palette) ───
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  secondary: "oklch(0.97 0 0)"
  secondary-foreground: "oklch(0.205 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  accent: "oklch(0.97 0 0)"
  accent-foreground: "oklch(0.205 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  destructive-foreground: "oklch(0.505 0.213 27.325)"
  success: "oklch(0.55 0.12 145)"
  success-foreground: "oklch(0.35 0.08 145)"
  warning: "oklch(0.7 0.14 75)"
  warning-foreground: "oklch(0.45 0.1 75)"
  info: "oklch(0.55 0.08 240)"
  info-foreground: "oklch(0.4 0.06 240)"
  border: "oklch(0.922 0 0)"
  input: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  sidebar: "oklch(0.985 0 0)"
  sidebar-foreground: "oklch(0.145 0 0)"
  sidebar-primary: "oklch(0.205 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.145 0 0)"
  # ─── Dark mode overrides ───
  dark:
    background: "oklch(0.145 0 0)"
    foreground: "oklch(0.985 0 0)"
    primary: "oklch(0.922 0 0)"
    primary-foreground: "oklch(0.205 0 0)"
    secondary: "oklch(0.269 0 0)"
    secondary-foreground: "oklch(0.985 0 0)"
    muted: "oklch(0.269 0 0)"
    muted-foreground: "oklch(0.708 0 0)"
    accent: "oklch(0.269 0 0)"
    accent-foreground: "oklch(0.985 0 0)"
    destructive: "oklch(0.704 0.191 22.216)"
    destructive-foreground: "oklch(0.85 0.12 22)"
    success: "oklch(0.72 0.14 145)"
    success-foreground: "oklch(0.85 0.1 145)"
    warning: "oklch(0.78 0.12 75)"
    warning-foreground: "oklch(0.88 0.08 75)"
    info: "oklch(0.72 0.1 240)"
    info-foreground: "oklch(0.85 0.06 240)"
    border: "oklch(1 0 0 / 10%)"
    input: "oklch(1 0 0 / 15%)"
    ring: "oklch(0.556 0 0)"
    sidebar: "oklch(0.205 0 0)"
    sidebar-foreground: "oklch(0.985 0 0)"
    sidebar-primary: "oklch(0.205 0 0)"
    card: "oklch(0.205 0 0)"
    card-foreground: "oklch(0.985 0 0)"
    popover: "oklch(0.205 0 0)"
    popover-foreground: "oklch(0.985 0 0)"
  # ─── Agent-elements action accent (hex bridge namespace) ───
  action:
    light: "#3b82f6"
    dark: "#60a5fa"
    note: "Used for send button, focus outlines, and interactive agent-elements highlights. Not a general brand color — scoped to agent chat actions only."
typography:
  display:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  title:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "normal"
  variableFontSettings:
    normal: "'wght' 400, 'opsz' 14"
    medium: "'wght' 450, 'opsz' 15"
    semibold: "'wght' 550, 'opsz' 20"
    bold: "'wght' 700, 'opsz' 25"
rounded:
  sm: "calc(0.625rem * 0.6)"
  md: "calc(0.625rem * 0.8)"
  lg: "0.625rem"
  xl: "calc(0.625rem * 1.4)"
  pill: "9999px"
  field-control: "7px"
  section-surface: "12px"
  row-surface: "4px"
  tool-card: "10px"
  message-bubble: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  section: "24px"
motion:
  fast:
    enter: "spring, 80ms, bounce 0"
    exit: "60ms"
  moderate:
    enter: "spring, 160ms, bounce 0"
    exit: "120ms"
  slow:
    enter: "spring, 240ms, bounce 0.12"
    exit: "160ms"
  css-transition: "150–300ms ease for color/border/shadow; 220ms cubic-bezier for discrete-tab label expand"
  reduced-motion: "All keyframe animations and spring transitions must be disabled under prefers-reduced-motion: reduce"
layout:
  breakpoint-desktop: "960px"
  header-height: "36px"
  header-offset: "12px"
  panel-default-ratio: 0.5
  panel-max-ratio: 0.7
  panel-mobile-width: "min(360px, calc(100vw - 1.5rem))"
components:
  # ─── Buttons & Actions ─────────────────────────────────────────────────
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
    height: "32px"
    typography: "{typography.body}"
    fontWeight: "medium"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    opacity: "80%"
    transition: "background-color 150ms ease, opacity 150ms ease"
  button-primary-focus:
    ring: "3"
    ringColor: "{colors.ring}"
    ringOpacity: "50%"
  button-primary-disabled:
    opacity: "50%"
    cursor: "not-allowed"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    rounded: "{rounded.lg}"
  send-button:
    backgroundColor: "{colors.action.light}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    size: "circular"
    darkBackgroundColor: "{colors.action.dark}"
    darkTextColor: "#0a0a0a"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}/40"
    rounded: "{rounded.md}"
    size: "28px"
    hoverBackground: "{colors.foreground}/6"
  
  # ─── Navigation & Chrome ─────────────────────────────────────────────────
  header-pill:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.foreground}/55%"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
    border: "{colors.border}/70%"
    shadow: "shadow-sm"
    backdropFilter: "blur"
    typography: "{typography.label}"
  header-pill-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}/75%"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  header-pill-hover:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}/75%"
    transition: "background-color 150ms ease"
  discrete-tab-inactive:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.foreground}/55%"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
    shadow: "shadow-sm"
  discrete-tab-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}/75%"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
    shadow: "shadow-sm"
    note: "Follows Quiet Chrome pattern (bg-background)"
  navigation-menu-item:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}/60%"
    padding: "8px 12px"
    rounded: "{rounded.sm}"
    hoverBackground: "{colors.muted}"
    hoverText: "{colors.foreground}/80%"
  right-panel-discrete-tabs:
    spacing: "gap-1.5"
    chromeClass: "{CHROME_PILL_CLASS}"
    activeClass: "{DISCRETE_TAB_ACTIVE_CLASS}"
  
  # ─── Layouts & Containers ────────────────────────────────────────────────
  chat-workspace-layout:
    display: "flex"
    flexDirection: "row"
    desktopBehavior: "inline-panel"
    mobileBehavior: "overlay"
    breakpoint: "{layout.breakpoint-desktop}"
  resizable-right-canvas:
    width: "50%" (default), "70%" (max)
    border: "{colors.border}/70%"
    backgroundColor: "{colors.background}/95%"
    shadow: "shadow-lg"
    roundedMobile: "{rounded.lg}"
  header-panel:
    height: "{layout.header-height}"
    offsetTop: "{layout.header-offset}"
    padding: "0 12px"
    display: "flex"
    alignItems: "center"
    gap: "gap-2"
  config-section-container:
    padding: "p-2"
    radius: "{rounded.section-surface}"
    background: "{colors.background}/30%"
    border: "{colors.border}/30%"
    shadow: "shadow-md"
    backdropFilter: "blur-md"
  
  # ─── Inputs & Fields ─────────────────────────────────────────────────────
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "4px 10px"
    typography: "{typography.body}"
    placeholder: "{colors.muted-foreground}"
    focusRing: "3px {colors.ring}/50%"
  input-error:
    borderColor: "{colors.destructive}"
    ringColor: "{colors.destructive}"
    ringOpacity: "20%"
  field-control:
    backgroundColor: "{colors.background}/70%"
    textColor: "{colors.foreground}/70%"
    rounded: "{rounded.field-control}"
    height: "32px"
    padding: "6px 8px"
    typography: "{typography.label}"
    fontSize: "12px"
    focusRing: "2px {colors.foreground}/10%"
  textarea-default:
    fontFamily: "{typography.fontFamily}"
    padding: "8px 10px"
    rounded: "{rounded.lg}"
    minHeight: "80px"
  
  # ─── Surfaces & Rows ─────────────────────────────────────────────────────
  section-surface:
    backgroundColor: "{colors.background}/30%"
    rounded: "{rounded.section-surface}"
    border: "{colors.border}/30%"
    shadow: "shadow-md"
    backdropFilter: "blur-md"
    padding: "p-2"
  row-surface-default:
    backgroundColor: "{colors.background}/30%"
    rounded: "{rounded.row-surface}"
    border: "{colors.border}/30%"
    padding: "p-2"
  row-surface-muted:
    backgroundColor: "{colors.foreground}/1.5%"
    border: "{colors.border}/20%"
  row-surface-selected:
    backgroundColor: "{colors.foreground}/3.5%"
    border: "{colors.primary}/30%"
  row-surface-dashed:
    backgroundColor: "{colors.background}/10%"
    borderStyle: "dashed"
    border: "{colors.border}/25%"
  
  # ─── Cards & Messages ────────────────────────────────────────────────────
  tool-card:
    backgroundColor: "var(--an-tool-background)"
    textColor: "var(--an-tool-color)"
    rounded: "{rounded.tool-card}"
    border: "var(--an-tool-border-color)"
    innerPadding: "12px"
  user-message-bubble:
    backgroundColor: "{colors.foreground}/5%" or "var(--an-user-message-bg)"
    rounded: "{rounded.message-bubble}"
    maxWidth: "768px"
    padding: "12px 16px"
  assistant-message:
    backgroundColor: "transparent"
    maxWidth: "768px"
    typography: "{typography.body}"
    codeBlockRadius: "{rounded.tool-card}"
  plan-card:
    backgroundColor: "{colors.muted}/20%"
    border: "{colors.info}/30%"
    rounded: "{rounded.md}"
    iconColor: "{colors.info}"
  
  # ─── Chips & Badges ──────────────────────────────────────────────────────
  suggestion-chip:
    backgroundColor: "{colors.background}/80%"
    textColor: "{colors.foreground}/65%"
    rounded: "{rounded.pill}"
    border: "{colors.border}/70%"
    shadow: "shadow-sm"
    padding: "6px 12px"
  status-badge-success:
    backgroundColor: "{colors.success}/10%"
    textColor: "{colors.success}"
    border: "{colors.success}/30%"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  status-badge-warning:
    backgroundColor: "{colors.warning}/10%"
    textColor: "{colors.warning}"
    border: "{colors.warning}/30%"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  status-badge-error:
    backgroundColor: "{colors.destructive}/10%"
    textColor: "{colors.destructive}"
    border: "{colors.destructive}/30%"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  loading-spinner:
    size: "20px"
    color: "{colors.primary}"
    animation: "spin 1s linear infinite"
---

# Design System: Fleet Pi

## 1. Overview

**Creative North Star: "The Focused Studio"**

Fleet Pi is a product UI for developers who run Pi agents against their own repositories. The visual system welcomes you in, then gets out of the way: approachable entry points, expert depth in panels and tool cards, and no marketing scaffolding inside the shell. Chrome is quiet; chat transcripts, tool output, plans, and file previews carry the weight.

The library lives entirely in `@workspace/hax-design`. Apps under `apps/web` compose exports only — no app-local components. Primitives (shadcn/base-nova), agent chat surfaces (`agent-elements/`), Fleet Pi layout and panels (`fleet-pi/`), and generative UI (`openui/`) are layered deliberately. Layout constants (`layout-constants.ts`, 960px panel breakpoint, 50% default canvas ratio clamped to 70% max) anchor responsive behavior.

Elevation is **subtle lift**: flat chat column and content surfaces; `shadow-sm` on floating header pills and suggestion chips; `shadow-lg` only on overlays, mobile panels, and the resizable right canvas. Components feel **tactile and confident** — clear hover, focus rings, and active states without IDE heaviness.

**Key Characteristics:**

- Restrained neutral palette (true off-white / near-black, chroma 0) with accent used for selection and primary actions only
- Inter Variable as the single sans family across headings, labels, and body
- Pill-shaped header and launcher controls (`rounded-full`); cards and inputs at 10px (`--radius: 0.625rem`)
- `bg-sidebar` for inactive header pills and floating launcher buttons
- Right panel opens at 50% viewport, resizable up to 70% max; mobile panels become compact overlays below 960px
- Tool cards and markdown in chat are the loudest visual layer
- Blue action accent (`#3b82f6` / `#60a5fa` dark) scoped exclusively to agent chat send/interactive controls

## 2. Colors

A neutral-first, chroma-zero palette. Light mode is true white ink on white; dark mode inverts to near-black surfaces. No cream, sand, or warm-tinted body backgrounds.

### Primary

- **Ink Primary** (oklch(0.205 0 0)): Primary buttons, strong labels, sidebar-primary in light mode. The main action color is near-black, not a brand hue.
- **On Primary** (oklch(0.985 0 0)): Text and icons on primary-filled controls.

### Neutral

- **Canvas** (oklch(1 0 0)): Page background, cards, popovers in light mode.
- **Ink** (oklch(0.145 0 0)): Primary text, headings, active labels.
- **Sidebar Wash** (oklch(0.985 0 0)): Inactive header pills, subdued chrome, secondary panel tint.
- **Muted Field** (oklch(0.97 0 0)): Secondary surfaces, accent fills for selected discrete tabs.
- **Muted Label** (oklch(0.556 0 0)): Secondary text, inactive tab labels, placeholder-adjacent copy. Must stay ≥4.5:1 on Canvas.
- **Hairline** (oklch(0.922 0 0)): Borders, inputs, dividers at 70% opacity in Fleet Pi chrome (`border-border/70`).
- **Focus Ring** (oklch(0.708 0 0)): Focus-visible rings at 50% opacity (`ring-ring/50`).

### Status

- **Success** (oklch(0.55 0.12 145) / dark oklch(0.72 0.14 145)): Positive confirmations, connected states.
- **Warning** (oklch(0.7 0.14 75) / dark oklch(0.78 0.12 75)): Caution states, degraded connections.
- **Info** (oklch(0.55 0.08 240) / dark oklch(0.72 0.1 240)): Informational badges, neutral-active indicators.

### Tertiary

- **Destructive** (oklch(0.577 0.245 27.325)): Errors, destructive actions, invalid field states.

### Action Accent (Agent-Elements Bridge)

- **Light:** `#3b82f6` (blue-500) — send button background, input focus outline, interactive highlights.
- **Dark:** `#60a5fa` (blue-400) with `#0a0a0a` text for contrast.
- **Scope:** This blue is confined to the `agent-elements/` chat layer (`--an-primary-color`, `--an-send-button-bg`). It must not leak into Fleet Pi chrome, settings, or navigation. Fleet Pi header/panel chrome uses the neutral Quiet Chrome pattern exclusively.

### Named Rules

**The Quiet Chrome Rule.** Inactive header pills and panel launchers use `bg-sidebar` and `text-foreground/55`. Active or hovered chrome moves to `bg-background` with stronger foreground. Accent and primary colors belong to content and actions, not idle chrome.

**The No Warm Wash Rule.** Body and sidebar backgrounds stay at chroma 0. Warmth and personality come from typography, motion, and content — never from a cream-tinted page fill.

**The Scoped Blue Rule.** The blue action accent lives only in agent chat interactive controls (send button, focus outlines). It is not a general brand color and must not appear in settings, navigation, or panel chrome.

## 3. Typography

**Display Font:** Inter Variable (system-ui fallback via sans stack)
**Body Font:** Inter Variable (same family — product UI uses one family)
**Label Font:** Inter Variable at smaller sizes and medium weight

**Character:** Technical but approachable. Fixed rem scale (no fluid display type). Compact 12–13px labels in header chrome; 14px body in chat and panels.

### Variable Font Settings

Inter Variable uses `fontVariationSettings` for optical sizing:

- **Normal:** `'wght' 400, 'opsz' 14`
- **Medium:** `'wght' 450, 'opsz' 15`
- **Semibold:** `'wght' 550, 'opsz' 20`
- **Bold:** `'wght' 700, 'opsz' 25`

### Hierarchy

- **Display** (600, 1.5rem / 24px, line-height 1.25): Panel titles, major section headers in configuration views. Letter-spacing −0.02em maximum.
- **Headline** (600, 1.125rem / 18px, line-height 1.35): Card titles, resource group headings.
- **Title** (600, 0.875rem / 14px, line-height 1.4): Subsection labels, list item titles.
- **Body** (400, 0.875rem / 14px, line-height 1.5): Chat prose, form descriptions, tree labels. Cap prose blocks at 65–75ch where readable.
- **Label** (500, 0.75rem / 12px, line-height 1.33): Header pills, session menu items, badges, metadata. Header chrome commonly uses `text-[12px]`.

### Theme Utilities

Tailwind v4 `@theme inline` registers `--text-label`, `--text-body`, `--text-title`, `--text-headline`, `--text-display` as size tokens. These generate `text-label`, `text-body`, etc. utilities. Prefer these over arbitrary `text-[Npx]` in new components.

### Named Rules

**The One Family Rule.** Do not introduce a display serif or mono-forward heading font in the app shell. Inter Variable carries headings, UI labels, and body.

## 4. Elevation

Subtle lift: most surfaces are flat at rest. Depth is conveyed through sidebar/background contrast, borders at reduced opacity, and selective shadows on floating elements.

Chat column and configuration lists stay flat. Header pills, suggestion chips, and inactive launcher controls use `shadow-sm` plus optional `backdrop-blur`. Mobile panels and the resizable right canvas use `shadow-lg` with `bg-background/95` and `border-border/70`.

### Shadow Vocabulary

- **Chrome lift** (`shadow-sm`): Header pills, suggestion pills, compact badges.
- **Overlay lift** (`shadow-md`): Tooltips, popover menus, section surfaces.
- **Panel lift** (`shadow-lg`): Mobile panel sheet, resizable right canvas, modal overlays.

### Named Rules

**The No Ghost Card Rule.** Never pair a 1px border and a wide soft shadow (blur ≥16px) on the same resting card or button. Pick border _or_ a tight shadow (≤8px blur), not both as decoration.

**The Flat Chat Rule.** Message list and tool cards do not get decorative drop shadows at rest. Elevation in chat comes from borders, background tints, and typography — not floating cards.

## 5. Motion & Animation

All motion is purposeful — confirming state changes, guiding attention, or smoothing layout transitions. No decorative loops or ambient animation.

### Spring Tiers (motion/react)

| Tier         | Enter                     | Exit  | Use                                  |
| ------------ | ------------------------- | ----- | ------------------------------------ |
| **Fast**     | spring 80ms, bounce 0     | 60ms  | Micro-feedback: button press, toggle |
| **Moderate** | spring 160ms, bounce 0    | 120ms | Panel expand, tab content swap       |
| **Slow**     | spring 240ms, bounce 0.12 | 160ms | Overlay entrance, canvas dock        |

Source: `packages/hax-design/src/lib/springs.ts`

### CSS Transitions

- Color/border/shadow: `transition-colors` or `duration-150` to `duration-300`
- Discrete-tab label expand: `grid-template-columns 220ms cubic-bezier(0.25, 0.1, 0.25, 1)`
- Row hover interactive: `duration-200`

### Keyframe Animations (agent-ui.css)

- `shimmer`: Loading placeholder sweep
- `blink`: Cursor/caret indicator
- `ellipsis`: Streaming dots (three-phase opacity)

### Named Rules

**The Reduced Motion Rule.** All keyframe animations, spring transitions, and CSS transitions must be wrapped in `@media (prefers-reduced-motion: no-preference)` or disabled under `reduce`. This is mandated by PRODUCT.md and applies to every layer.

**The No Ambient Loop Rule.** No infinite animations at rest. Loading indicators are the only permitted loop, and they must stop when content arrives.

## 6. Dark Mode

Dark mode is a first-class citizen, toggled via `.dark` class on a root ancestor. All core tokens invert in `globals.css`; agent-elements tokens invert in `agent-ui.css`.

### Key Differences

- Backgrounds invert from white → near-black (`oklch(0.145 0 0)` core / `#0a0a0a` agent)
- Borders switch from solid OKLCH to alpha-based (`oklch(1 0 0 / 10%)`)
- Action accent lightens (`#3b82f6` → `#60a5fa`) with text color flipping to dark for contrast
- `sidebar-primary` must remain neutral (not blue) in both modes

### Named Rules

**The Seamless Seam Rule.** Core `--background` and agent `--an-background` should appear visually continuous. Avoid pairing surfaces from both namespaces side-by-side where the slight value difference creates a visible band.

## 7. Accessibility

### Focus

- All interactive elements: `focus-visible:ring-3 ring-ring/50` (core) or `focus-visible:ring-2 ring-foreground/10` (dense field controls)
- Agent chat input: `--an-input-focus-outline` (blue rgba in Fleet Pi override)
- Never remove focus indicators without providing an equivalent visible alternative

### Hit Areas

- Minimum 40×40px touch target for isolated icon buttons (`HIT_AREA_EXPAND_CLASS`)
- Dense adjacent controls use vertical-only expansion (`HIT_AREA_EXPAND_DENSE_CLASS`)

### Contrast

- Muted text (`oklch(0.556 0 0)`) on Canvas (`oklch(1 0 0)`): ≥4.5:1
- Inactive chrome (`text-foreground/55`): decorative/supplementary — not sole information carrier
- Action accent on white: `#3b82f6` on `#ffffff` = 4.56:1 (AA pass for large text/icons)

### Named Rules

**The Motion Respect Rule.** Honor `prefers-reduced-motion` on all transitions and animations. Users who opt out of motion get instant state changes with no visual jank.

## 8. Components

### Buttons (shadcn `Button`)

- **Shape:** Gently rounded corners (10px / `rounded-lg` from `--radius`)
- **Primary:** Ink Primary fill, On Primary text, h-8, px-2.5, text-sm, font-medium
- **Hover / Focus:** Primary hover at 80% opacity; `focus-visible:ring-3 ring-ring/50`; active translate-y-px
- **Outline / Ghost / Secondary:** Border or transparent fill; hover to `bg-muted`; destructive uses tinted destructive background

### Header Pills (`HeaderPillButton`)

- **Shape:** Full pill (`rounded-full`), h-9, px-3, text-[12px]
- **Inactive:** `border-border/70 bg-sidebar text-foreground/55 shadow-sm backdrop-blur`
- **Active:** `bg-background text-foreground/75`
- **Hover:** Inactive pills lift to background with stronger text

### Discrete Tabs (`DiscreteTabs`)

- **Shape:** Pill triggers in inline flex row; icon + expanding label on active tab; full header-pill chrome (`CHROME_PILL_CLASS`: h-9, border, shadow-sm, backdrop-blur)
- **Inactive:** Quiet Chrome — `bg-sidebar text-foreground/55`; hover lifts toward background
- **Active:** Quiet Chrome — `bg-background text-foreground/75`; label expands via CSS grid `0fr → 1fr` (220ms ease)
- **Tooltip:** Popover-style title on hover when inactive; no side-stripe indicators
- **Note:** Implemented tabs follow Quiet Chrome / header-pill tokens, not accent-fill tab chrome.

### Chips / Suggestion Pills

- **Style:** `rounded-full border border-border/70 bg-background/80 shadow-sm`
- **Text:** `text-foreground/65`; hover strengthens border and background tint
- **Use:** InputBar suggestion pills, mode/model selectors (pill-shaped per Fleet Pi convention)

### Cards / Containers

- **Section Surface:** 12px radius (`rounded-[12px]`), `bg-background/30`, `border-border/30`, `shadow-md`, `backdrop-blur-md`
- **Row Surface:** 4px radius (`rounded-[4px]`), `bg-background/30`, `border-border/30`; interactive variants add hover lift
- **Corner Style:** 8–10px for config panels; `rounded-lg` for shadcn primitives
- **Background:** `bg-background/30` with `border-border/30` in dense config lists; avoid nested card-in-card
- **Shadow Strategy:** `shadow-sm` or `shadow-md` on section containers only; no wide blur at rest
- **Border:** Hairline at 15–45% opacity; primary tint when dirty/selected (`border-primary/30`)

### Inputs / Fields

- **Default:** h-8, `rounded-lg`, `border-input`, transparent or `bg-input/30` in dark mode
- **Field Control (dense):** h-8, `rounded-[7px]`, `border-border/50`, `bg-background/70`, `text-[12px]`
- **Focus:** `border-ring`, `ring-3 ring-ring/50` (default) or `ring-2 ring-foreground/10` (dense)
- **Error:** `border-destructive`, `ring-destructive/20`

### Tool Cards (agent-elements)

- **Radius:** 10px (`--an-tool-border-radius`)
- **Background:** `var(--an-tool-background)` (#f5f5f5 light / #1a1a1a dark)
- **Border:** `var(--an-tool-border-color)` (#e4e4e7 light / #2a2a2a dark)
- **Inner structure:** Header row (icon + title + status), collapsible content, no decorative shadows

### Message Bubbles

- **User:** 16px radius (`--an-message-border-radius`), `var(--an-user-message-bg)`, right-aligned or full-width
- **Assistant:** No bubble — prose flows directly in the transcript column

### Send Button

- **Shape:** Circular pill
- **Light:** `#3b82f6` background, white icon
- **Dark:** `#60a5fa` background, `#0a0a0a` icon
- **Disabled:** Reduced opacity, no pointer events

### Navigation

- **Header:** Floating pill cluster (account, sessions, new session) — not a full-width top bar
- **Right panel:** `DiscreteTabs` launcher (Pi Resources, Workspace, Artifacts) + resizable canvas
- **Mobile:** Overlay panel below 960px; desktop inline launcher hidden on small screens per `layout-constants`

### Resizable Right Canvas

- **Width:** Opens at 50% viewport (`RESOURCE_CANVAS_VIEWPORT_RATIO = 0.5`); user-resizable up to 70% max
- **Surface:** `border-border/70`, `bg-background/95`, `shadow-lg`, `rounded-[8px]` on mobile compact overlay
- **Header:** Title + icon; close control; optional refresh

## 9. Token Architecture

### Layer Model

```
globals.css (:root / .dark)       ← Core OKLCH semantic tokens
  └─ agent-ui.css (:root / .dark) ← Hex-based --an-* chat layer tokens
       └─ fleet-pi-agent-chat.css ← Fleet Pi overrides (focus outline)
  └─ discrete-tab.css             ← Tab label animation keyframes
  └─ @theme inline                ← Tailwind v4 token registration
tokens.ts                         ← Class-string design tokens (cva + constants)
springs.ts                        ← Motion spring tokens
layout-constants.ts               ← Spatial constants (breakpoints, ratios)
font-weight.ts                    ← Variable font settings
```

### Namespace Rules

- **Core tokens** (`--background`, `--foreground`, etc.): OKLCH, defined in `globals.css`. Use via Tailwind utilities (`bg-background`, `text-foreground`).
- **Agent tokens** (`--an-*`): Hex-based, defined in `agent-ui.css`. Use only inside `agent-elements/` components. Fleet Pi chrome must not reference `--an-*` tokens directly.
- **Class tokens** (`tokens.ts`): Composed Tailwind class strings. Import from `fleet-pi/styles/tokens.ts`. Prefer these over ad-hoc class repetition.

## 10. Do's and Don'ts

### Do:

- **Do** keep all UI in `@workspace/hax-design`; apps compose, never fork components locally.
- **Do** use `bg-sidebar` for inactive header pills and floating panel launcher buttons.
- **Do** use pill rounding (`rounded-full`) for header controls, discrete tabs, and InputBar mode/model selectors.
- **Do** respect the 960px breakpoint for right-panel desktop vs mobile overlay behavior.
- **Do** provide `focus-visible` rings and honor `prefers-reduced-motion` on all transitions and animations.
- **Do** make tool output, plans, and file previews the visually dominant layer in the chat column.
- **Do** use semantic status tokens (`--success`, `--warning`, `--info`) for state indicators instead of raw Tailwind palette colors.
- **Do** use the registered theme typography utilities (`text-label`, `text-body`, `text-title`, `text-headline`, `text-display`) in new components.
- **Do** source motion durations from `springs.ts` tiers for consistency across enter/exit animations.

### Don't:

- **Don't** use generic AI SaaS slop: cream/warm-neutral body backgrounds, gradient heroes, identical card grids, side-stripe accent borders, oversized card radii (24px+), or ghost-card border-plus-wide-shadow pairing.
- **Don't** ship heavy IDE chrome: VS Code–clone density, ever-present toolbars, or reinvented standard affordances.
- **Don't** collapse into ChatGPT-style minimal bubble chat that hides workspace context, resources, and plan state.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent on tabs, cards, or list items.
- **Don't** use gradient text (`background-clip: text`) for emphasis.
- **Don't** nest cards inside cards in configuration or resource lists.
- **Don't** replace the floating pill header with a unified full-width top bar unless explicitly requested.
- **Don't** reference `--an-*` tokens in Fleet Pi chrome components (header, settings, navigation). Use core semantic tokens.
- **Don't** use raw Tailwind palette colors (e.g., `amber-500`, `emerald-500`) for status indicators — use `text-success`, `text-warning`, `text-info`.
- **Don't** introduce infinite/ambient animations. Loading indicators are the only permitted loop.
