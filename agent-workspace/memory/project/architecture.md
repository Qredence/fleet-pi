# Architecture

Durable architecture notes for Fleet Pi's Pi-native agent workspace and chat runtime.

## Stable structure

- `agent-workspace/` is Fleet Pi's durable adaptive layer: repo-local memory, policies, plans, evals, skills, artifacts, indexes, scratch space, and workspace-native Pi resources.
- `.pi/settings.json` is the Pi compatibility bridge that points Pi at workspace-native resources under `agent-workspace/pi/{skills,prompts,extensions,packages}` while keeping provider/model settings in Pi's normal settings shape.
- `.pi/extensions/*` contains trusted executable bridge extensions; `agent-workspace/pi/extensions/staged` contains proposed executable resources, and `agent-workspace/pi/extensions/enabled` contains approved active workspace extensions.
- `apps/web` is a TanStack Start app whose chat API streams newline-delimited JSON from Pi sessions to the browser.
- `packages/hax-design` contains shared agent-elements components and tool renderers used by the Fleet Pi chat UI.
- Memory snippet injection is dynamic and prompt-aware: `.pi/extensions/lib/workspace-memory-index.ts` extracts all canonical bullet snippets, tokenizes the latest user prompt, filters stop-words, scores snippets globally by prompt-term overlap, and injects the highest-signal matches ahead of deterministic fallback snippets in the retained `workspace-context` message.
- The Settings Dialog (`packages/hax-design/src/components/fleet-pi/pi/settings-dialog.tsx` / Configurations tab) manages and edits `.pi/settings.json` overrides, supporting hot-reload of active runtimes.
- Daytona Sandbox Integration (`apps/web/src/lib/daytona/sandbox-operations.ts` / Daytona skill) provisions isolated secure sandboxes for each user's Workspace panel and tool executions, swapping local system operations (Bash, Read, Write, Edit, Grep, Find, Ls) with sandbox-scoped executions when enabled.

## Project Memory Architecture

The `agent-workspace/memory/` subtree acts as Fleet Pi's long-term memory. It is organized to prevent context flooding while guaranteeing highly relevant, durable recall.

### 1. Canonical Project Memory Registry

Durable facts are distributed across five canonical, non-overlapping Markdown files:

- `architecture.md`: System topology, stable layout invariants, runtime boundaries, key data flows, and codebase source anchors.
- `decisions.md`: Active and past Architectural Decisions (ADRs), status states, and structural contexts.
- `preferences.md`: Human and agent-level engineering style guidelines, development conventions, and preferred tool protocols.
- `open-questions.md`: Active research subjects, architectural uncertainties, and exploration avenues.
- `known-issues.md`: Tracked friction points, active workspace bugs, and corresponding workarounds.

### 2. Prompt-Aware Context Retrieval Pipeline

To optimize token budgets, Fleet Pi uses a tokenized dynamic scoring engine:

```
[User Message] ──> [Stop-Word Filtering] ──> [Prompt Term Set]
                                                   │
  ┌────────────────────────────────────────────────┘
  ▼
[Global Scorer] ──> Scans all bullet-point snippets in the 5 Canonical Memory Files
  │
  ├──> Scored by prompt-term overlap
  └──> Stable-sorted descending (higher scores first; fallback to canonical order)
        │
        ▼
  [Top-10 Snippets] ──> Written back into the retained `workspace-context` message for the active turn
```

### 3. Key Memory Indexes and Types

The retrieval engine utilizes the following TypeScript domain models located in `.pi/extensions/lib/workspace-memory-index.ts`:

- `ProjectMemoryFile`: Reflects the schema of a parsed memory file, containing headings, title, path, and extracted bullet-point snippets.
- `ProjectMemoryIndex`: Holds arrays of `canonical` and `orphaned` memory files, along with the source root directory.

## Runtime boundaries

- `apps/web/src/lib/pi/server-runtime.ts` creates and retains Pi `AgentSessionRuntime` instances, manages the hot-reload of project settings, secures user-specific LLM keys decrypted via `BETTER_AUTH_SECRET`, and routes sandbox-scoped tools when Daytona is enabled.
- `apps/web/src/routes/api/chat.ts` is the primary streaming endpoint; it sanitizes prompts, creates/resumes Pi runtimes, records run provenance, and normalizes Pi events for the browser.
- `apps/web/src/lib/pi/plan-mode.ts` owns Agent, Plan, and Harness mode boundaries, defining strict tool allowlists (e.g., read-only tools for Plan mode, full coding tools for Agent mode, workspace/sandbox/resource commands for Harness mode) and blocking unsafe bash execution.
- `apps/web/src/lib/pi/server.ts` owns server-only Pi setup: session validation, event normalization, model discovery, and transcript hydration. It is the boundary between Pi internals and the chat API layer.
- `apps/web/src/lib/workspace/server.ts` owns the `agent-workspace/` layout: creates seeded Markdown stubs without overwriting, returns the sorted read-only filesystem tree, and safely previews files within the active `workspaceRoot`.
- `.pi/extensions/workspace-context.ts` injects workspace orientation, active plan status, and project memory recall snippets, then rewrites the retained `workspace-context` message from the latest user prompt so recall stays turn-relevant.
- `.pi/extensions/workspace-index.ts`, `workspace-write.ts`, `resource-install.ts`, and `project-inventory.ts` expose the agent-workspace as Pi tools.

## Key data flows

- Browser chat sends one user message plus session metadata to `/api/chat`; the server resumes or creates a persistent Pi JSONL session and streams normalized events back to the client.
- Pi resources flow from `.pi/settings.json` through Pi resource loading into runtime skills, prompts, extensions, packages, and the Fleet Pi resource browser.
- Workspace memory flows from `agent-workspace/memory/project/*.md` through `.pi/extensions/lib/workspace-memory-index.ts` into startup context and `workspace_index` summaries.
- Chat-installed resources flow through `resource_install` into `agent-workspace/pi/*`; executable extensions and package bundles should remain staged unless explicitly activated.
- Run evidence flows into provenance and artifacts, then should be synthesized into memory, plans, evals, or backlog items when durable learning is justified.
- When `FLEET_PI_CHAT_DATABASE_URL` is set, Pi session entries, run events, tool executions, and file mutations are mirrored into Neon Postgres tables prefixed with `pi_`. Pi JSONL remains the source of truth; mirror failures must not break chat streaming.

## Source anchors

- `apps/web/src/lib/pi/server-runtime.ts`
- `apps/web/src/lib/pi/server-shared.ts`
- `apps/web/src/lib/pi/server-settings.ts`
- `apps/web/src/lib/pi/server.ts`
- `apps/web/src/routes/api/chat.ts`
- `apps/web/src/lib/pi/plan-mode.ts`
- `apps/web/src/lib/workspace/server.ts`
- `apps/web/src/lib/daytona/sandbox-operations.ts`
- `apps/web/src/lib/db/pi-session-mirror.ts`
- `apps/web/src/lib/db/chat-postgres-schema.ts`
- `.pi/settings.json`
- `.pi/extensions/workspace-context.ts`
- `.pi/extensions/lib/workspace-memory-index.ts`
- `apps/web/src/lib/pi/workspace-memory-index.spec.ts`
- `agent-workspace/AGENTS.md`
- `agent-workspace/ARCHITECTURE.md`
