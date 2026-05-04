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

- Keep the first scaffold intentionally small and Markdown-first instead of
  inventing new extensions in the same change.
- Treat future `.pi/extensions/*` support as planned follow-up work, not part
  of this initial seed.

Outcome:

- The root `agent-workspace/` now has a clean index, policies, project-memory
  stubs, research guidance, plan directories, eval checklists, and three
  starter skills.
- Private inspiration-note placeholders were removed from the committed
  workspace structure.
- The repo README now briefly points readers to `agent-workspace/` without
  over-documenting it.
