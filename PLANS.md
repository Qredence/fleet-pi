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
- [x] Update repo docs and operator checks to match the implemented runtime.
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
