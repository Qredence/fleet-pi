# Fleet Pi

<div align="center">
  <img src="apps/web/public/assets/social/logo-fleet-pi-dark.png" alt="Fleet Pi" width="200" />
</div>

<div align="center">

[![Latest release](https://img.shields.io/github/v/release/Qredence/fleet-pi?label=release)](https://github.com/Qredence/fleet-pi/releases)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![CI](https://github.com/Qredence/fleet-pi/actions/workflows/ci.yml/badge.svg)](https://github.com/Qredence/fleet-pi/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.33.3-orange.svg)](https://pnpm.io/)

**A local browser workspace for Pi-powered coding agents — with durable memory, resumable plans, and repo-scoped tools you can review in Git.**

[Quick start](#-quick-start) · [Features](#-features) · [Docs](docs/README.md) · [Releases](https://github.com/Qredence/fleet-pi/releases)

</div>

---

Most agent tools hide memory, plans, and session state in the cloud or in logs you cannot diff. **Fleet Pi runs on your machine**, keeps adaptive state in `agent-workspace/`, and gives you a full chat UI with Agent and Plan modes before anything mutates your repo.

## Why Fleet Pi?

|                          |                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Git-native state**     | Memory, plans, skills, and artifacts live in reviewable files under `agent-workspace/`                             |
| **Plan before you ship** | Plan mode inspects the repo read-only, asks follow-up questions, and produces numbered plans you can execute later |
| **Your credentials**     | Default model is Google **Gemini** (`gemini-3.5-flash`); Bedrock and other Pi providers still work                 |
| **Your Pi stack**        | Project skills, prompts, and extensions load from `.pi/` and `agent-workspace/pi/`                                 |

## Quick start

**Prerequisites:** Node.js 22+, [pnpm 10.33.3](https://pnpm.io/) (via Corepack), and LLM credentials through Pi's normal provider auth flow.

```zsh
git clone https://github.com/Qredence/fleet-pi.git
cd fleet-pi
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), then sanity-check the server:

```zsh
curl http://localhost:3000/api/health
# → {"status":"ok"}
```

In the chat UI, try `read package.json` and confirm a **Read** tool card appears.

**Need more detail?** See [docs/quickstart.md](docs/quickstart.md) for standalone vs Codex paths, provider setup, and smoke checks.

## Features

|                          |                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Chat**                 | Persistent Pi sessions, streaming NDJSON, resume after refresh                                        |
| **Agent mode**           | Repo-scoped `read`, `write`, `edit`, `bash` plus approved Pi extensions                               |
| **Plan mode**            | Read-only exploration, structured plans, InputBar questions, execute / refine / stay                  |
| **OpenUI**               | Inline generative UI blocks inside assistant messages                                                 |
| **Resources**            | Browse skills, prompts, extensions, and workspace files from the side panel                           |
| **Memory**               | Durable project memory and recall under `agent-workspace/memory/`                                     |
| **Web access**           | `web_search`, `fetch_content`, and `code_search` in Agent mode (`pi-web-access`)                      |
| **Optional Neon mirror** | Mirror Pi sessions to Postgres when `FLEET_PI_CHAT_DATABASE_URL` is set — JSONL stays source of truth |

Built with **TanStack Start**, **React 19**, **Pi coding agent**, and **`@workspace/hax-design`** (agent-elements + OpenUI).

## How it works

```
Browser chat UI  →  /api/chat  →  Pi AgentSession  →  repo-scoped tools
                      ↓
              agent-workspace/  +  .pi/settings.json  +  .fleet/sessions/
```

1. You send a message from the web app.
2. Fleet Pi resumes or creates a Pi session scoped to the active project root.
3. Tool calls run on the server inside that boundary; Plan mode blocks mutating commands.
4. Durable context is written to workspace files you can commit, diff, and share.

## Setup paths

### Standalone (recommended)

Run Fleet Pi as a normal local web app. No Codex desktop app required — just Node, pnpm, and working LLM provider credentials.

### Pi / Codex

Use the shared Codex environment and worktree bootstrap when you want Fleet Pi inside a Codex workflow:

- [`.codex/environments/environment.toml`](.codex/environments/environment.toml)
- [`.codex/workspace-bootstrap.zsh`](.codex/workspace-bootstrap.zsh)
- [docs/codex.md](docs/codex.md)

## Optional integrations

Set these in `.env` only when you need them — local dev works without them.

| Integration             | Env vars                                           | What it enables                                           |
| ----------------------- | -------------------------------------------------- | --------------------------------------------------------- |
| **Neon session mirror** | `FLEET_PI_CHAT_DATABASE_URL`                       | Queryable mirror of Pi sessions, runs, and tool events    |
| **App auth**            | `BETTER_AUTH_SECRET`, `FLEET_PI_AUTH_DATABASE_URL` | Multi-user login (email/password + optional Google OAuth) |
| **Daytona sandboxes**   | `DAYTONA_API_KEY`                                  | Isolated container execution for file/bash tools          |
| **Amazon Bedrock**      | `AWS_REGION`, `AWS_PROFILE`                        | Use Bedrock models instead of the Gemini default          |

See [`.env.example`](.env.example) for the full list.

## Key concepts

**Agent vs Plan mode**

- **Agent** — full coding tools and approved external Pi tools.
- **Plan** — read-only inspection, follow-up questions, numbered `Plan:` steps, and resumable plan cards after refresh.

**`agent-workspace/`**

`agent-workspace/` is Fleet Pi's durable adaptive layer: memory, plans, evals, artifacts, and chat-installed Pi resources. Human docs live in [`docs/`](docs/); agent-facing files live here. See [docs/agent-workspace.md](docs/agent-workspace.md).

**Project-local Pi resources**

Committed resources under `.pi/` surface in the resources browser. Chat-driven installs land in `agent-workspace/pi/` and stay reviewable in Git.

## Docs

| Document                                           | Description                        |
| -------------------------------------------------- | ---------------------------------- |
| [docs/README.md](docs/README.md)                   | Docs hub and reading order         |
| [docs/quickstart.md](docs/quickstart.md)           | Setup, providers, and verification |
| [docs/agent-workspace.md](docs/agent-workspace.md) | Durable workspace model            |
| [docs/codex.md](docs/codex.md)                     | Advanced Codex / worktree path     |
| [docs/architecture.md](docs/architecture.md)       | Generated architecture reference   |
| [docs/api.md](docs/api.md)                         | Generated API reference            |
| [RELEASE_NOTES_v0.5.0.md](RELEASE_NOTES_v0.5.0.md) | Latest release highlights          |

## Development

```zsh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Extra checks: `pnpm e2e`, `pnpm syncpack`, `pnpm generate:docs`, `pnpm validate-agents-md`.

| Path                   | Role                                                  |
| ---------------------- | ----------------------------------------------------- |
| `apps/web/`            | TanStack Start app, `/api/chat`, and file routes      |
| `packages/hax-design/` | Shared UI — agent-elements, OpenUI, Fleet Pi surfaces |
| `agent-workspace/`     | Durable agent memory and workspace artifacts          |
| `.pi/`                 | Pi settings, skills, prompts, and extensions          |

`apps/web/src/routeTree.gen.ts` is generated — do not edit by hand.

## Contributing

Contributions welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — community standards
- [SECURITY.md](SECURITY.md) — responsible disclosure
- [Issues](https://github.com/Qredence/fleet-pi/issues) — bugs and feature requests

## License

Fleet Pi is released under the [Apache 2.0 License](LICENSE).
