# PLANS

## Symphony Spec Alignment

Purpose:
Align Fleet Pi's repo-owned Symphony integration with the current upstream
`SPEC.md` and the current `plugins/symphony` implementation used by the local
wrapper scripts.

Progress:

- [x] Audit Fleet Pi's `WORKFLOW.md`, wrapper scripts, and docs against the
      live Symphony spec and plugin behavior.
- [x] Confirm the current workflow validates through `pnpm symphony:validate`.
- [x] Remove non-spec label-gating assumptions from the repo-owned contract.
- [x] Add deterministic worktree cleanup for Symphony workspace removal.
- [x] Update `WORKFLOW.md` and operator checks for the current runtime
      contract shipped in this change set.
- [x] Re-run workflow validation and targeted lifecycle smoke checks.

Decision Log:

- Fleet Pi should track the current spec/runtime contract, not an older
  forward-looking `required_labels` extension.
- Because Fleet Pi uses git worktrees instead of disposable clones, workspace
  removal needs a repo-owned cleanup hook so git metadata is released when
  Symphony retires a workspace.

Outcome:

- `WORKFLOW.md` now matches the current Fleet Pi consumer contract: active-state
  intake, repo-scoped worktree hooks, and no unsupported label-gating field.
- `before-remove-worktree.zsh` removes Fleet Pi worktrees from git metadata and
  recreates an empty directory so Symphony's own deletion step can complete.
- A live isolated Symphony run reached `codex_app_server_started`,
  `codex_initialized`, `thread_started`, `session_started`, and `turn_started`
  for `QRE-365`, then removed the worktree cleanly after the issue moved to
  `Done`.

## Agent Workspace Foundation

Purpose:
Seed a minimal root `agent-workspace/` that gives Fleet Pi a clean repo-local
substrate for durable memory, plans, skills, evals, artifacts, and reviewable
self-improvement.

Progress:

- [x] Audit the existing `agent-workspace/` scaffold and remove private-note
      remnants that should not survive in the repo.
- [x] Create the requested directory structure and seed concise Markdown files.
- [x] Add a short root `README.md` mention and run lightweight structural
      validation.

Decision Log:

- Keep the first scaffold intentionally small and Markdown-first.
- Extension tools (workspace_index, workspace_write, workspace_context, web_fetch,
  bedrock-bearer-auth) were included in this same change to make the workspace
  immediately useful — the initial plan deferred this, but shipping them together
  avoids a split-context review cycle.

Outcome:

- The root `agent-workspace/` now has a clean index, policies, project-memory
  stubs, research guidance, plan directories, eval checklists, and five
  starter skills (codebase-research, doc-gardening, execution-plan,
  frontend-design, memory-synthesis).
- Private inspiration-note placeholders were removed from the committed
  workspace structure.
- The repo README now briefly points readers to `agent-workspace/` without
  over-documenting it.

## Codex Local Environment

Purpose:
Create a shared Codex local environment for Fleet Pi so new worktree threads can
bootstrap the monorepo consistently.

Progress:

- [x] Audit the current repo tooling, docs, and existing worktree bootstrap
      patterns.
- [x] Add a repo-scoped Codex environment file under `.codex/environments/`.
- [x] Add a small bootstrap script for Codex worktrees.
- [x] Document the setup in repo guidance.

Decision Log:

- Keep Fleet Pi's Codex setup bootstrap-only, matching current OpenAI Codex
  local-environment guidance.
- Reuse the repository's normal `pnpm install --frozen-lockfile` path instead of
  inventing a second dependency bootstrap flow for Codex worktrees.

Outcome:

- Fleet Pi now has a shared Codex local environment at
  `.codex/environments/environment.toml`.
- Codex worktrees bootstrap through `.codex/workspace-bootstrap.zsh`, which
  checks for `node` and `pnpm` and installs dependencies from the repo root.

## Codex Multi-Agent V2

Purpose:
Create an additive, CLI/Symphony-first Codex worker mesh that does not replace
Fleet Pi's Pi-backed browser chat runtime.

Progress:

- [x] Add `packages/codex-v2` as a pnpm workspace package.
- [x] Add `plan`, `execute`, `status`, and `validate` CLI commands.
- [x] Store durable artifacts under `agent-workspace/codex-v2/`.
- [x] Keep execution behind an explicit `execute --run-id` gate and keep live
      Codex MCP dispatch behind `--use-codex`.
- [x] Add root scripts for operator use.

Decision Log:

- Codex v2 is additive and operator-scoped; Pi remains the product chat/runtime
  layer.
- `agent-workspace/codex-v2/` is the source of truth for v2 plan, run, report,
  and trace artifacts.
- The first implementation defaults to deterministic dry execution so local
  validation does not require OpenAI credentials or live Codex worker sessions.

## Symphony Wrapper Auth Enforcement

Purpose:
Keep Fleet Pi's repo-owned Symphony wrappers honest about required Linear auth
instead of allowing validation to pass with a fake placeholder token.

Progress:

- [x] Remove the fake validation fallback token from the Fleet Pi wrapper.
- [x] Share the `.env` loader between validation and runtime wrappers.
- [x] Document the fail-fast `LINEAR_API_KEY` behavior in repo operator docs.

Decision Log:

- `pnpm symphony:validate` should verify the same real auth contract that
  `pnpm symphony:run` needs, because `tracker.api_key` is required by the
  workflow contract.
- The shared dotenv helper now uses `uv run python` so the wrapper stays inside
  the repo's Python-tooling conventions.

Outcome:

- Fleet Pi's validation and runtime wrappers both stop immediately when
  `LINEAR_API_KEY` is unresolved after the repo-root `.env` load.
- Wrapper dotenv parsing now lives in `scripts/symphony/common.sh` instead of
  being duplicated in two shell entrypoints.

## Symphony Worker Codex Isolation

Purpose:
Move Symphony workers off the operator's global `~/.codex` state so issue runs
are not blocked by stale ChatGPT refresh tokens, dead home-local MCP servers, or
broken shell profile startup.

Progress:

- [x] Add a repo-owned Symphony worker launcher that seeds and uses an isolated
      `.codex-home`.
- [x] Add an isolated Codex config template for Symphony worker sessions.
- [x] Reuse the operator's ChatGPT Codex auth inside the isolated worker home.
- [x] Update workflow/docs to describe the isolated worker contract.

Decision Log:

- The isolated worker home lives under the shared Symphony workspace root, not
  inside each issue worktree, so auth/cache state is reused across issue runs.
- Validation keeps checking only the Linear-backed workflow config; live worker
  auth requirements are enforced in `pnpm symphony:run`.

Outcome:

- Fleet Pi now launches Symphony workers through
  `scripts/symphony/codex-app-server.zsh` instead of bare `codex app-server`.
- Worker auth/cache now reuses `~/.codex/auth.json` inside `.codex-home`
  without inheriting the rest of the operator's global Codex config.
