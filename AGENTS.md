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
- `packages/ui` contains shared React UI components exported under `@workspace/ui/*`.
- Chat UI types live in `packages/ui/src/components/agent-elements/chat-types.ts`.

## AI Integration

- The chat backend uses `@mariozechner/pi-coding-agent` on top of `@mariozechner/pi-ai`, not Vercel AI SDK.
- The primary provider is Amazon Bedrock via Pi's `amazon-bedrock` provider.
- The chat API route is `apps/web/src/routes/api/chat.ts`.
- Shared browser-safe chat protocol types live in `apps/web/src/lib/pi/chat-protocol.ts`; server-only Pi setup, session validation, event normalization, model discovery, and transcript hydration live in `apps/web/src/lib/pi/server.ts`.
- The browser chat client consumes newline-delimited JSON events from `/api/chat`.
- `/api/chat` is session-based: the client sends a single `message` plus optional Pi `sessionFile`/`sessionId` metadata, and the server resumes or creates a persistent Pi session.
- Supporting chat endpoints are `/api/chat/models`, `/api/chat/resources`, `/api/chat/session`, `/api/chat/sessions`, `/api/chat/new`, `/api/chat/resume`, `/api/chat/abort`, and `/api/chat/question`.
- The server keeps live Pi `AgentSessionRuntime` instances in memory for a short TTL (`FLEET_PI_RUNTIME_TTL_MS`, default 10 minutes) so aborts and queued follow-ups operate on the same runtime. Invalid, outside, or missing session files must still start a fresh repo-scoped session.
- The web chat enables Pi's built-in `read`, `write`, `edit`, and `bash` tools scoped to the repository root. File paths and bash cwd must remain repo-scoped. Tool execution is direct in v1; there is no approval gate.
- Pi tool execution events are normalized into existing agent-elements tool parts (`tool-Read`, `tool-Write`, `tool-Edit`, `tool-Bash`) for rendering.
- The chat InputBar includes an Agent/Plan mode selector. Agent mode enables the normal coding tools; Plan mode enables read-only `read`, `bash`, `grep`, `find`, `ls`, and `questionnaire` tools.
- Plan mode is implemented in `apps/web/src/lib/pi/plan-mode.ts` as a web-native Pi extension. It injects read-only planning instructions, blocks unsafe bash commands, extracts numbered `Plan:` steps, persists plan state in the Pi session, and uses `tool-Question` parts plus `/api/chat/question` for InputBar question prompts and plan execute/refine/stay decisions.
- Pi sessions are persistent JSONL sessions. The browser should store only Pi session metadata in localStorage and hydrate visible messages from the Pi session file after refresh.
- Model choices should come from Pi `ModelRegistry`/`SettingsManager`, not a hard-coded UI list. Project-local Pi resources under `.pi/skills`, `.pi/prompts`, and `.pi/extensions` are loaded through `DefaultResourceLoader` and surfaced through `/api/chat/resources`.
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
