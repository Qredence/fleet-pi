# AGENTS.md

## Project Conventions

- Use `pnpm` from the repository root for dependency and task commands.
- The root `pnpm-lock.yaml` is the canonical lockfile; do not create nested app lockfiles.
- Run workspace commands with `pnpm --filter <workspace> <script>` when only one package is affected.
- Use the root Symphony wrapper scripts when operating Fleet Pi through Symphony: `pnpm symphony:validate` for config validation, `pnpm symphony:test-plugin` for the upstream plugin test lane, and the `symphony:run` package script for the long-running service.
- The shell-based Symphony validation/runtime wrappers load values from the repo-root `.env` by default; keep `LINEAR_API_KEY` there unless you intentionally bypass it with `SYMPHONY_SKIP_DOTENV=1`.
- `pnpm symphony:validate` and `pnpm symphony:run` fail fast if `LINEAR_API_KEY` is still unresolved after that `.env` load.
- `pnpm symphony:run` reuses the operator's ChatGPT Codex subscription auth by copying `~/.codex/auth.json` into an isolated `.codex-home` under the shared Symphony workspace root before starting the worker.
- In `WORKFLOW.md`, `tracker.project_slug` must use Linear's project `slugId` (for Fleet Pi: `7c8589daab4e`), not the human-readable project name.

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
- Validate the Fleet Pi Symphony workflow with `pnpm symphony:validate`.
- Run the external Symphony plugin test lane with `pnpm symphony:test-plugin`.
- Create a Codex multi-agent v2 plan with `pnpm codex-v2:plan -- --issue-key <key> --issue-title "<title>"`.
- Approve a Codex multi-agent v2 run with `pnpm codex-v2:execute -- --run-id <run-id>`; add `--use-codex` only when you intentionally want live Codex MCP worker dispatch.
- Inspect Codex multi-agent v2 runs with `pnpm codex-v2:status`.
- Validate the Codex multi-agent v2 artifact surface with `pnpm codex-v2:validate`.
- Analyze bundle size with `pnpm build --filter web` then open `apps/web/bundle-report/stats.html`.

## Devcontainer

The repository includes a VS Code devcontainer configuration at `.devcontainer/devcontainer.json` with Node.js, pnpm, Git, and recommended editor extensions. Open the project in a devcontainer to get a fully pre-configured development environment. Port `3000` is forwarded automatically and `pnpm install` runs after container creation.

## Codex Local Environment

- Fleet Pi now ships a shared Codex local environment at `.codex/environments/environment.toml`.
- The worktree bootstrap entrypoint is `.codex/workspace-bootstrap.zsh`.
- Keep the Codex setup script bootstrap-only: install dependencies for a fresh worktree, but do not add long-running processes or rely on shell state persisting after setup.
- The current bootstrap runs `pnpm install --frozen-lockfile` from the repo root and assumes `node` plus `pnpm` are already available on the machine.
- Prefer keeping secrets and provider credentials in Codex settings or normal shell environment configuration rather than exporting them from the setup script.

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

- `WORKFLOW.md` is the Fleet Pi Symphony orchestration contract. `scripts/symphony/` contains the worktree/bootstrap wrappers used by Symphony hooks, while `docs/symphony.md` is the operator guide.
- `scripts/symphony/codex-app-server.zsh` is the repo-owned Symphony worker launcher. It seeds `.codex-home/config.toml` from `.codex/symphony/config.toml`, isolates worker auth/cache from `~/.codex`, and starts `codex app-server` from that isolated home.
- `apps/web` is a TanStack Start app. File routes are generated into `apps/web/src/routeTree.gen.ts`; do not edit that generated file manually.
- `packages/ui` contains shared React UI components exported under `@workspace/ui/*`.
- Chat UI types live in `packages/ui/src/components/agent-elements/chat-types.ts`.

## AI Integration

- The chat backend uses `@mariozechner/pi-coding-agent` on top of `@mariozechner/pi-ai`, not Vercel AI SDK.
- The primary provider is Amazon Bedrock via Pi's `amazon-bedrock` provider.
- The chat API route is `apps/web/src/routes/api/chat.ts`.
- `apps/web/src/lib/app-runtime.ts` resolves the active runtime context, falling back to this repo root.
- Shared browser-safe chat protocol types live in `apps/web/src/lib/pi/chat-protocol.ts`; server-only Pi setup, session validation, event normalization, model discovery, and transcript hydration live in `apps/web/src/lib/pi/server.ts`.
- The browser chat client consumes newline-delimited JSON events from `/api/chat`.
- `/api/chat` is session-based: the client sends a single `message` plus optional Pi `sessionFile`/`sessionId` metadata, and the server resumes or creates a persistent Pi session.
- Supporting chat endpoints are `/api/chat/models`, `/api/chat/resources`, `/api/chat/session`, `/api/chat/sessions`, `/api/chat/new`, `/api/chat/resume`, `/api/chat/abort`, `/api/chat/question`, `/api/workspace/tree`, and `/api/workspace/file`.
- The server keeps live Pi `AgentSessionRuntime` instances in memory for a short TTL (`FLEET_PI_RUNTIME_TTL_MS`, default 10 minutes) so aborts and queued follow-ups operate on the same runtime. Invalid, outside, or missing session files must still start a fresh project-scoped session for the active runtime context.
- The web chat enables Pi's built-in `read`, `write`, `edit`, and `bash` tools scoped to the active `projectRoot`. File paths and bash cwd must remain project-scoped. Tool execution is direct in v1; there is no approval gate.
- Pi tool execution events are normalized into existing agent-elements tool parts (`tool-Read`, `tool-Write`, `tool-Edit`, `tool-Bash`) for rendering.
- The chat InputBar includes an Agent/Plan mode selector. Agent mode enables the normal coding tools plus approved external Pi tools; Plan mode enables read-only `read`, `bash`, `grep`, `find`, `ls`, `questionnaire`, `project_inventory`, `workspace_index`, and safe Autocontext status tools only.
- Plan mode is implemented in `apps/web/src/lib/pi/plan-mode.ts` as a web-native Pi extension. It injects read-only planning instructions, blocks unsafe bash commands, extracts numbered `Plan:` steps, persists plan state in the Pi session, and uses `tool-Question` parts plus `/api/chat/question` for InputBar question prompts and plan execute/refine/stay decisions.
- The Pi resources browser in `apps/web/src/routes/index.tsx` fetches `/api/chat/resources` and surfaces discovered skills, prompts, extensions, themes, context files, and diagnostics. It opens as a resizable right-side canvas that opens at 70% viewport width and clamps resizing to that maximum; mobile open state is a compact overlay. The canvas also has a read-only `Workspace` tab backed by `/api/workspace/tree` and `/api/workspace/file`, plus a UI-first `Configurations` tab.
- The `Configurations` tab is non-mutating for tools, connectors, provider setup, and model allowlist drafts. Theme personalization is functional and local: use `fleet-pi-theme-preference` plus the root `.dark` class for Light/Dark/System.
- `apps/web/src/lib/workspace/server.ts` owns the `agent-workspace/` layout, creates seeded Markdown stubs without overwriting existing files, returns a sorted read-only filesystem tree, and safely previews file contents for paths inside the active `workspaceRoot`.
- Pi sessions are persistent JSONL sessions. Browser mode stores only Pi session metadata in localStorage and hydrates visible messages from the Pi session file after refresh.
- Model choices should come from Pi `ModelRegistry`/`SettingsManager`, not a hard-coded UI list. Project-local Pi resources under `.pi/skills`, `.pi/prompts`, and `.pi/extensions` are loaded through `DefaultResourceLoader` and surfaced through `/api/chat/resources`.
- Project-local Pi skills currently include `.pi/skills/fleet-pi-orientation`, `.pi/skills/chat-runtime-debugging`, `.pi/skills/agent-ui-workflows`, and the `.pi/skills/agent-elements` symlink to `.agents/skills/agent-elements`.
- `.pi/settings.json` loads project Pi packages `npm:pi-autoresearch`, `npm:pi-skill-palette`, and `npm:pi-autocontext`, plus vendored extension directories under `.pi/extensions/vendor`.
- `.pi/extensions/project-inventory.ts` registers the read-only `project_inventory` tool, and `.pi/extensions/workspace-index.ts` registers the read-only `workspace_index` tool. Both are included in Agent and Plan mode tool allowlists.
- `.pi/extensions/vendor/filechanges` provides `/filechanges`, `/filechanges-accept`, and `/filechanges-decline`; `.pi/extensions/vendor/subagents` registers the `subagent` tool. Keep each folder's `UPSTREAM.md` current when refreshing vendored source.
- Agent mode explicitly allows external tools `init_experiment`, `run_experiment`, `log_experiment`, `autocontext_judge`, `autocontext_improve`, `autocontext_status`, `autocontext_scenarios`, `autocontext_queue`, `autocontext_runtime_snapshot`, and `subagent`. Do not add mutating research, file-change, or subagent tools to Plan mode.
- `packages/codex-v2` is the additive Codex multi-agent v2 operator package. It is CLI/Symphony-first and stores durable plan/run/report artifacts under `agent-workspace/codex-v2/`; it must not replace or bypass the Pi-backed browser chat runtime.
- Codex multi-agent v2 uses an explicit execute gate: `plan` creates read-only artifacts, `execute` flips `approvedForExecution`, and live Codex MCP worker dispatch happens only with `--use-codex`.
- Fleet Pi's Symphony workflow follows the current upstream spec: issue intake is driven by the configured Linear project plus `tracker.active_states`, not repo-local label gating.
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
- Open the Pi resources browser and verify the starter skills, npm package resources, vendored extensions, `project-inventory.ts`, and `workspace-index.ts` appear. Verify the resources canvas docks to the right and resizes; on mobile, verify it opens as an overlay. Switch to the Workspace tab, verify `agent-workspace` plus representative seeded files appear, and click a Markdown file to verify the preview panel renders its content. Switch to Configurations and verify the UI-first rows plus Light/Dark/System theme control. If both project-local and global `agent-elements` skills are installed, the resources diagnostics may include that expected name collision.
- Run `pnpm symphony:validate` and verify the Fleet Pi workflow config resolves through the Symphony plugin repo checkout.
- Confirm the Symphony hook scripts create a `codex/<workspace_key>` worktree under `~/code/symphony-workspaces/fleet-pi` and that workspace removal unregisters the worktree cleanly from `git worktree list`.
