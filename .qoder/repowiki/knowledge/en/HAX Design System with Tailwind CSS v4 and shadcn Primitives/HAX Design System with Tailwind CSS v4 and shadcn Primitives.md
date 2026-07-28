---
kind: frontend_style
name: HAX Design System with Tailwind CSS v4 and shadcn Primitives
category: frontend_style
scope:
  - "**"
source_files:
  - packages/hax-design/src/styles/globals.css
  - packages/hax-design/package.json
  - apps/web/components.json
  - apps/web/vite.config.ts
  - apps/web/src/routes/__root.tsx
  - packages/hax-design/src/lib/utils.ts
---

Fleet Pi uses a centralized design system built on **Tailwind CSS v4** (via `@tailwindcss/vite` plugin) and **shadcn/ui primitives**, packaged as the shared `@workspace/hax-design` library. The styling approach is component-driven, CSS-variable-based theming with both light and dark modes, and utility-first class composition.

### Core Architecture

- **Design library**: `packages/hax-design/` exports React components, hooks, styles, and utilities consumed by the web app via workspace aliases (`@workspace/hax-design/*`).
- **CSS entry point**: `packages/hax-design/src/styles/globals.css` imports Tailwind v4 (`@import "tailwindcss"`), shadcn base styles, `tw-animate-css`, Inter variable font, and component-specific CSS files. It declares all design tokens as CSS custom properties in `:root` and `.dark` selectors using OKLCH color space.
- **Vite integration**: `apps/web/vite.config.ts` enables the Tailwind v4 Vite plugin alongside TanStack Start, React, and path resolution plugins. Global CSS is imported as a URL module in `apps/web/src/routes/__root.tsx` and injected via `<link>` in the document head.
- **shadcn configuration**: `apps/web/components.json` configures shadcn with style `base-nova`, TypeScript, CSS variables, Lucide icons, and registries for `@fluid` and `@agent-elements` component sources. Aliases map `components`, `ui`, `hooks`, `lib`, and `utils` to the hax-design package.

### Design Tokens & Theming

- All colors, radii, typography, and semantic tokens are defined as CSS variables under `@theme inline` and `:root` / `.dark` blocks.
- Light mode uses neutral OKLCH values; dark mode inverts backgrounds/foregrounds and adjusts accent/success/warning/info palettes.
- Typography uses Inter Variable (`--font-sans`) with display/headline/body/label text sizes and tracking variants.
- Radius tokens scale from `radius-sm` through `radius-4xl` plus `radius-pill`.
- Sidebar-specific token set mirrors the core palette for consistent side panel styling.

### Component Library Structure

- **Primitives**: Standard shadcn-style components (`button`, `dialog`, `sheet`, `tabs`, `input`, `textarea`, `select`, `table`, `badge`, `progress`, `tooltip`, etc.) live directly under `packages/hax-design/src/components/`.
- **Agent elements**: Chat-focused UI (`agent-chat`, `message-list`, `input-bar`, tool renderers like `bash-tool`, `edit-tool`, markdown rendering, spiral loaders) under `src/components/agent-elements/`.
- **Fleet Pi shell**: Product-level layout, auth, chat, primitives, and style overrides under `src/components/fleet-pi/`.
- **OpenUI renderer**: Generative UI rendering components under `src/components/openui/`.
- **Utilities**: `cn()` helper in `src/lib/utils.ts` combines `clsx` + `tailwind-merge` for conditional class merging — the standard pattern throughout the codebase.

### Styling Conventions

- Utility-first classes via Tailwind v4 directives; no traditional CSS files per component except for specialized animations or overrides.
- Dark mode toggled via a `.dark` class on the root element, with all tokens scoped through CSS variables.
- Animation support via `tw-animate-css` import.
- Font loading handled through `@fontsource-variable/inter`.
- Class composition follows the `cn(...inputs)` pattern for safe merging of conflicting Tailwind classes.
