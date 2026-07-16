# AGENTS.md

## Project Conventions

- Use `pnpm` from the repository root for dependency and task commands.
- The root `pnpm-lock.yaml` is the canonical lockfile; do not create nested app lockfiles.
- Run workspace commands with `pnpm --filter <workspace> <script>` when only one package is affected.

## Validation

- Install/update dependencies with `pnpm install`.
- Type-check with `pnpm typecheck`.
- Lint with `pnpm lint`.
- Build with `pnpm build`.
- Run unit tests with `pnpm test`.
- Run end-to-end tests with `pnpm e2e`.
- Check dependency version consistency with `pnpm syncpack`.
- Auto-fix dependency version drift with `pnpm syncpack:fix`.
- Detect unused exports and dependencies with `pnpm knip`.
- Detect duplicate code with `pnpm jscpd`.
- Scan for tech debt markers with `pnpm tech-debt`.
- Validate AGENTS.md commands with `pnpm validate-agents-md`.
- Analyze bundle size with `pnpm build --filter web` then open `apps/web/bundle-report/stats.html`.
- Apply Neon chat mirror migrations with `pnpm chat:migrate` after setting `FLEET_PI_CHAT_MIGRATION_DATABASE_URL`.
- Verify Vercel deployment readiness with `pnpm verify-deployment-readiness` (set migration URLs to validate Neon grants/RLS).
- Quarantine legacy ownerless mirror rows with `pnpm quarantine-orphan-sessions` (owner URL required; use `--purge` only after approval).
- Validate the Vercel build output with `NITRO_PRESET=vercel pnpm --filter web build:vercel` when deployment routing changes.

## Public Docs & Community Health

- `README.md` is the public landing page. Keep it concise, user-focused, and centered on the recommended standalone path.
- `docs/README.md` is the docs hub and the recommended entrypoint for the human-facing docs set.
- `docs/quickstart.md` is the primary onboarding doc for setup and local verification.
- `docs/agent-workspace.md` explains how `agent-workspace/` acts as Fleet Pi's durable adaptive layer.
- `docs/api.md`, `docs/project-structure.md`, and `docs/architecture.md` are secondary reference docs. If they drift, fix the generator or its source inputs rather than hand-waving around stale output.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and the issue templates are part of the public repository surface and should stay aligned with actual maintainer workflow.
- When doc-generation sources change, run `pnpm generate:docs`. When command examples or AGENTS instructions change, run `pnpm validate-agents-md`.

## Devcontainer

The repository includes a VS Code devcontainer configuration at `.devcontainer/devcontainer.json` with Node.js, pnpm, Git, and recommended editor extensions. Open the project in a devcontainer to get a fully pre-configured development environment. Port `3000` is forwarded automatically and `pnpm install` runs after container creation.

## Vercel Deployment

- The `fleet-pi-web` Vercel project builds from `apps/web`; keep Vercel-specific settings in `apps/web/vercel.json`.
- Vercel builds run `NITRO_PRESET=vercel pnpm build:vercel`; TanStack Start emits `dist/`, then `apps/web/scripts/build-vercel-output.mjs` packages it into `.vercel/output`.
- Better Auth on Vercel requires `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, and `FLEET_PI_AUTH_DATABASE_URL`; the auth database must be Neon/Postgres, not the local SQLite fallback.
- BYOK provider credentials and Pi session mirroring on Vercel also require `FLEET_PI_CHAT_DATABASE_URL`. Run `pnpm chat:migrate` after deploy when schema changes affect `pi_user_providers` (for example `google-genai` → `google` remap).
- `PATCH /api/chat/settings` requires authentication on Vercel; settings hot-reload applies only to the signed-in user's active sessions. Vercel Preview deployments need `BETTER_AUTH_SECRET`, `FLEET_PI_AUTH_DATABASE_URL`, and `FLEET_PI_CHAT_DATABASE_URL` scoped to Preview (not only feature-branch aliases). Run `pnpm chat:migrate` with `FLEET_PI_CHAT_MIGRATION_DATABASE_URL` after schema or ownership-probe changes.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are Better Auth OAuth credentials. Register the production callback as `https://fleet-pi-web.vercel.app/api/auth/callback/google`.
- Daytona on Vercel requires each authenticated user to BYOK their own Daytona API key (`daytona` in `pi_user_providers`); org `DAYTONA_API_KEY` is local/dev fallback only. Optional: `DAYTONA_TARGET`, `DAYTONA_API_URL`, `DAYTONA_WEBHOOK_SECRET`, `FLEET_PI_REPOSITORY_URL`.

## Pre-commit Hooks

The repository uses **Husky** + **lint-staged** to enforce code quality before every commit.

- The pre-commit hook is registered at `.husky/pre-commit` and runs `pnpm exec lint-staged`.
- `git config core.hooksPath` must return `.husky`.
- Staged files are automatically processed:
  - **Prettier** (`prettier --write`) runs on `*.{ts,tsx,js,jsx,json,css,md}`
  - **ESLint** (`eslint --fix`) runs on `{apps,packages}/**/*.{ts,tsx,js,jsx}`
- Commits are blocked if ESLint reports errors that cannot be auto-fixed.
- The root `eslint.config.js` delegates to workspace configs so lint-staged works from the repository root.

## Architecture Notes

- `apps/web` is a TanStack Start app. File routes are generated into `apps/web/src/routeTree.gen.ts`; do not edit that generated file manually.
- `packages/hax-design` is the shadcn-style registry (`components.json`, primitives, `agent-elements/`, generative UI in `components/openui/`, Fleet Pi UI under `components/fleet-pi/`). Import from `@workspace/hax-design/*` in apps; use relative imports inside the package.
- Do not add React components under `apps/web/src/components/`. All UI goes in `packages/hax-design`. Routes may only compose hax-design exports. OpenUI library/registry code must live in `components/openui/`, not in `apps/web`.
- Chat UI types live in `packages/hax-design/src/components/agent-elements/chat-types.ts`.

## AI Integration

- The chat backend uses `@earendil-works/pi-coding-agent` v0.79.0 on top of `@earendil-works/pi-ai`, not Vercel AI SDK.
- Pi 0.79.0+ extensions can access `ctx.mode` (tui/rpc/json/print) and `ctx.getSystemPromptOptions()` for context-aware behavior.
- The primary provider is Google via Pi's `google` provider (default model: `gemini-3.5-flash`).
- The chat API route is `apps/web/src/routes/api/chat.ts`.
- `apps/web/src/lib/app-runtime.ts` resolves the active runtime context, falling back to this repo root.
- Shared browser-safe chat protocol types and Zod schemas live in `packages/hax-design/src/lib/pi/chat-protocol.ts` and `chat-protocol.zod.ts`; server-only Pi integration is centralized in `apps/web/src/lib/pi/runtime/` (session factory, settings bridge, model/resource/provider catalogs, hot reload) with `apps/web/src/lib/pi/server.ts` as the route-facing barrel.
- The browser chat client consumes newline-delimited JSON events from `/api/chat`.
- `/api/chat` is session-based: the client sends a single `message` plus optional Pi `sessionFile`/`sessionId` metadata, and the server resumes or creates a persistent Pi session.
- Supporting chat endpoints are `/api/chat/models`, `/api/chat/resources`, `/api/chat/settings`, `/api/chat/providers`, `/api/chat/session`, `/api/chat/sessions`, `/api/chat/new`, `/api/chat/resume`, `/api/chat/abort`, `/api/chat/question`, `/api/workspace/tree`, and `/api/workspace/file`.
- The server keeps live Pi `AgentSessionRuntime` instances in memory for a short TTL (`FLEET_PI_RUNTIME_TTL_MS`, default 10 minutes) so aborts and queued follow-ups operate on the same runtime. Invalid, outside, or missing session files must still start a fresh project-scoped session for the active runtime context.
- The web chat enables Pi's built-in `read`, `write`, `edit`, and `bash` tools scoped to the active `projectRoot`. File paths and bash cwd must remain project-scoped. Tool execution is direct in v1; there is no approval gate.
- Pi tool execution events are normalized into existing agent-elements tool parts (`tool-Read`, `tool-Write`, `tool-Edit`, `tool-Bash`) for rendering.
- The chat InputBar includes an Agent/Plan mode selector. Agent mode enables the normal coding tools plus approved external Pi tools; Plan mode enables read-only `read`, `bash`, `grep`, `find`, `ls`, `questionnaire`, `project_inventory`, `workspace_index`, and safe Autocontext status tools only.
- Plan mode is implemented in `apps/web/src/lib/pi/plan-mode.ts` as a web-native Pi extension. It injects read-only planning instructions, blocks unsafe bash commands, extracts numbered `Plan:` steps, persists plan state in the Pi session, and uses `tool-Question` parts plus `/api/chat/question` for InputBar question prompts and plan execute/refine/stay decisions.
- The Pi resources browser in `apps/web/src/routes/index.tsx` fetches `/api/chat/resources` and surfaces discovered skills, prompts, extensions, themes, context files, and diagnostics. It opens as a resizable right-side canvas that opens at 70% viewport width and clamps resizing to that maximum; mobile open state is a compact overlay. The canvas also has a read-only `Workspace` tab backed by `/api/workspace/tree` and `/api/workspace/file`, plus a UI-first `Configurations` tab.
- The `Configurations` tab edits project-scoped Pi settings through `/api/chat/settings` and persists supported overrides to `.pi/settings.json`: default provider/model/thinking level, `enabledModels`, compaction, retry, steering/follow-up mode, transport, packages (string or object form with per-package filters), resource paths, and skill slash commands. Provider credentials are managed through `/api/chat/providers` and still belong in environment/Pi auth storage locally or encrypted Postgres BYOK on Vercel.
- `apps/web/src/lib/workspace/server.ts` owns the `agent-workspace/` layout, creates seeded Markdown stubs without overwriting existing files, returns a sorted read-only filesystem tree, and safely previews file contents for paths inside the active `workspaceRoot`.
- Fleet Pi's repo-local agent home is `agent-workspace/`: durable skills, tool context, memory, plans, evals, artifacts, and extension orientation should be discoverable there. Chat-installed Pi runtime resources live under `agent-workspace/pi/{skills,prompts,extensions,packages}`. Root `.pi/settings.json` remains the Pi compatibility bridge and should point at workspace-native resource paths.
- Use `resource_install` for chat-driven Pi resource installs. Skills/prompts become usable after reload/new session; executable extensions and package bundles are staged unless the user explicitly asks to activate them. In v1, "plugins" means Pi resource packages/bundles, not Codex or Claude plugin bundles.
- Canonical durable project memory lives in `agent-workspace/memory/project/{architecture,decisions,preferences,open-questions,known-issues}.md`. Normal "remember this" requests should update the narrowest canonical file; ad hoc project-memory files are only for explicit user requests, temporary harness tests, or raw material that will later be synthesized.
- Pi sessions are persistent JSONL sessions. Browser mode stores only Pi session metadata in localStorage and hydrates visible messages from the Pi session file after refresh.
- When `FLEET_PI_CHAT_DATABASE_URL` is set, Fleet Pi mirrors full Pi session entries, run events, tool executions, and file mutations into Neon Postgres tables prefixed with `pi_`. Pi JSONL remains the source of truth; mirror failures must not break chat streaming.
- Settings saves hot-reload every in-memory Pi runtime in the deployment because `.pi/settings.json` is project-scoped; BYOK provider credential saves hot-reload only the authenticated user's active runtimes via `hotReloadActiveRuntimesForUser`.
- Model choices should come from Pi `ModelRegistry`/`SettingsManager`, not a hard-coded UI list. Project-local Pi resources under `.pi/skills`, `.pi/prompts`, and `.pi/extensions` are loaded through `DefaultResourceLoader` and surfaced through `/api/chat/resources`.
- Project-local Pi skills currently include `.pi/skills/fleet-pi-orientation`, `.pi/skills/chat-runtime-debugging`, `.pi/skills/agent-ui-workflows`, and the `.pi/skills/agent-elements` symlink to `.agents/skills/agent-elements`.
- `.pi/settings.json` loads project Pi packages `npm:pi-autoresearch`, `npm:pi-skill-palette`, `npm:pi-autocontext`, and `npm:pi-web-access`, plus vendored extension directories under `.pi/extensions/vendor`.
- `.pi/extensions/project-inventory.ts` registers the read-only `project_inventory` tool, `.pi/extensions/workspace-index.ts` registers the read-only `workspace_index` tool, and `.pi/extensions/trust-handler.ts` implements Pi 0.79.0 `project_trust` event handling with mode-aware auto-approval for workspace-native paths. All are included in Agent and Plan mode tool allowlists.
- `.pi/extensions/vendor/filechanges` provides `/filechanges`, `/filechanges-accept`, and `/filechanges-decline`; `.pi/extensions/vendor/subagents` registers the `subagent` tool. Keep each folder's `UPSTREAM.md` current when refreshing vendored source.
- Agent mode explicitly allows external tools `init_experiment`, `run_experiment`, `log_experiment`, `autocontext_judge`, `autocontext_improve`, `autocontext_status`, `autocontext_scenarios`, `autocontext_queue`, `autocontext_runtime_snapshot`, `subagent`, `web_search`, `fetch_content`, `code_search`, `get_search_content`, `daytona_get_status`, and `preview_url`. Do not add mutating research, file-change, or subagent tools to Plan mode.
- Plan mode and Harness mode also allow `web_search`, `code_search`, and `get_search_content` (read-only). `fetch_content` is Agent and Harness mode only — it can clone GitHub repos to `/tmp/`, which is a side effect inconsistent with Plan mode's read-only contract.
- Bedrock credentials should come from standard AWS environment/profile configuration. `AWS_REGION` defaults to `us-east-1` when unset.

## Manual Chat Checks

- Ask `read package.json` and verify a Read tool card appears.
- Ask `create a small temp file under this repo` and verify Write renders and the file is created inside the repo.
- Ask `edit that temp file` and verify Edit renders a diff.
- Ask `run pnpm --version` and verify Bash renders command and output.
- Refresh the page and confirm the visible transcript hydrates from stored Pi session metadata.
- Corrupt localStorage with `/etc/hosts` as `sessionFile`; the app should silently start a fresh repo-scoped session instead of showing an outside-session error.
- While streaming, send another prompt and verify a follow-up queue status appears.
- Switch to Plan mode, ask for a plan, and verify the assistant produces a numbered `Plan:` without edit/write tool use.
- In Plan mode, ask an ambiguous request and verify the InputBar Question bar appears, answer it, and confirm the same Pi turn continues.
- After a plan, choose Execute and verify the app switches to Agent mode, full tools are available, and `[DONE:n]` progress updates the plan status.
- Open the Pi resources browser and verify the starter skills, npm package resources, vendored extensions, `project-inventory.ts`, and `workspace-index.ts` appear. Verify the resources canvas docks to the right and resizes; on mobile, verify it opens as an overlay. Switch to the Workspace tab, verify `agent-workspace` plus representative seeded files appear, and click a Markdown file to verify the preview panel renders its content. Switch to Configurations and verify Pi settings load from `.pi/settings.json`, model/runtime/resource controls can become dirty and save, and Light/Dark/System theme control remains local. If both project-local and global `agent-elements` skills are installed, the resources diagnostics may include that expected name collision.

## Learned User Preferences

- Treat `@workspace/hax-design` as the sole UI source of truth; if a surface is missing, add it to hax-design rather than creating app-local components. Prefer export-map hygiene over shell/page-controller deepens (e.g. `FleetPiChatShell`) until protocol types settle.
- Keep floating pill-style header chrome; do not replace it with a unified full-width top bar unless explicitly requested.
- When executing an attached implementation plan, do not edit the plan file; follow existing todos to completion.
- Prefer `bg-sidebar` for inactive header pills and floating panel launcher buttons; use pill-shaped rounding (`rounded-full` / `rounded-[100px]`) for header controls and InputBar mode/model selectors.
- Avoid inline `style` props in Fleet Pi UI; prefer Tailwind utilities, `cva`, co-located component CSS, or shared hax-design tokens.
- Keep inline `DiscreteTabs` in the chat header when panels are open; stack the header above the content row (`CHAT_HEADER_LAYER_CLASS` / `relative z-10 overflow-visible`) and align tabs with chrome pill tokens (`DISCRETE_TAB_ACTIVE_CLASS` / `DISCRETE_TAB_INACTIVE_CLASS`) at compact sizing (12px labels, 14px icons).
- Prefer semantic tokens in `fleet-pi/styles/tokens.ts` and primitives in `fleet-pi/primitives/` (especially `ItemRow` variants) over nested card stacks or duplicated Tailwind class strings in Settings lists.
- Avoid generic AI SaaS aesthetics (cream backgrounds, gradient heroes, card grids) and heavy IDE-style dense toolbars unless explicitly requested.
- Keep the chat column a single full-width transcript plus InputBar; show artifact previews in the right panel Artifacts tab, not a horizontal split inside chat.
- Settings dialog should follow shadcn sidebar-13: icon+label nav only (no subtitles), scrollable main pane, and flat `ItemRow` lists without nested SectionSurface wrappers; Providers lists only configured/active providers; OpenAI Chat Completions requires API key + base URL + model ID; LLM Models use group-by-provider with an All/Enabled filter.
- InputBar slash-command suggestions must be scrollable and arrow-key navigable; Pi builtins like `/model` open the model picker (and `/models`/`/settings`/`/config` open Settings), not insert as a chat prompt.
- Use Playwright `testInfo.outputPath()` for E2E screenshots and artifacts instead of hardcoded machine-specific paths; put new tests under dedicated `__tests__/` directories rather than scattering colocated test files.

## Learned Workspace Facts

- Neon user-scoped RLS applies to `pi_*` mirror tables via `app.current_user_id`; Better Auth tables (`user`, `session`, `account`, `verification`) must not use RLS—`pnpm auth:migrate` chains `auth-post-migrate.ts` to disable RLS and grant `fleet_pi_app` DML.
- Daytona provisions per-user sandboxes via `resolveUserSandboxContext({ userId, surface })` (`apps/web/src/lib/daytona/resolve-user-sandbox-context.ts`). Deployed users BYOK their own Daytona API key (`daytona` in `pi_user_providers`). Durable volume mounts only at `/home/daytona/agent-workspace` (sparse-seeded from git `agent-workspace/`, never the full repo; seed must not overwrite user changes on reopen). Inject per-user provider API keys into the sandbox env. Web path uses Fleet adapter `.pi/extensions/daytona-sandbox` (ops via `createSandboxOperations`); stock `npm:@daytona/pi` is CLI-only and excluded from the web loader. Agent/Harness allow `daytona_get_status` + `preview_url` only.
- On Vercel (`VERCEL=1`), session-scoped chat endpoints require Better Auth: `/api/chat`, `/api/chat/session`, `/api/chat/resume`, `/api/chat/sessions`, `/api/chat/new`, `/api/chat/abort`, `/api/chat/question`, `/api/chat/runs`, `/api/chat/run`, `/api/chat/provenance`, and `PATCH /api/chat/settings`. Local dev keeps anonymous chat on routes that do not mutate shared session state. Mirror ownership uses `fleet_pi_check_session_owner` (SECURITY DEFINER) so RLS cannot hide foreign-owned rows; run `pnpm chat:migrate` after deploy when the ownership probe migration changes.
- Chat shell layout utilities and constants (`layout-constants.ts`, `canvas-utils.ts`, breakpoint 960px, 70% default panel width) live in `packages/hax-design`.
- OpenUI components and registry code belong under `packages/hax-design/src/components/openui/`; files inside `packages/hax-design` must use relative imports and apps import via `@workspace/hax-design/*`.
- Appearance, Sandbox, Providers, LLM Models, and Skills live in the Settings dialog (Account menu); the right panel is Workspace, Pi Resources, and Artifacts only. Slash suggestions come from `/api/chat/commands`; known Pi builtins are intercepted client-side to open UI (picker/Settings/new session), while skill/prompt commands still go to the agent.
- `PRODUCT.md`, `DESIGN.md`, `CONTEXT.md`, `packages/hax-design/ARCHITECTURE.md`, and Fleet Pi building blocks under `fleet-pi/{layout,chat,pi,primitives,styles}/` are canonical UI design context; semantic tokens live in `fleet-pi/styles/tokens.ts`.
- Pi provider credential IDs live in `@workspace/pi-protocol/provider-catalog.ts`; Settings UI metadata in `fleet-pi/pi/config-panel/shared/provider-metadata.ts`. Canonical Google id is `google` (`GEMINI_API_KEY`); `GOOGLE_CLIENT_*` are Better Auth only. OpenAI Chat Completions (`openai-chat-completions`) needs `OPENAI_CHAT_COMPLETIONS_{API_KEY,BASE_URL,MODEL}` in one atomic providers POST; Vite must ignore `.env`/`.env.local` in `server.watch` so credential saves do not restart mid-request; `/chat/completions` base URLs normalize to the API root; saving OCC auto-allowlists `openai-chat-completions/<modelId>` in `enabledModels`. AutoContext may still default to provider id `openai` with OCC model ids—that mismatch is intentional. Dev loads `.env` then `.env.local` with override. PostHog lives in `apps/web/src/lib/analytics/posthog.ts`.
- Workspace and Artifacts panels are agent-workspace-scoped only (local and Daytona)—never the full repo tree; Artifacts uses `agent-workspace/artifacts/` via the workspace tree API; both share `selectedWorkspacePath` and `workspace-panel` clears selections outside each panel's `scopePath`.
- Chat client sets `status` to `ready` on each NDJSON `done` event while the HTTP stream may stay open for queued follow-ups; abort/stop clears the follow-up queue and remains available during both `submitted` and `streaming`.
- `.vercelignore` excludes `agent-workspace/`, `.fleet/`, `.pi/`, `dist/`, and `node_modules` (apps/web must not import from `.pi/` on Vercel—colocate server helpers like `context-filter` under `apps/web/src/lib/pi/`). Feature-branch previews need `BETTER_AUTH_SECRET` and `FLEET_PI_AUTH_DATABASE_URL` scoped to Preview, not Production-only or a single branch alias.
- `@workspace/pi-protocol` (`packages/pi-protocol`) is the canonical chat wire layer: message types, Zod schemas, model-patterns, `buildOpenUIPrompt` (no React); `packages/hax-design/src/lib/pi/*` paths are deprecated re-exports. Server code imports protocol, not `agent-elements`/`openui` components. `handleChatTurn` in `apps/web/src/lib/pi/handle-chat-turn.ts` owns stream turn logic; `/api/chat` is auth/parse/pipe only. Pi `enabledModels: []` means deny-all models.

<!-- AUTOCTX_GUIDE_START -->

## AutoContext

- Use `autoctx capabilities` to inspect supported commands and project state.
- Use `autoctx whoami` to confirm provider credentials before running evaluations.
- Run `autoctx run` from this directory to use the defaults stored in `.autoctx.json`.

<!-- AUTOCTX_GUIDE_END -->
