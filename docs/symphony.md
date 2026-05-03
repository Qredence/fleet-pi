# Fleet Pi Symphony Operator Guide

This runbook explains how Fleet Pi is intended to run under the Symphony
orchestrator.

## Operating Model

- Tracker: Linear project `fleet-pi` (`slugId: 7c8589daab4e`)
- Eligible states: `Todo`, `In Progress`
- Workspace model: one git worktree per issue under
  `~/code/symphony-workspaces/fleet-pi/<issue-key>`
- Codex approvals: `on-request`
- Thread sandbox: `workspace-write`

The repo-owned workflow definition lives at [WORKFLOW.md](../WORKFLOW.md).
For Linear-backed Symphony dispatch, `tracker.project_slug` must use the
project `slugId` from the Linear URL or API, not the human-readable project
name.

## Issue Intake

Fleet Pi now follows the current Symphony spec and current plugin behavior:
issue eligibility is driven by the configured Linear project plus
`tracker.active_states`.

If you want a narrower rollout than "all `Todo`/`In Progress` issues in this
project", do that with Linear project/state hygiene or a separate workflow, not
with repo-local label assumptions that Symphony does not dispatch on.

## Hook Behavior

Fleet Pi keeps the hooks small and deterministic:

- `after_create`
  - fetches `origin/main`
  - creates a git worktree from the local Fleet Pi source repository
  - uses branch name `codex/<workspace_key>`
- `before_run`
  - fetches `origin/main --prune`
  - runs `pnpm install --frozen-lockfile` on first bootstrap and whenever the
    tracked dependency manifests or lockfile change in a reused worktree
- `after_run`
  - prints `git status --short`
- `before_remove`
  - unregisters the git worktree from the source checkout
  - runs `git worktree prune`
  - recreates an empty directory so Symphony's own workspace deletion can
    finish cleanly

Hook implementations live under `scripts/symphony/`.

## Commands

Validate the effective workflow config:

```zsh
# from repo root
zsh ./scripts/symphony/validate-workflow.zsh
```

Run the Symphony service:

```zsh
# from repo root
zsh ./scripts/symphony/run-service.zsh
```

Run the plugin test lane from the `qredence-plugins` checkout:

```zsh
# from repo root
zsh ./scripts/symphony/test-plugin.zsh
```

All three wrappers default to the sibling checkout at
`/Volumes/SSD-T7/qredence-environnement/qredence-plugins`. Override that by
setting `SYMPHONY_PLUGIN_REPO` when needed.

The validation and runtime wrappers source the repo-root `.env` by default, so
keep `LINEAR_API_KEY=...` there for local operator runs. To bypass the file and
use the current shell environment directly, set `SYMPHONY_SKIP_DOTENV=1`.

## Operator Smoke Checks

Before enabling real execution:

1. Validate `WORKFLOW.md` with the wrapper command.
2. Create one issue in `Todo` and one issue in a terminal state such as `Done`.
3. Confirm only the active-state issue is eligible for dispatch.
4. Confirm the workspace path resolves under
   `~/code/symphony-workspaces/fleet-pi/<issue-key>`.
5. Confirm the created worktree branch is `codex/<workspace_key>`.
6. After cleanup, confirm `git -C /Volumes/SSD-T7/work-location/fleet-pi/fleet-pi worktree list`
   no longer includes the retired workspace path.
