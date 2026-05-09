# Contributing to Fleet Pi

Thanks for helping improve Fleet Pi.

## Before you start

- Open an issue or discussion before large changes so the direction is clear.
- Keep changes focused and reviewable.
- Do not commit secrets, local `.env` files, `.fleet/` session data, or local
  package installs under `.pi/npm/`.

## Local setup

```zsh
# from repo root
pnpm install
cp .env.example .env
pnpm dev
```

The full setup guide lives in [docs/quickstart.md](docs/quickstart.md).

## Validation

Run the smallest relevant validation lane for your change:

```zsh
# from repo root
pnpm lint
pnpm typecheck
pnpm --filter web test
pnpm validate-agents-md
```

Use these extra checks when they apply:

```zsh
# from repo root
pnpm build
pnpm e2e
pnpm syncpack
pnpm generate:docs
```

Run `pnpm generate:docs` when you change the docs generator or source material
for generated reference docs.

## Pull requests

- Explain the user-facing change and the reasoning behind it.
- Link the issue or discussion when one exists.
- Call out any follow-up work that should stay out of the current PR.
- Update docs when setup, workflows, or public behavior changes.

## Working with agent-workspace

`agent-workspace/` is Fleet Pi's durable agent-facing surface for memory, plans,
skills, evals, artifacts, and workspace-installed Pi resources.

- Keep durable improvements reviewable in normal Git diffs.
- Prefer updating the smallest canonical file instead of adding ad hoc notes.
- Treat `docs/` as human-facing and `agent-workspace/` as agent-facing.
