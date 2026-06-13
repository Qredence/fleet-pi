---
name: Fleet Pi
description: A local browser workspace for Pi-powered coding agents — calm chrome, loud tool output.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  secondary: "oklch(0.97 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  accent: "oklch(0.97 0 0)"
  accent-foreground: "oklch(0.205 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  border: "oklch(0.922 0 0)"
  input: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  sidebar: "oklch(0.985 0 0)"
  sidebar-foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  popover: "oklch(1 0 0)"
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
rounded:
  sm: "calc(0.625rem * 0.6)"
  md: "calc(0.625rem * 0.8)"
  lg: "0.625rem"
  xl: "calc(0.625rem * 1.4)"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
  header-pill:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  header-pill-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  discrete-tab-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  discrete-tab-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "4px 10px"
---

# Design System: Fleet Pi

## 1. Overview

**Creative North Star: "The Focused Studio"**

Fleet Pi is a product UI for developers who run Pi agents against their own repositories. The visual system welcomes you in, then gets out of the way: approachable entry points, expert depth in panels and tool cards, and no marketing scaffolding inside the shell. Chrome is quiet; chat transcripts, tool output, plans, and file previews carry the weight.

The library lives entirely in `@workspace/hax-design`. Apps under `apps/web` compose exports only — no app-local components. Primitives (shadcn/base-nova), agent chat surfaces (`agent-elements/`), Fleet Pi layout and panels (`fleet-pi/`), and generative UI (`openui/`) are layered deliberately. Layout constants (`layout-constants.ts`, 960px panel breakpoint, 70% default canvas width) anchor responsive behavior.

Elevation is **subtle lift**: flat chat column and content surfaces; `shadow-sm` on floating header pills and suggestion chips; `shadow-lg` only on overlays, mobile panels, and the resizable right canvas. Components feel **tactile and confident** — clear hover, focus rings, and active states without IDE heaviness.

**Key Characteristics:**

- Restrained neutral palette (true off-white / near-black, chroma 0) with accent used for selection and primary actions only
- Inter Variable as the single sans family across headings, labels, and body
- Pill-shaped header and launcher controls (`rounded-full`); cards and inputs at 10px (`--radius: 0.625rem`)
- `bg-sidebar` for inactive header pills and floating launcher buttons
- Right panel docks at up to 70% viewport; mobile panels become compact overlays below 960px
- Tool cards and markdown in chat are the loudest visual layer

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

### Tertiary

- **Destructive** (oklch(0.577 0.245 27.325)): Errors, destructive actions, invalid field states.

### Named Rules

**The Quiet Chrome Rule.** Inactive header pills and panel launchers use `bg-sidebar` and `text-foreground/55`. Active or hovered chrome moves to `bg-background` with stronger foreground. Accent and primary colors belong to content and actions, not idle chrome.

**The No Warm Wash Rule.** Body and sidebar backgrounds stay at chroma 0. Warmth and personality come from typography, motion, and content — never from a cream-tinted page fill.

## 3. Typography

**Display Font:** Inter Variable (system-ui fallback via sans stack)
**Body Font:** Inter Variable (same family — product UI uses one family)
**Label Font:** Inter Variable at smaller sizes and medium weight

**Character:** Technical but approachable. Fixed rem scale (no fluid display type). Compact 12–13px labels in header chrome; 14px body in chat and panels.

### Hierarchy

- **Display** (600, 1.5rem / 24px, line-height 1.25): Panel titles, major section headers in configuration views. Letter-spacing −0.02em maximum.
- **Headline** (600, 1.125rem / 18px, line-height 1.35): Card titles, resource group headings.
- **Title** (600, 0.875rem / 14px, line-height 1.4): Subsection labels, list item titles.
- **Body** (400, 0.875rem / 14px, line-height 1.5): Chat prose, form descriptions, tree labels. Cap prose blocks at 65–75ch where readable.
- **Label** (500, 0.75rem / 12px, line-height 1.33): Header pills, session menu items, badges, metadata. Header chrome commonly uses `text-[12px]`.

### Named Rules

**The One Family Rule.** Do not introduce a display serif or mono-forward heading font in the app shell. Inter Variable carries headings, UI labels, and body.

## 4. Elevation

Subtle lift: most surfaces are flat at rest. Depth is conveyed through sidebar/background contrast, borders at reduced opacity, and selective shadows on floating elements.

Chat column and configuration lists stay flat. Header pills, suggestion chips, and inactive launcher controls use `shadow-sm` plus optional `backdrop-blur`. Mobile panels and the resizable right canvas use `shadow-lg` with `bg-background/95` and `border-border/70`.

### Shadow Vocabulary

- **Chrome lift** (`shadow-sm`): Header pills, suggestion pills, compact badges.
- **Overlay lift** (`shadow-md`): Tooltips, popover menus.
- **Panel lift** (`shadow-lg`): Mobile panel sheet, resizable right canvas, modal overlays.

### Named Rules

**The No Ghost Card Rule.** Never pair a 1px border and a wide soft shadow (blur ≥16px) on the same resting card or button. Pick border _or_ a tight shadow (≤8px blur), not both as decoration.

**The Flat Chat Rule.** Message list and tool cards do not get decorative drop shadows at rest. Elevation in chat comes from borders, background tints, and typography — not floating cards.

## 5. Components

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

- **Shape:** Pill triggers in inline flex row; icon + expanding label on active tab
- **Inactive:** Transparent; muted text; hover `bg-accent/50`
- **Active:** `bg-accent text-accent-foreground`; label expands via CSS grid `0fr → 1fr` (220ms ease)
- **Tooltip:** Popover-style title on hover when inactive; no side-stripe indicators

### Chips / Suggestion Pills

- **Style:** `rounded-full border border-border/70 bg-background/80 shadow-sm`
- **Text:** `text-foreground/65`; hover strengthens border and background tint
- **Use:** InputBar suggestion pills, mode/model selectors (pill-shaped per Fleet Pi convention)

### Cards / Containers

- **Corner Style:** 8–10px (`rounded-[8px]` to `rounded-[10px]` in config panels; `rounded-lg` for primitives)
- **Background:** `bg-background/30` with `border-border/30` in dense config lists; avoid nested card-in-card
- **Shadow Strategy:** `shadow-sm` or `shadow-md` on section containers only; no wide blur at rest
- **Border:** Hairline at 15–45% opacity; primary tint when dirty/selected (`border-primary/30`)

### Inputs / Fields

- **Style:** h-8, `rounded-lg`, `border-input`, transparent or `bg-input/30` in dark mode
- **Focus:** `border-ring`, `ring-3 ring-ring/50`
- **Error:** `border-destructive`, `ring-destructive/20`

### Navigation

- **Header:** Floating pill cluster (account, sessions, new session) — not a full-width top bar
- **Right panel:** `DiscreteTabs` launcher (Resources, Workspace, Configurations) + resizable canvas
- **Mobile:** Overlay panel below 960px; desktop inline launcher hidden on small screens per `layout-constants`

### Resizable Right Canvas

- **Width:** Default 70% viewport; user-resizable with drag handle
- **Surface:** `border-border/70`, `bg-background/95`, `shadow-lg`, `rounded-[8px]` on mobile compact overlay
- **Header:** Title + icon; close control; optional refresh

## 6. Do's and Don'ts

### Do:

- **Do** keep all UI in `@workspace/hax-design`; apps compose, never fork components locally.
- **Do** use `bg-sidebar` for inactive header pills and floating panel launcher buttons.
- **Do** use pill rounding (`rounded-full`) for header controls, discrete tabs, and InputBar mode/model selectors.
- **Do** respect the 960px breakpoint for right-panel desktop vs mobile overlay behavior.
- **Do** provide `focus-visible` rings and honor `prefers-reduced-motion` on tab label expansion and transitions.
- **Do** make tool output, plans, and file previews the visually dominant layer in the chat column.

### Don't:

- **Don't** use generic AI SaaS slop: cream/warm-neutral body backgrounds, gradient heroes, identical card grids, side-stripe accent borders, oversized card radii (24px+), or ghost-card border-plus-wide-shadow pairing.
- **Don't** ship heavy IDE chrome: VS Code–clone density, ever-present toolbars, or reinvented standard affordances.
- **Don't** collapse into ChatGPT-style minimal bubble chat that hides workspace context, resources, and plan state.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent on tabs, cards, or list items.
- **Don't** use gradient text (`background-clip: text`) for emphasis.
- **Don't** nest cards inside cards in configuration or resource lists.
- **Don't** replace the floating pill header with a unified full-width top bar unless explicitly requested.
