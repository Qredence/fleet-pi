# Fleet Pi

Fleet Pi is a local coding-agent workspace you run in the browser.

It combines a Pi-backed chat runtime, repo-scoped coding tools, a dedicated
Plan mode, and a durable `agent-workspace/` so project memory, plans, skills,
and artifacts stay visible in normal Git diffs instead of disappearing into
session state.

## Who it's for

- Developers who want a local, repo-scoped coding assistant
- Teams exploring agent workflows with durable memory and reviewable artifacts
- Builders who want a browser UI on top of Pi's coding-agent runtime

## What it does

- Runs a TanStack Start web app with a streaming `/api/chat` backend
- Persists Pi chat sessions across refreshes
- Exposes repo-scoped `read`, `write`, `edit`, and `bash` tools in Agent mode
- Adds a read-only Plan mode for safe exploration and execution planning
- Surfaces project-local Pi skills, prompts, and extensions in a resources
  browser
- Treats `agent-workspace/` as a living home for memory, plans, evals, skills,
  artifacts, and workspace-installed Pi resources

## Quick start

Standalone setup is the recommended path for most people.

```zsh
# from repo root
pnpm install
cp .env.example .env
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000) and verify the health
endpoint:

```zsh
# in a second terminal
curl http://localhost:3000/api/health
```

Full setup instructions:

- [docs/quickstart.md](docs/quickstart.md) for standalone and Pi/Codex setup
- [docs/codex.md](docs/codex.md) for the advanced Codex local environment

## Setup paths

### Standalone

Use this if you want to run Fleet Pi locally as a web app with Pi-backed chat.
You still need Bedrock access and normal AWS credentials, but you do not need
the Codex app or a custom multi-agent operator setup.

### Pi / Codex

Use this if you want Fleet Pi's shared Codex local environment and worktree
bootstrap flow. Fleet Pi ships `.codex/environments/environment.toml` and
`.codex/workspace-bootstrap.zsh` for that path.

## Key concepts

### Agent mode and Plan mode

- Agent mode enables the normal repo-scoped coding tools plus approved external
  Pi tools.
- Plan mode is read-only. It helps the assistant inspect the repo, ask focused
  follow-up questions, and produce numbered execution plans before code changes.

### `agent-workspace/`

`agent-workspace/` is Fleet Pi's durable adaptive layer.

- Human-facing docs live under [`docs/`](docs/).
- Agent-facing memory, plans, skills, evals, artifacts, and scratch space live
  under [`agent-workspace/`](agent-workspace/).
- Workspace-installed Pi resources live under `agent-workspace/pi/`, while root
  `.pi/settings.json` stays a small compatibility bridge.

Read more in [docs/agent-workspace.md](docs/agent-workspace.md).

### Project-local Pi resources

Fleet Pi loads committed project resources from `.pi/` and surfaces them in the
chat resources browser. Chat-driven installs go into `agent-workspace/pi/` so
they stay discoverable and reviewable.

## Validation

```zsh
# from repo root
pnpm lint
pnpm typecheck
pnpm --filter web test
pnpm validate-agents-md
```

Useful extra checks:

```zsh
# from repo root
pnpm build
pnpm e2e
pnpm syncpack
pnpm generate:docs
```

## Docs

- [docs/quickstart.md](docs/quickstart.md) - recommended setup paths
- [docs/agent-workspace.md](docs/agent-workspace.md) - how the living workspace
  makes Fleet Pi adaptive
- [docs/codex.md](docs/codex.md) - advanced Codex environment and action setup
- [docs/project-structure.md](docs/project-structure.md) - generated repo map
- [docs/api.md](docs/api.md) - generated API reference
- [docs/runbooks.md](docs/runbooks.md) - operator runbooks for runtime issues

## Development notes

- `apps/web` is the TanStack Start app and `/api/chat` backend
- `packages/ui` contains the shared React UI and agent-elements integration
- `apps/web/src/routeTree.gen.ts` is generated and should not be edited by hand

## License

Fleet Pi is released under the [Apache 2.0 License](LICENSE).
