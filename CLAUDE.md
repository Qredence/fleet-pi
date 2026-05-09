# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

This repo uses **pnpm** (not bun/npm/yarn). The global `CLAUDE.md` defaults to bun, but this project is already opinionated about pnpm — use it here.

```bash
pnpm install          # install dependencies
pnpm dev              # start all apps in dev mode (port 3000)
pnpm build            # build all apps and packages
pnpm lint             # lint all workspaces
pnpm typecheck        # type-check all workspaces
pnpm format           # format all workspaces with prettier
```

Run workspace-specific commands from the root with `--filter`:

```bash
pnpm --filter web dev
pnpm --filter @workspace/ui typecheck
```

## Architecture

Turborepo monorepo with two workspaces:

- **`apps/web`** — TanStack Start application (React 19 + Vite + Nitro). Entry point: `src/routes/__root.tsx`. Routes are file-based via TanStack Router and auto-generated into `src/routeTree.gen.ts` (never edit this file manually).
- **`packages/ui`** — Shared component library (`@workspace/ui`). All shadcn components land here when added. Import as `@workspace/ui/components/<name>` or `@workspace/ui/lib/<name>`.

### Adding shadcn components

Always run from the repo root targeting the `web` app — shadcn places output in `packages/ui`:

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

### API layer

Backend routes live in TanStack Start file routes under `apps/web/src/routes/api/`. The current endpoint `chat.ts` streams chat responses from Pi as newline-delimited JSON.

### AI/LLM integration

- `@earendil-works/pi-ai` powers the server-side LLM stream.
- The primary provider is Amazon Bedrock through Pi's `amazon-bedrock` provider.
- Bedrock credentials use standard AWS environment/profile configuration. `AWS_REGION` defaults to `us-east-1`; `AWS_PROFILE` and `AWS_BEARER_TOKEN_BEDROCK` are passed through when set.
- The React client in `apps/web/src/routes/index.tsx` uses a small local `fetch` + `AbortController` hook and consumes `/api/chat` NDJSON events (`start`, `delta`, `done`, `error`).

### Agent UI components

`packages/ui/src/components/agent-elements/` is a self-contained AI chat UI library:

- `agent-chat.tsx` — drop-in `<AgentChat>` component wiring everything together
- `message-list.tsx` — renders messages and dispatches tool outputs to tool renderers
- `input-bar.tsx` — chat input with file attachments and suggestion pills
- `tools/tool-registry.ts` — central registry mapping 30+ tool types to icons/titles/display logic; add new tool support here first
- `tools/tool-renderer.tsx` — dispatches tool calls to their specific renderer components
- `markdown.tsx` — streaming markdown with syntax highlighting via Streamdown

## Code Style

- **Prettier**: 80-char line width, 2-space indent, no semicolons, double quotes disabled (check `.prettierrc`). Tailwind classes sorted automatically via plugin.
- **Paths**: `@/*` maps to `apps/web/src/*`; `@workspace/ui/*` maps to `packages/ui/src/*`.
- Tailwind CSS v4 — no `tailwind.config.js`, configuration lives in `packages/ui/src/styles/globals.css`.
