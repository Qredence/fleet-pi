# @workspace/ui

`packages/ui` is the shared React component library for Fleet Pi. `apps/web` imports everything from here — shadcn UI primitives, the agent-elements AI chat kit, shared hooks, and the global stylesheet. Nothing in this package is published externally; it is a private monorepo workspace.

**Contributors:** Zachary BENSALEM

---

## Directory layout

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── agent-elements/      # AI chat UI kit (see agent-elements.md)
│   │   ├── alert.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── chart.tsx
│   │   ├── collapsible.tsx
│   │   ├── command.tsx
│   │   ├── dialog.tsx
│   │   ├── input-group.tsx
│   │   ├── input.tsx
│   │   ├── progress.tsx
│   │   ├── select.tsx
│   │   ├── separator.tsx
│   │   ├── skeleton.tsx
│   │   ├── sonner.tsx
│   │   ├── switch.tsx
│   │   ├── table.tsx
│   │   └── textarea.tsx
│   ├── hooks/                   # Shared React hooks
│   ├── lib/                     # Utility functions
│   └── styles/
│       └── globals.css          # Tailwind CSS v4 design tokens + shadcn theme
└── package.json
```

---

## Exports

The package uses subpath exports defined in `packages/ui/package.json`:

| Import path                       | Source                   |
| --------------------------------- | ------------------------ |
| `@workspace/ui/globals.css`       | `src/styles/globals.css` |
| `@workspace/ui/components/<name>` | `src/components/<name>`  |
| `@workspace/ui/lib/<name>`        | `src/lib/<name>`         |

Example usage in `apps/web`:

```tsx
import { Button } from "@workspace/ui/components/button"
import { AgentChat } from "@workspace/ui/components/agent-elements/agent-chat"
import { cn } from "@workspace/ui/lib/utils"
```

The global stylesheet is imported once at the app entry point:

```tsx
import "@workspace/ui/globals.css"
```

---

## Styling

Tailwind CSS v4 is configured entirely through `packages/ui/src/styles/globals.css`. There is no `tailwind.config.js`. Design tokens (colors, radius, fonts) are declared as CSS custom properties inside `@theme inline { … }`. Shadcn's theme layer is pulled in via `@import "shadcn/tailwind.css"`. The agent-elements UI kit adds its own CSS layer via `@import "../components/agent-elements/agent-ui.css"`.

The Inter Variable font (`@fontsource-variable/inter`) is bundled in the package and loaded from the same CSS file.

---

## Adding shadcn components

Always run the shadcn CLI from the **repo root**, targeting `apps/web`. Shadcn automatically places the output in `packages/ui`:

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

Existing shadcn components live directly under `packages/ui/src/components/` (e.g. `button.tsx`, `dialog.tsx`).

---

## Key dependencies

| Package                           | Purpose                                            |
| --------------------------------- | -------------------------------------------------- |
| `streamdown` + `@streamdown/code` | Streaming markdown renderer used by agent-elements |
| `motion` (Motion One / Framer)    | Animation for message list transitions             |
| `@base-ui/react`                  | Accessible primitive components (popovers, etc.)   |
| `lottie-react`                    | Lottie animation playback (spiral loader)          |
| `@tabler/icons-react`             | Icon set used throughout agent-elements            |
| `lucide-react`                    | Secondary icon set                                 |
| `recharts`                        | Charts (used in `chart.tsx`)                       |
| `sonner`                          | Toast notifications                                |
| `cmdk`                            | Command palette primitive (`command.tsx`)          |
| `next-themes`                     | Light/dark/system theme switching                  |
| `@pierre/diffs`                   | Diff rendering in the edit tool                    |
| `shadcn`                          | Component CLI and Tailwind integration             |

---

## Related pages

- [Agent elements UI kit](agent-elements.md) — the self-contained AI chat UI library inside this package
- [Web app](../../apps/web/index.md) — the TanStack Start app that consumes this package
- [Chat feature](../../features/chat.md) — how the chat UI is wired end-to-end
