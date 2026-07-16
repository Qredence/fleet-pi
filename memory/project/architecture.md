# Fleet Pi Architecture

## Overview

Fleet Pi is a pnpm/Turborepo workspace for a browser-based coding-agent chat UI.
The web app is built with TanStack Start, React 19, Tailwind CSS v4, and
`@workspace/hax-design`. Wire-format types live in `@workspace/pi-protocol`. The
chat backend uses Pi's coding agent runtime with Google Gemini as the default
provider and streams newline-delimited JSON events to the browser.

## Workspace Structure

```
apps/
  web/              TanStack Start app and `/api/chat` backend route
packages/
  hax-design/       Shared React UI (fleet-pi, agent-elements, openui renderer)
  pi-protocol/      Chat wire types, Zod, provider IDs, OpenUI prompt (no React)
```

## Key Components

### Chat Backend (`apps/web/src/routes/api/chat.ts`)

- Auth, ownership, Zod parse, and NDJSON pipe adapter
- Delegates streaming turns to `handleChatTurn` in `apps/web/src/lib/pi/handle-chat-turn.ts`
- Creates or resumes Pi coding-agent sessions scoped to repository root (or Daytona sandbox)
- Streams events as `application/x-ndjson`
- Uses Pi providers (default: Google `gemini-3.5-flash`)
- Enables built-in tools: `read`, `write`, `edit`, `bash`
- Normalizes tool execution events into UI-compatible parts
- Maintains live Pi `AgentSessionRuntime` instances in memory with TTL
- Supports session management, queuing, aborts, and Plan mode

### Chat Frontend (`apps/web/src/routes/index.tsx`)

- Composes hax-design fleet-pi and agent-elements surfaces only
- Handles client-side stream processing and UI updates
- Manages session persistence via localStorage (`fleet-pi-chat-session`)
- Implements message rendering, tool parts display, and thinking states
- Provides queue follow-up functionality and session controls
- Integrates with resource browser for skills/prompts/extensions inspection

### Shared UI (`packages/hax-design/src/components/`)

- `fleet-pi/` — Product shell, Settings, right panels (Workspace, Resources, Artifacts)
- `agent-elements/` — `AgentChat`, `InputBar`, tool renderers, message list
- `openui/` — Generative UI renderer (prompt builder lives in pi-protocol)

### Protocol (`packages/pi-protocol`)

- Canonical `ChatMessage` / `ChatToolPart` and `ChatStreamEvent` unions
- Zod request/response schemas shared by OpenAPI and the browser client
- Provider credential IDs (UI metadata stays in hax-design Settings)

## Data Flow

1. User submits message via InputBar
2. Frontend sends POST to `/api/chat` with message, model, mode, session metadata
3. Route calls `handleChatTurn`, which creates/resumes Pi runtime and streams events
4. Backend streams events (start, delta, tool, state, done) as NDJSON
5. Frontend parses stream and updates chat UI in real-time
6. Tool executions render as expandable cards in chat
7. Session metadata stored in localStorage for persistence/resumption

## Session Management

- Pi session JSONL files stored under `.fleet/sessions`
- Committed agent resources under `.pi/` and `agent-workspace/pi/`
- Server keeps live runtime instances in memory (TTL: 10 minutes default)
- Invalid/outside session files trigger fresh repo-scoped session
- Supports session listing, resuming, creating new, and aborting

## Extensibility

- Project-local Pi resources in `.pi/`:
  - Skills: `.pi/skills/` (agent-elements, fleet-pi-orientation, etc.)
  - Extensions: `.pi/extensions/` (project-inventory, workspace-index, trust-handler, vendored filechanges/subagents)
  - Settings: `.pi/settings.json` (loads pi-autoresearch, pi-skill-palette, pi-autocontext)
- Resources browser exposes available skills, prompts, extensions, themes, context files
- Supports custom tool registration via extensions

### Project Trust (Pi 0.79.0+)

Fleet Pi implements a custom `project_trust` extension handler (`.pi/extensions/trust-handler.ts`) that:

- Auto-approves workspace-native paths (`agent-workspace/pi/*`, `.pi/skills`, `.pi/prompts`)
- Requires explicit confirmation for protected paths (`agent-workspace/system`, `agent-workspace/evals`)
- Logs trust decisions for auditability
- Uses `ctx.mode` to differentiate behavior between TUI and RPC/JSON modes

### Extension Mode Awareness (Pi 0.79.0+)

Extensions leverage `ctx.mode` and `ctx.getSystemPromptOptions()` for context-aware behavior:

- `workspace-index.ts` returns compact output in JSON/RPC modes, full output in TUI mode
- `project-inventory.ts` includes execution mode in diagnostic output
- Mode detection enables appropriate UI responses based on execution context

## Development Commands

- `pnpm install` - Install dependencies
- `pnpm dev` - Start all workspace dev tasks
- `pnpm --filter web dev` - Run only web app
- `pnpm typecheck` - Type checking
- `pnpm lint` - Linting
- `pnpm build` - Production build
- `pnpm test` - Unit tests
- `pnpm e2e` - End-to-end tests
