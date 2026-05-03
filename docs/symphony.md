# Fleet Pi Symphony Operator Guide

This runbook explains how Fleet Pi is intended to run under the Symphony
orchestrator.

## Operating Model

- Tracker: Linear project `fleet-pi`
- Eligible states: `Todo`, `In Progress`
- Intended execution label: `symphony-ready`
- Workspace model: one git worktree per issue under
  `~/code/symphony-workspaces/fleet-pi/<issue-key>`
- Codex approvals: `on-request`
- Thread sandbox: `workspace-write`

The repo-owned workflow definition lives at [WORKFLOW.md](../WORKFLOW.md).

## Important Caveat

Fleet Pi adopts the `tracker.required_labels` contract now, but the current
reference Symphony service still needs upstream support to enforce it. That work
is tracked as a Linear dependency and should land in the Symphony plugin codebase
before Fleet Pi is run in production with automatic label-gated pickup.

Until that dependency is done, treat the workflow as configuration-in-place,
not launch-ready automation.

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
export LINEAR_API_KEY=...
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

## Operator Smoke Checks

Before enabling real execution:

1. Validate `WORKFLOW.md` with the wrapper command.
2. Confirm the Symphony plugin repo contains the label-filter change for
   `tracker.required_labels`.
3. Create one labeled `symphony-ready` issue in `Todo` and one unlabeled issue
   in `Todo`.
4. Confirm only the labeled issue is eligible.
5. Confirm the workspace path resolves under
   `~/code/symphony-workspaces/fleet-pi/<issue-key>`.
6. Confirm the created worktree branch is `codex/<workspace_key>`.
7. After cleanup, run `git -C /Volumes/SSD-T7/work-location/fleet-pi/fleet-pi worktree prune`.
