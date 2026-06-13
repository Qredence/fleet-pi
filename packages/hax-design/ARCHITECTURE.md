# hax-design Architecture

Fleet Pi's UI library. Apps import via `@workspace/hax-design/*`; files inside this package use **relative imports only**.

## Layer stack

```
apps/web (routes compose only — no local components)
    ↓
@workspace/hax-design/components/*
    ├── fleet-pi/          Product shell, panels, config, chat wiring
    ├── agent-elements/    Reusable agent chat UI (messages, tools, input)
    ├── openui/            Generative UI (OpenUI Lang renderer + registry)
    └── [primitives]       shadcn/base-nova (button, input, dialog, …)
    ↓
src/styles/globals.css     OKLCH tokens, Tailwind v4 theme, radius scale
src/lib/                   Shared utilities (layout, canvas, protocol types)
```

## fleet-pi/ layout

| Path          | Responsibility                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `layout/`     | Shell grid (`ChatWorkspaceLayout`), floating header (`chat-header`), right panel shell + registry   |
| `chat/`       | Fleet Pi wrappers around `agent-elements` (`FleetPiInputBar`, agent chat CSS)                       |
| `pi/`         | Right-panel content: resources, workspace tree, artifacts, config panel, resizable canvas, launcher |
| `primitives/` | Fleet Pi-specific building blocks (`ChromePillButton`, `SectionSurface`, `CenteredLoader`)          |
| `styles/`     | Semantic class tokens and CVA surfaces (`tokens.ts`)                                                |
| `auth/`       | Login page                                                                                          |
| `icons/`      | Brand icons (e.g. Google)                                                                           |

## Design token hierarchy

1. **Global primitives** — `globals.css` `:root` / `.dark`: `--background`, `--foreground`, `--primary`, `--sidebar`, `--radius`, etc.
2. **Tailwind theme** — `@theme inline` maps CSS vars to Tailwind color/radius utilities.
3. **Fleet Pi semantic tokens** — `fleet-pi/styles/tokens.ts`: chrome pills, panel overlay, field controls, `fleetPiSectionSurface` / `fleetPiRowSurface` CVA.
4. **Component CVA** — shadcn `buttonVariants`, `discreteTabTriggerVariants`, etc.

Prefer semantic tokens over inline `rounded-[10px] border-border/30 …` strings in new Fleet Pi code.

## Layout system

Constants live in `src/lib/layout-constants.ts`:

| Token                            | Value | Use                                   |
| -------------------------------- | ----- | ------------------------------------- |
| `CHAT_PANEL_BREAKPOINT_PX`       | 960   | Desktop right panel vs mobile overlay |
| `WORKSPACE_SPLIT_MIN_WIDTH_PX`   | 640   | Workspace tree / preview split        |
| `CHAT_HEADER_HEIGHT_PX`          | 36    | Floating header pill row              |
| `RESOURCE_CANVAS_VIEWPORT_RATIO` | 0.7   | Default resizable panel width cap     |

`ChatWorkspaceLayout` exposes CSS vars `--chat-chrome-top`, `--chat-header-height` for fixed mobile panels.

Right panel tabs (`resources` \| `workspace` \| `artifacts` \| `configurations`) are registered in `layout/right-panel-registry.tsx` and launched via `DiscreteTabs` in `pi/right-panel-launcher.tsx`.

### Shell layout (confirmed)

```
┌─────────────────────────────────────────────────────────────────┐
│  Chat header (pills + inline DiscreteTabs launcher)             │
├──────────────────────────────────┬──────────────────────────────┤
│  Chat column (full transcript)   │  Right panel (resizable)     │
│  — narrows only when panel open  │  ┌ Resources                │
│  — no in-column artifact split   │  ├ Workspace               │
│                                  │  ├ Artifacts  ← preview    │
│                                  │  └ Configurations          │
└──────────────────────────────────┴──────────────────────────────┘
```

**State boundary (hybrid):**

| Layer                                               | Owns                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/web` (`use-chat-shell-state.ts`, `index.tsx`) | Data fetch, `rightPanel`, canvas width, theme, context value assembly                                         |
| `hax-design`                                        | `ChatWorkspaceLayout`, header, `RightPanelProvider`, `RIGHT_PANEL_REGISTRY`, `ResizableCanvas`, `MobilePanel` |

**Artifacts tab:** `ArtifactsPanelContent` scopes the existing workspace tree/preview to `agent-workspace/artifacts/` (`reports`, `datasets`, `traces`, `diagrams`). It reuses `/api/workspace/tree` and `/api/workspace/file` — no separate artifacts API in v1.

**Open from chat:** `use-chat-shell-state.ts` owns `selectedWorkspacePath` and `openWorkspacePath()`. `FleetPiToolRenderer` (registered in `fleet-pi-agent-chat.tsx`) calls `openWorkspacePath` when the user clicks a navigable path on `Read`, `Write`, `Edit`, or `workspace_write` tool cards. Path normalization and panel routing live in `src/lib/workspace-path-nav.ts` (`artifacts` vs `workspace` tab). Both panels share the same selected path via `RightPanelContextValue`.

## agent-elements vs fleet-pi

- **agent-elements**: Domain-agnostic chat UI — messages, tool renderers, InputBar, markdown. Usable in any Pi/agent project.
- **fleet-pi**: Fleet Pi product chrome — session header pills, Pi resources browser, workspace viewer, `.pi/settings.json` config panel, layout breakpoints.

Fleet Pi chat route composes `FleetPiAgentChat` + `FleetPiInputBar`, which inject Fleet Pi suggestion styles and mode/model selectors into agent-elements.

## Import conventions

```tsx
// apps/web
import { Button } from "@workspace/hax-design/components/button"
import { ChatWorkspaceLayout } from "@workspace/hax-design/components/fleet-pi/layout/chat-workspace-layout"

// inside packages/hax-design
import { Button } from "../../button"
import { SectionSurface } from "../primitives/surface"
import { FIELD_CONTROL_CLASS } from "../styles/tokens"
```

## Adding components

- **shadcn primitives**: `pnpm dlx shadcn@latest add <name> -c apps/web` (writes into `packages/hax-design`).
- **Fleet Pi surfaces**: add under `fleet-pi/`; reuse `primitives/` and `styles/tokens.ts` before inventing new class strings.
- **Agent UI**: extend `agent-elements/` and tool registry first for new tool types.

## Related docs

- Root `PRODUCT.md` — strategic register, users, anti-references
- Root `DESIGN.md` — visual spec (colors, type, components, do's/don'ts)
- `.impeccable/design.json` — live panel component snippets + narrative sidecar
