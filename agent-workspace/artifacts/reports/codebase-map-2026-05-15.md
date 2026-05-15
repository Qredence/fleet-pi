# Fleet Pi — Codebase Map

_Generated: 2026-05-15_

---

## 1. Monorepo Layout

| Workspace     | Package name    | Role                                                          |
| ------------- | --------------- | ------------------------------------------------------------- |
| `apps/web`    | `web`           | TanStack Start SPA + API — the main user-facing app           |
| `packages/ui` | `@workspace/ui` | Shared React UI components, agent-elements, shadcn primitives |

**Root tooling**

- `pnpm-workspace.yaml` — declares the two workspaces above plus extensive `overrides` / `allowBuilds`.
- `turbo.json` — Turbo pipeline: `build`, `lint`, `format`, `typecheck`, `test`, `e2e`, `dev`.
- `package.json` (root) — `fleet-pi` v0.0.1; `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `diff`, `zod` as prod deps; Husky + lint-staged pre-commit hooks.
- `eslint.config.js` — root ESLint config delegating to workspace configs.
- `tsconfig.json` — root TypeScript config.
- `knip.json` — dead-export / dead-dep detection config.

---

## 2. `apps/web` — TanStack Start Application

### 2a. File Routes (`apps/web/src/routes/`)

| Route file                 | HTTP path                     | Purpose                                                                         |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `__root.tsx`               | `/`                           | Root layout (providers, theme, auth shell)                                      |
| `index.tsx`                | `/`                           | Main chat page (agent chat + right-panel canvas: resources, workspace, configs) |
| `login.tsx`                | `/login`                      | Login / auth page                                                               |
| `api/chat.ts`              | `POST /api/chat`              | Primary streaming chat endpoint (NDJSON)                                        |
| `api/chat/models.ts`       | `GET /api/chat/models`        | Model list from Pi ModelRegistry                                                |
| `api/chat/resources.ts`    | `GET /api/chat/resources`     | Pi resource discovery (skills, prompts, extensions, diagnostics)                |
| `api/chat/session.ts`      | `GET /api/chat/session`       | Single session metadata                                                         |
| `api/chat/sessions.ts`     | `GET /api/chat/sessions`      | All sessions list                                                               |
| `api/chat/new.ts`          | `POST /api/chat/new`          | Create a new Pi session                                                         |
| `api/chat/resume.ts`       | `POST /api/chat/resume`       | Resume existing Pi session                                                      |
| `api/chat/abort.ts`        | `POST /api/chat/abort`        | Abort in-flight Pi turn                                                         |
| `api/chat/question.ts`     | `POST /api/chat/question`     | Answer a Pi questionnaire prompt                                                |
| `api/chat/settings.ts`     | `GET/POST /api/chat/settings` | Read/write `.pi/settings.json` overrides                                        |
| `api/chat/run.ts`          | `GET /api/chat/run`           | Single run provenance record                                                    |
| `api/chat/runs.ts`         | `GET /api/chat/runs`          | All run provenance records                                                      |
| `api/chat/provenance.ts`   | `GET /api/chat/provenance`    | Aggregated provenance data                                                      |
| `api/health.ts`            | `GET /api/health`             | App health check                                                                |
| `api/auth/$.ts`            | `* /api/auth/*`               | Better Auth catch-all handler                                                   |
| `api/workspace/tree.ts`    | `GET /api/workspace/tree`     | `agent-workspace/` filesystem tree                                              |
| `api/workspace/file.ts`    | `GET /api/workspace/file`     | Preview a workspace file                                                        |
| `api/workspace/item.ts`    | `GET /api/workspace/item`     | Single indexed workspace item                                                   |
| `api/workspace/items.ts`   | `GET /api/workspace/items`    | Workspace item list / search                                                    |
| `api/workspace/search.ts`  | `GET /api/workspace/search`   | Full-text workspace search                                                      |
| `api/workspace/reindex.ts` | `POST /api/workspace/reindex` | Trigger SQLite workspace re-index                                               |
| `api/workspace/health.ts`  | `GET /api/workspace/health`   | Workspace index health                                                          |

### 2b. Lib Modules (`apps/web/src/lib/`)

**`pi/`** — Pi agent integration (server + browser)

| File                               | Purpose                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `server.ts`                        | Master Pi server setup: session validation, event normalization, model discovery, transcript hydration |
| `server-runtime.ts`                | `AgentSessionRuntime` lifecycle + in-memory TTL cache                                                  |
| `server-sessions.ts`               | Pi session CRUD helpers                                                                                |
| `server-chat-stream.ts`            | NDJSON streaming loop from Pi runtime                                                                  |
| `server-settings.ts`               | `.pi/settings.json` read/write logic                                                                   |
| `server-shared.ts`                 | Shared server-only Pi helpers                                                                          |
| `server-utils.ts`                  | Misc server utilities                                                                                  |
| `server-catalog.ts`                | Resource catalog construction                                                                          |
| `chat-protocol.ts`                 | Browser-safe NDJSON event type definitions                                                             |
| `chat-protocol.zod.ts`             | Zod schemas for chat protocol events                                                                   |
| `chat-client.ts`                   | Browser client wrapping `/api/chat` stream                                                             |
| `chat-fetch.ts`                    | Fetch wrapper for chat API                                                                             |
| `chat-helpers.ts`                  | Event/message normalisation helpers                                                                    |
| `chat-message-helpers.ts`          | Per-message part helpers                                                                               |
| `chat-queries.ts`                  | TanStack Query hooks for chat data                                                                     |
| `chat-stream-state.ts`             | Client-side streaming state machine                                                                    |
| `plan-mode.ts`                     | Web-native Pi Plan Mode extension (read-only tools, plan extraction, question flow)                    |
| `plan-parser.ts`                   | Parse numbered `Plan:` steps from assistant output                                                     |
| `plan-state.ts`                    | Plan execution state (steps, progress, mode)                                                           |
| `plan-questionnaire.ts`            | Plan-mode question helpers                                                                             |
| `command-policy.ts`                | Bash command allow/block policy for Plan mode                                                          |
| `circuit-breaker.ts`               | Opossum circuit breaker for Pi runtime calls                                                           |
| `use-pi-chat.ts`                   | Top-level React hook composing Pi chat state                                                           |
| `use-chat-shell-state.ts`          | Shell-level ephemeral chat state (queued messages, abort)                                              |
| `use-chat-storage.ts`              | localStorage session-metadata persistence                                                              |
| `use-chat-view.ts`                 | View-level scroll / message-list state                                                                 |
| `resource-install.ts`              | Browser-side resource install trigger                                                                  |
| `resource-install-refresh.ts`      | Post-install reload logic                                                                              |
| `resource-expectations.ts`         | Expected resource presence checks                                                                      |
| `workspace-resource-catalog.ts`    | Workspace-level Pi resource catalog                                                                    |
| `run-provenance.ts`                | Run provenance data helpers                                                                            |
| `provenance-query.ts`              | TanStack Query hooks for provenance                                                                    |
| `url-security.ts` (lib/)           | URL allow-list for web-fetch tool                                                                      |
| `workspace-memory-index.ts` (lib/) | Pi workspace memory index integration                                                                  |

**`workspace/`** — `agent-workspace/` server management

| File                            | Purpose                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `server.ts`                     | Workspace layout bootstrap, sorted read-only tree, safe file preview |
| `bootstrap-agent-workspace.ts`  | Seeds Markdown stubs without overwriting existing files              |
| `workspace-contract.ts`         | Zod contract types for workspace API responses                       |
| `workspace-index-types.ts`      | Types for SQLite workspace projection                                |
| `workspace-query.ts`            | TanStack Query hooks for workspace endpoints                         |
| `workspace-semantic-parsers.ts` | Parse frontmatter / headings from workspace Markdown                 |

**`db/`** — SQLite workspace indexer

| File                      | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `workspace-indexer.ts`    | Crawl `agent-workspace/` and write to SQLite |
| `workspace-projection.ts` | Query the SQLite projection                  |
| `workspace-provenance.ts` | Provenance record store in SQLite            |

**`auth/`**

| File          | Purpose                                      |
| ------------- | -------------------------------------------- |
| `server.ts`   | Better Auth server setup with SQLite adapter |
| `client.ts`   | Better Auth browser client                   |
| `use-auth.ts` | React hook for auth state                    |

**Other top-level lib files**

| File               | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `app-runtime.ts`   | Resolve active runtime context (projectRoot), falling back to repo root |
| `api-utils.ts`     | Shared API response/error helpers                                       |
| `canvas-utils.ts`  | Resizable canvas geometry helpers                                       |
| `logger.ts`        | Pino logger (pretty in dev, JSON in prod)                               |
| `query-client.ts`  | TanStack Query client singleton                                         |
| `pii/sanitizer.ts` | PII scrubbing before logging                                            |

### 2c. React Components (`apps/web/src/components/`)

| File                          | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `chat-command-palette.tsx`    | Slash-command / skill palette modal                                |
| `chat-right-panels.tsx`       | Right-side canvas container (resources / workspace / configs tabs) |
| `pi/config-panel.tsx`         | Configurations tab — reads/writes `.pi/settings.json`              |
| `pi/resources-panel.tsx`      | Pi Resources tab — skills, prompts, extensions, diagnostics        |
| `pi/workspace-panel.tsx`      | Workspace tab — `agent-workspace/` tree + Markdown preview         |
| `pi/resizable-canvas.tsx`     | Resizable right-panel (max 70% viewport, mobile overlay)           |
| `pi/right-panel-launcher.tsx` | Trigger button for the right panel                                 |
| `pi/shared.tsx`               | Shared panel components                                            |
| `pi/skeleton-loaders.tsx`     | Skeleton loading states for panels                                 |
| `pi/tool-renderers.tsx`       | Maps Pi tool events → agent-elements tool parts                    |
| `ui-error-boundary.tsx`       | React error boundary wrapper                                       |

---

## 3. `packages/ui` — Shared UI Library (`@workspace/ui`)

### Exports

```json
"./globals.css"      → styles/globals.css
"./lib/*"            → src/lib/*
"./components/*"     → src/components/*
```

### Agent Elements (`src/components/agent-elements/`)

The primary chat/tool rendering system:

| File                             | Purpose                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| `agent-chat.tsx`                 | Top-level `<AgentChat>` container                              |
| `chat-types.ts`                  | Browser-safe chat protocol part types (shared with `apps/web`) |
| `types.ts`                       | Internal agent-elements type aliases                           |
| `types/timeline.ts`              | Timeline / turn structure types                                |
| `message-list.tsx`               | Scrolling message list                                         |
| `user-message.tsx`               | User message bubble                                            |
| `markdown.tsx`                   | Streaming Markdown renderer (streamdown)                       |
| `input-bar.tsx`                  | Composed InputBar (typing, mode-selector, model-picker, send)  |
| `input/typing.tsx`               | Textarea input                                                 |
| `input/mode-selector.tsx`        | Agent / Plan mode toggle                                       |
| `input/model-picker.tsx`         | Model dropdown                                                 |
| `input/send-button.tsx`          | Send + abort button                                            |
| `input/attachment-button.tsx`    | File attachment button                                         |
| `input/file-attachment.tsx`      | File attachment chip                                           |
| `input/suggestions.tsx`          | Prompt suggestion chips                                        |
| `input/popover.tsx`              | Generic input popover                                          |
| `question/question-prompt.tsx`   | Inline question prompt card                                    |
| `question/question-tool.tsx`     | `tool-Question` part renderer                                  |
| `tools/tool-renderer.tsx`        | Dispatch to per-tool renderers                                 |
| `tools/tool-registry.ts`         | Registry of tool name → renderer                               |
| `tools/tool-row-base.tsx`        | Base collapsible tool row                                      |
| `tools/tool-group.tsx`           | Groups multiple tool calls                                     |
| `tools/bash-tool.tsx`            | `tool-Bash` card                                               |
| `tools/edit-tool.tsx`            | `tool-Edit` diff card                                          |
| `tools/generic-tool.tsx`         | Fallback generic tool card                                     |
| `tools/mcp-tool.tsx`             | MCP tool card                                                  |
| `tools/plan-tool.tsx`            | Plan step tracker card                                         |
| `tools/search-tool.tsx`          | Search result card                                             |
| `tools/subagent-tool.tsx`        | Subagent delegation card                                       |
| `tools/thinking-tool.tsx`        | Thinking / reasoning card                                      |
| `tools/todo-tool.tsx`            | Todo / checklist card                                          |
| `tools/tool-approval-footer.tsx` | Approval gate footer                                           |
| `utils/tool-adapters.ts`         | Normalize Pi tool events to agent-elements parts               |
| `utils/tool-part-normalizer.ts`  | Low-level part normalization                                   |
| `utils/format-tool.ts`           | Format tool args / output for display                          |
| `utils/cn.ts`                    | `clsx` + `tailwind-merge` helper                               |
| `icons.tsx`                      | Shared icon wrappers                                           |
| `icons/file-ext-icon.tsx`        | File-extension icon lookup                                     |
| `icons/source-icons.ts`          | Source / provider icon map                                     |
| `image-lightbox.tsx`             | Full-screen image lightbox                                     |
| `spiral-loader.tsx`              | Animated spiral loading indicator (Lottie)                     |
| `text-shimmer.tsx`               | Shimmer text animation                                         |
| `error-message.tsx`              | Inline error display                                           |

### Primitive Components (`src/components/`)

`button.tsx`, `collapsible.tsx`, `command.tsx`, `dialog.tsx`, `input.tsx`, `input-group.tsx`, `select.tsx`, `skeleton.tsx`, `sonner.tsx`, `switch.tsx`, `textarea.tsx` — shadcn-style primitives (Base UI + CVA).

### Utils (`src/lib/utils.ts`)

`cn()` — class merging utility.

---

## 4. `.pi/` — Pi Agent Runtime Resources

### `.pi/settings.json`

```json
{
  "packages": [
    "npm:pi-autoresearch",
    "npm:pi-skill-palette",
    "npm:pi-autocontext",
    "npm:pi-subagents"
  ],
  "skills": ["../agent-workspace/pi/skills"],
  "prompts": ["../agent-workspace/pi/prompts"],
  "extensions": [
    "extensions/bedrock-bearer-auth",
    "extensions/resource-install",
    "extensions/vendor/filechanges",
    "extensions/vendor/subagents",
    "../agent-workspace/pi/extensions/enabled"
  ],
  "defaultProvider": "amazon-bedrock",
  "defaultModel": "us.anthropic.claude-sonnet-4-6",
  "defaultThinkingLevel": "high",
  "enabledModels": ["amazon-bedrock/*"]
}
```

### `.pi/skills/`

| Skill                             | Purpose                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| `fleet-pi-orientation/SKILL.md`   | Map the Fleet Pi codebase before planning/editing                      |
| `chat-runtime-debugging/SKILL.md` | Diagnose chat runtime failures (streams, sessions, Bedrock, Plan mode) |
| `agent-ui-workflows/SKILL.md`     | Build/modify agent UI (InputBar, tool cards, resource drawer)          |

### `.pi/extensions/`

| Extension                       | Purpose                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `bedrock-bearer-auth.ts`        | Injects AWS Bedrock bearer auth token                                        |
| `resource-install.ts`           | `resource_install` tool — installs Pi skills/prompts/extensions/packages     |
| `workspace-index.ts`            | `workspace_index` tool — workspace orientation                               |
| `workspace-write.ts`            | `workspace_write` tool — durable workspace writes                            |
| `workspace-context.ts`          | Injects workspace context into every session                                 |
| `web-fetch.ts`                  | `web_fetch` tool — safe HTTPS fetch                                          |
| `project-inventory.ts`          | `project_inventory` tool — Pi resource + app surface discovery               |
| `vendor/filechanges/index.ts`   | `/filechanges`, `/filechanges-accept`, `/filechanges-decline` slash commands |
| `vendor/subagents/index.ts`     | `subagent` tool — delegates to researcher/scout/worker/explorator agents     |
| `lib/resource-install.ts`       | Shared resource-install helpers                                              |
| `lib/url-security.ts`           | URL allow-list for web-fetch                                                 |
| `lib/workspace-memory-index.ts` | Workspace memory index helpers                                               |

### `.pi/npm/`

Pi packages installed locally (pi-autoresearch, pi-skill-palette, pi-autocontext, pi-subagents, zod).

---

## 5. `agent-workspace/` — Agent Memory Layer

### Structure

```
agent-workspace/
├── AGENTS.md          Agent operating constraints (injected into every session)
├── ARCHITECTURE.md    Workspace architecture reference
├── README.md          Human overview
├── index.md           Machine-readable workspace index
├── manifest.json      Workspace manifest
│
├── system/            Protected: identity, behavior, constraints, policies
├── memory/
│   ├── project/       architecture.md, decisions.md, preferences.md,
│   │                  open-questions.md, known-issues.md
│   ├── research/      index.md, qredence-fleet-rlm.md
│   └── daily/         (ephemeral, gitignored)
│
├── plans/
│   ├── active/        (empty — no active plans)
│   ├── completed/
│   ├── abandoned/
│   └── backlog.md
│
├── skills/            Workspace-local skills (codebase-research, doc-gardening,
│                      execution-plan, frontend-design, memory-synthesis)
├── evals/             agentic-coding.md, memory-quality.md, tool-use.md,
│                      regression-checks.md
│
├── artifacts/
│   ├── reports/       architecture-review-2026-05-12.md,
│   │                  explorator-agent-spec.md, (this file)
│   ├── datasets/
│   ├── diagrams/
│   └── traces/
│
├── pi/                Runtime Pi resources
│   ├── skills/        (empty placeholder)
│   ├── prompts/       (empty placeholder)
│   ├── extensions/
│   │   ├── enabled/   explorator-agent.ts, web-fetch/index.ts
│   │   └── staged/    (empty)
│   └── packages/      (empty)
│
├── indexes/           workspace-projection.sqlite (SQLite index)
├── scratch/tmp/       Ephemeral scratch
└── policies/          constraints.md, workspace-policy.md, tool-policy.md,
                       self-improvement-policy.md
```

### Notable Installed Extensions

- `agent-workspace/pi/extensions/enabled/explorator-agent.ts` — the **explorator** subagent definition
- `agent-workspace/pi/extensions/enabled/web-fetch/index.ts` — additional web-fetch extension

---

## 6. Key Config Files

| File                  | Purpose                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `turbo.json`          | Turbo task graph (build→deps, dev=persistent+no-cache)                                                                |
| `package.json`        | Root scripts: build/dev/lint/format/typecheck/test/e2e/syncpack/knip/jscpd/tech-debt/validate-agents-md/generate:docs |
| `pnpm-workspace.yaml` | Workspace declarations + dep overrides + `allowBuilds`                                                                |
| `tsconfig.json`       | Root TypeScript config                                                                                                |
| `eslint.config.js`    | Root ESLint, delegates to workspace configs                                                                           |
| `knip.json`           | Knip dead-code/dep config                                                                                             |
| `.pi/settings.json`   | Pi runtime: provider, model, thinking level, packages, resource paths                                                 |
| `.husky/pre-commit`   | Runs `lint-staged` on every commit                                                                                    |

---

## 7. `docs/` — Documentation

| File                                                      | Topic                                                     |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `README.md`                                               | Docs hub / entrypoint                                     |
| `quickstart.md`                                           | Primary onboarding — setup and local verification         |
| `architecture.md`                                         | Architecture narrative (generated)                        |
| `architecture.mmd`                                        | Mermaid source for architecture diagram                   |
| `project-structure.md`                                    | Project structure reference (generated)                   |
| `api.md`                                                  | API reference (generated)                                 |
| `agent-workspace.md`                                      | How `agent-workspace/` acts as the durable adaptive layer |
| `adaptive-workspace.md`                                   | Deeper dive on adaptive workspace patterns                |
| `runtime-sdk-integration.md`                              | Pi runtime + SDK integration guide                        |
| `codex.md`                                                | Advanced Codex worktree setup (not default path)          |
| `runbooks.md`                                             | Operational runbooks                                      |
| `adr/0001-agent-workspace-as-canonical-adaptive-state.md` | ADR: agent-workspace as canonical state                   |

---

## 8. Summary

Fleet Pi is a **pnpm monorepo** with two workspaces:

- **`apps/web`** — A TanStack Start app serving a browser-based coding-agent interface. The backend exposes ~25 API routes covering Pi chat streaming, session lifecycle, resource discovery, workspace tree/file, provenance, and settings. The frontend is a single-page React 19 app with a streaming AgentChat, a resizable right-panel (Resources / Workspace / Configs tabs), and Plan mode.

- **`packages/ui`** — A shared UI kit exporting agent-elements (AgentChat, InputBar, all tool cards, message list, Markdown renderer) plus shadcn-style primitives.

The app integrates deeply with **`@earendil-works/pi-coding-agent`** via a custom runtime harness (`server-runtime.ts`) that keeps live `AgentSessionRuntime` instances in memory with a TTL, streams NDJSON events to the browser, and normalises Pi tool events into the agent-elements rendering model.

**Plan mode** is a web-native Pi extension (`plan-mode.ts`) that restricts tools to read-only operations, extracts numbered plan steps, and surfaces inline question prompts in the InputBar.

The **`agent-workspace/`** directory is the durable agent memory layer — seeded Markdown stubs for project memory, plans, skills, evals, artifacts, and Pi runtime resources installed by the agent itself.
