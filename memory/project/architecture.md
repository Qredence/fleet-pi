# Fleet Pi Architecture

## Overview

Fleet Pi is a pnpm/Turborepo workspace for a browser-based coding-agent chat UI. The web app is built with TanStack Start, React, Tailwind CSS v4, and a shared agent-elements component package. The chat backend uses Pi's coding agent runtime with Amazon Bedrock models and streams newline-delimited JSON events to the browser.

## Workspace Structure

```
apps/
  web/          TanStack Start app and `/api/chat` backend route
packages/
  ui/           Shared React components, styles, and agent-elements UI
```

## Key Components

### Chat Backend (`apps/web/src/routes/api/chat.ts`)

- Creates or resumes Pi coding-agent sessions scoped to repository root
- Streams events as `application/x-ndjson`
- Uses Amazon Bedrock models via Pi's coding agent runtime
- Enables built-in tools: `read`, `write`, `edit`, `bash`
- Normalizes tool execution events into UI-compatible parts
- Maintains live Pi `AgentSessionRuntime` instances in memory with TTL
- Supports session management, queuing, aborts, and Plan mode

### Chat Frontend (`apps/web/src/routes/index.tsx`)

- Handles client-side stream processing and UI updates
- Manages session persistence via localStorage (`fleet-pi-chat-session`)
- Implements message rendering, tool parts display, and thinking states
- Provides queue follow-up functionality and session controls
- Integrates with resource browser for skills/prompts/extensions inspection

### Shared UI (`packages/ui/src/components/agent-elements/`)

- `AgentChat` - Main chat interface with message rendering
- `InputBar` - Message input with attachments, suggestions, and controls
- Tool renderers for `read`, `write`, `edit`, `bash` operations
- Question prompts for Plan mode interactions
- Model picker and mode selector components
- Resource browser (`ResourceCanvas`) for Pi skills/extensions/themes

## Data Flow

1. User submits message via InputBar
2. Frontend sends POST to `/api/chat` with message, model, mode, session metadata
3. Backend creates/resumes Pi runtime, processes message through agent session
4. Backend streams events (start, delta, tool, state, done) as NDJSON
5. Frontend parses stream and updates chat UI in real-time
6. Tool executions render as expandable cards in chat
7. Session metadata stored in localStorage for persistence/resumption

## Session Management

- Pi session JSONL files stored under `.fleet/sessions`
- Committed agent resources under `.pi/`
- Server keeps live runtime instances in memory (TTL: 10 minutes default)
- Invalid/outside session files trigger fresh repo-scoped session
- Supports session listing, resuming, creating new, and aborting

## Extensibility

- Project-local Pi resources in `.pi/`:
  - Skills: `.pi/skills/` (agent-elements, fleet-pi-orientation, etc.)
  - Extensions: `.pi/extensions/` (project-inventory, vendored filechanges/subagents)
  - Settings: `.pi/settings.json` (loads pi-autoresearch, pi-skill-palette, pi-autocontext)
- Resources browser exposes available skills, prompts, extensions, themes, context files
- Supports custom tool registration via extensions

## Development Commands

- `pnpm install` - Install dependencies
- `pnpm dev` - Start all workspace dev tasks
- `pnpm --filter web dev` - Run only web app
- `pnpm typecheck` - Type checking
- `pnpm lint` - Linting
- `pnpm build` - Production build
- `pnpm test` - Unit tests
- `pnpm e2e` - End-to-end tests
