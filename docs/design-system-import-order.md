# HAX Design System — Import Order Requirements

## Overview

The Fleet Pi design system (`hax-design`) relies on specific import ordering to ensure CSS variable precedence and proper theming. Following this order is critical for avoiding visual regressions and ensuring consistent styling across components.

## Required Import Sequence

### 1. Base Theme Variables (First)

Always import the root theme variables **before** any component styles:

```css
/* apps/web/src/styles/globals.css */
@import "tailwindcss";
@import "../packages/hax-design/src/styles/tokens.css"; /* ← MUST be first */
```

This establishes the foundation color palette and semantic tokens.

### 2. Agent UI Components (Second)

Import agent UI component styles **after** base tokens but **before** design overrides:

```css
@import "../packages/hax-design/src/components/agent-ui.css";
```

This ensures agent components inherit properly from the theme.

### 3. Custom Overrides (Last)

Apply customizations **last** to override defaults without breaking component contracts:

```css
@import "./overrides.css"; /* Custom theme tweaks */
```

## Why Order Matters

CSS cascade rules apply based on declaration order. The following chain exists internally:

```
tokens.css → agent-ui.css → discrete-tab.css (nested in agent-ui)
```

If `discrete-tab.css` is imported **before** `agent-ui.css`, its styles take higher precedence and can override agent UI customizations incorrectly.

## Component-Specific Requirements

### Quiet Chrome UI Pattern

Components using the quiet chrome pattern expect specific opacity hierarchies:

```css
/* Correct: quiet chrome inherits from agent UI */
.header {
  opacity: 0.6; /* Inherited from design system */
}

/* Incorrect: hard-coded values bypass design tokens */
.header-broken {
  opacity: 0.59; /* Breaks hierarchy */
}
```

## Testing Guidelines

To verify correct import order after changes:

1. Run dev server: `pnpm --filter web dev`
2. Open Settings dialog → Appearance tab
3. Verify all tabs use correct colors (no white-on-white contrast issues)
4. Test theme switching (Light/Dark/System) works consistently

## Common Pitfalls

### ❌ Wrong: Importing component styles before tokens

```css
/* BAD: Token variables undefined when component imports run */
@import "../packages/hax-design/src/components/agent-ui.css";
@import "../packages/hax-design/src/styles/tokens.css";
```

### ✅ Correct: Tokens first, then components

```css
/* GOOD: Establishes foundation before component overrides */
@import "../packages/hax-design/src/styles/tokens.css";
@import "../packages/hax-design/src/components/agent-ui.css";
```

### ❌ Wrong: Global overrides before component imports

```css
/* BAD: Can break internal component layering */
@import "./overrides.css";
@import "../packages/hax-design/src/components/agent-ui.css";
```

### ✅ Correct: Overrides last

```css
/* GOOD: Last to apply final adjustments */
@import "../packages/hax-design/src/components/agent-ui.css";
@import "./overrides.css";
```

## Monitoring Import Conflicts

If you suspect import order conflicts:

1. Check browser DevTools → Elements panel for style conflicts
2. Look for warning comments like `/* WARNING: Import order violated */`
3. Use `@use` from Sass if available for modular scoping

## Future Work

- [ ] Consolidate into single barrel export
- [ ] Add build-time linting for import violations
- [ ] Document additional design system constraints

## Related Files

- [`packages/hax-design/src/styles/tokens.ts`](./packages/hax-design/src/styles/tokens.ts) — Semantic token definitions
- [`packages/hax-design/src/components/agent-ui.css`](./packages/hax-design/src/components/agent-ui.css) — Agent UI base styles
- [`apps/web/src/styles/globals.css`](./apps/web/src/styles/globals.css) — Root import file
