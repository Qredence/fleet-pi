# Fleet Pi Workspace

## SNAPSHOT

type: monorepo  
langs: TypeScript, JSON, YAML  
runtimes: Node.js ≥22  
pkgManager: pnpm@11.0.9  
deliverables: web app (TanStack Start + Pi coding agent), shared UI lib  
rootConfigs: pnpm-workspace.yaml, eslint.config.js, .prettierrc (via plugin), tsconfig (workspace root delegates)

---

## PACKAGES

| name          | path        | type | deps                                                           | usedBy | role                                                                                    |
| ------------- | ----------- | ---- | -------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| web           | apps/web    | app  | @workspace/ui,pi-coding-agent,faster-auth,nitro,better-sqlite3 | —      | Browser-based Pi chat workspace with plan mode, durable agent-workspace, file I/O, auth |
| @workspace/ui | packages/ui | lib  | react,tailwindcss,lucide-react,motion,base-ui,sonner           | web    | Shared React 19 components, agent-elements chat UI, shadcn-inspired base                |

---

## DEPENDENCY GRAPH

apps/web → packages/ui, @earendil-works/pi-\* (pi-coding-agent, pi-ai, pi-agent-core)

---

## ARCHITECTURE

## web (`apps/web`)

entry: src/routes/\_\_root.tsx (TanStack Start), src/routes/index.tsx (main shell), src/router.tsx (router factory)  
routing: File-based; routes/ → routeTree.gen.ts (auto-generated)  
state: React Query (requests), localStorage (Pi session metadata), Pi persistent JSONL sessions (.fleet/sessions/)  
api: /api/chat → server-streaming NDJSON, /api/chat/{models,resources,settings,new,resume,abort,sessions,question}, /api/auth/\* (Better Auth), /api/workspace/{tree,file,search,items,reindex}  
db: SQLite via better-sqlite3; .fleet/auth.sqlite (auth), agent-workspace/indexes/workspace-projection.sqlite (workspace index)  
auth: Better Auth (email/password + optional Google OAuth); session-based; cookies  
build: Vite + TanStack Start plugin; dev :3000; bundle-report/stats.html  
dirs: src/routes → file-based routing, src/lib/pi → Pi server integration + chat protocol, src/lib/workspace → agent-workspace bootstrap/serving, src/lib/db → SQLite workspace projection schema, src/lib/auth → Better Auth setup, src/components → chat UI shells, src/lib/api → fetch utils

## @workspace/ui (`packages/ui`)

exports: components/_, lib/_, globals.css  
consumedBy: web  
dirs: src/components/agent-elements → main chat UI (AgentChat, InputBar, MessageList, tool renderers, types), src/components → shadcn-inspired primitives (Button, Dialog, Collapsible, etc.), src/lib → hooks, utils, styles

---

## STACK

web → framework: TanStack Start + React 19, routing: TanStack Router (file-based), state: React Query, db: better-sqlite3 (SQLite in-process), auth: better-auth (email/password + Google), runtime: Nitro/Hono, ai: Pi coding agent (pi-coding-agent v0.74), provider: amazon-bedrock

@workspace/ui → framework: React 19, styling: Tailwind CSS v4 + CVA, icons: Tabler Icons + Lucide, motion: Motion v12, toast: Sonner, ui: Base UI (accessible primitives)

---

## STYLE

- imports: path aliases (@/_, @workspace/ui/_), relative paths (lib/, components/)
- naming: camelCase functions, SCREAMING_SNAKE_CASE constants, PascalCase React components
- typing: strict TypeScript, explicit return types, no `any`
- errors: RequestContextError (status + message), proper HTTP status propagation
- testing: Vitest (unit, globals=false, node environment), Playwright (e2e, chromium only)
- lint: ESLint delegated per workspace; root config pulls app + ui configs
- formatting: Prettier standardized across workspace; lint-staged pre-commit hook
- patterns: Context/Provider hooks (usePiChat, auth hooks), composition over boolean props, streaming NDJSON events, plugin-based Pi extensions

---

## STRUCTURE

agent-workspace/ → Durable adaptive layer: memory/, plans/, artifacts/, evals/, pi/ (skills/prompts/extensions/packages), agent-home
.fleet/ → Runtime state: sessions/ (Pi session JSONL files), auth.sqlite
.pi/ → settings.json (Pi config), skills/, prompts/, extensions/ (project-local resources)
apps/web/src/routes/api/ → Endpoint handlers: chat/, auth/, workspace/
apps/web/src/lib/ → Core logic: pi/ (server runtime), workspace/ (bootstrap/serving), db/ (SQLite), auth/ (setup)
packages/ui/src/components/agent-elements/ → Chat UI primitives: AgentChat, InputBar, MessageList, tools/, types/, hooks/

---

## BUILD

workspaceScripts: dev (web only), build (all), lint, typecheck, test, e2e, format, syncpack, knip, jscpd, tech-debt, validate-agents-md, generate:docs

envFiles: .env, .env.example  
envPrefixes: AWS*\*, FLEET_PI*_, LOG*LEVEL, BETTER_AUTH*_, GOOGLE*CLIENT*\*, PI_AGENT_DIR  
ci: .github/workflows/ci.yml (setup, lint, typecheck, build, test, e2e, codeql, qa); blacksmith runners; concurrency=cancel  
docker: (none; local only)

---

## LOOKUP

add chat route → apps/web/src/routes/, apps/web/src/routes/api/chat/_.ts, export Route handler  
add Pi tool/command → .pi/extensions/_.ts (register in handler), apps/web/src/lib/pi/command-policy.ts (allowlist), apps/web/src/components/pi/ (UI)  
add shared component → packages/ui/src/components/, update packages/ui/package.json exports  
add workspace API → apps/web/src/routes/api/workspace/_.ts, apps/web/src/lib/workspace/server.ts (helpers)  
modify auth → apps/web/src/lib/auth/server.ts (Better Auth config), .env (secrets)  
modify chat protocol → apps/web/src/lib/pi/chat-protocol.ts (types), apps/web/src/lib/pi/server.ts (exports)  
modify workspace projection schema → apps/web/src/lib/db/workspace-projection.ts (migrations array)  
add test → _.test.ts or _.spec.ts; Vitest auto-discovers  
add e2e test → e2e/_.e2e.ts; Playwright auto-runs

---

## KEY FILES

web::apps/web/src/routes/index.tsx → Main chat shell, SessionMenu, ChatHeader, ChatWorkspaceShell, mode toggle | readFor: overall UI structure | affects: all chat UX | related: InputBar, MessageList, right panels

web::apps/web/src/lib/pi/server.ts → Pi exports (models, resources, settings, sessions, runtime, events) | readFor: server-side Pi integration | affects: /api/chat endpoints | related: server-runtime.ts, server-catalog.ts

web::apps/web/src/lib/pi/chat-protocol.ts → Chat message types, ChatStreamEvent, ChatResourcesResponse | readFor: browser-server chat contract | affects: client fetch, tool rendering | related: chat-fetch.ts, tool parts

web::apps/web/src/lib/workspace/server.ts → ensureAgentWorkspace, loadAgentWorkspaceTree, loadAgentWorkspaceFile | readFor: workspace serving | affects: /api/workspace endpoints | related: bootstrap-agent-workspace.ts

web::apps/web/src/lib/db/workspace-projection.ts → SQLite schema, migrations, seeding, queries (listItems, getDetail, search) | readFor: workspace indexing | affects: workspace tree/search | related: workspace-indexer.ts

web::apps/web/src/lib/auth/server.ts → Better Auth setup, SQLite schema, email+password+Google config | readFor: auth setup | affects: /api/auth routes | related: auth client at src/lib/auth/client.ts

web::apps/web/vite.config.ts → TanStack Start plugin, Tailwind, dotenv loader, FLEET_PI_REPO_ROOT | readFor: build config | affects: dev server, routes generation | related: tsconfig.json

web::apps/web/src/routes/api/chat.ts → Main streaming endpoint; session resume/create, Pi event batching | readFor: chat request handling | affects: browser chat fetch | related: chat/\* handlers

ui::packages/ui/src/components/agent-elements/agent-chat.tsx → AgentChat component wrapper, message rendering, tool parts | readFor: chat UI integration | affects: main chat display | related: InputBar, MessageList, chat-types.ts

ui::packages/ui/src/components/agent-elements/chat-types.ts → ToolPart, ToolCardProps, MessagePartConfig | readFor: chat protocol <→ UI mapping | affects: tool rendering | related: tools/ folder

web::apps/web/package.json | readFor: web dependencies, scripts | affects: dev/build targets | related: root package.json

ui::packages/ui/package.json | readFor: ui exports, dependencies | affects: shared components | related: root package.json

web::.pi/settings.json | readFor: Pi packages, skills, extensions, model config | affects: runtime catalog | related: .pi/extensions/, .pi/skills/

web::apps/web/src/routes/api/chat/models.ts, resources.ts, settings.ts | readFor: catalog loading | affects: UI dropdowns, tool discovery | related: server-catalog.ts, server-settings.ts

web::eslint.config.js | readFor: lint rules | affects: pre-commit ESLint | related: apps/web/eslint.config.js, packages/ui/eslint.config.ts

web::.github/workflows/ci.yml | readFor: CI steps | affects: PR checks | related: no local config, GH Actions only

---

## CONVENTIONS

### Pi Session Management

- Browser stores Pi session metadata in localStorage (`sessionFile`, `sessionId`).
- Server maintains live `AgentSessionRuntime` instances with TTL (FLEET_PI_RUNTIME_TTL_MS, default 10 min).
- Pi sessions are persistent JSONL files at .fleet/sessions/\*.jsonl.
- Invalid/outside session files trigger fresh project-scoped session.

### Tool Policy

- Agent mode: full read/write/edit/bash + approved external Pi tools (init_experiment, run_experiment, subagent, etc.).
- Plan mode: read-only tools only (read, bash, find, ls, grep, project_inventory, workspace_index).
- Tool allowlist in command-policy.ts, injected via plan-mode.ts extension.

### Agent Workspace Layout

- agent-workspace/ owns durable project state: memory/{architecture,decisions,preferences}, plans/, artifacts/, evals/, pi/{skills,prompts,extensions}.
- .pi/settings.json bridges backward compat, points to workspace-native resources.
- Canonical project memory in agent-workspace/memory/project/\*.md.

### Chat Protocol

- Browser → Server: POST /api/chat { message, sessionFile?, sessionId? }.
- Server → Browser: newline-delimited JSON stream (ChatStreamEvent[]).
- Events hydrated into Parts (tool-_, code-_, message-\*) on browser.

### Workspace Projection

- SQLite at agent-workspace/indexes/workspace-projection.sqlite.
- Tables: projects, workspace_roots, items (files/dirs), item_versions, semantic_records.
- Seeded on first run; migrations applied for schema upgrades.
- Queried by /api/workspace/tree, /api/workspace/search.

### Build Artifacts

- Turbo cache at .turbo/cache.
- Bundle report at apps/web/bundle-report/stats.html (Rollup visualizer).
- Generated routes at apps/web/src/routeTree.gen.ts (DO NOT EDIT).
