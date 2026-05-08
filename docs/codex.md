# Codex Usage

Fleet Pi ships a shared Codex local environment so new Codex worktree threads
can bootstrap the repo consistently.

## Shared Environment

- Environment definition: `.codex/environments/environment.toml`
- Setup entrypoint: `.codex/workspace-bootstrap.zsh`

Open the Fleet Pi repo in the Codex app and choose the shared local
environment when starting a worktree-backed thread.

## Setup Behavior

The current setup script is intentionally bootstrap-only:

```zsh
# from repo root
pnpm install --frozen-lockfile
```

This matches the repo's normal dependency flow and keeps worktree creation
predictable.

## Expectations

- `node` and `pnpm` must already be available on the machine.
- The script should stay focused on dependency/bootstrap work.
- Do not put long-running processes in the setup script.
- Do not rely on `export` statements in the setup script for later Codex turns;
  setup runs in a separate shell session.

## Suggested Codex Actions

After the worktree is ready, add separate Codex actions for the common repo
tasks instead of bundling them into one multi-step action:

- `Dev` -> `pnpm dev`
- `Typecheck` -> `pnpm typecheck`
- `Test` -> `pnpm test`

`pnpm dev` is long-running, while the others are one-shot validation commands,
so keeping them split makes the Codex action bar much more usable.
