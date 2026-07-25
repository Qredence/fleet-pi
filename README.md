# Fleet Pi

<div align="center">

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![CI](https://github.com/Qredence/fleet-pi/actions/workflows/ci.yml/badge.svg)](https://github.com/Qredence/fleet-pi/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11.1.3-orange.svg)](https://pnpm.io/)

**A self-improving agent workspace. You bring the keys and the sandbox. The agent builds the rest.**

[Quick start](#quick-start) · [Why](#why-fleet-pi) · [Docs](docs/README.md) · [Releases](https://github.com/Qredence/fleet-pi/releases) · [Pitches](docs/pitches/)

</div>

---

Fleet Pi is a **meta-harness** — a complete, self-hosted agent workspace built on [Pi](https://pi.dev/). It ships as a working web app with a chat UI, Agent and Plan modes, durable workspace memory, and sandboxed execution. But unlike a traditional agent tool, Fleet Pi is designed to be **self-improving**: the agent writes its own skills, registers its own prompts, evaluates its own output, and adapts to you over time.

The agent is simultaneously the worker and the architect of its own environment. Two users with Fleet Pi will have completely different systems after a few sessions — because the system _became_ what they needed it to be.

## Why Fleet Pi?

| Problem                                                                      | Fleet Pi's approach                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **SaaS lock-in** — your agent lives in their cloud, your data is proprietary | **Self-hosted, BYOK, BYO sandbox** — your keys, your compute, your Git repo              |
| **Fixed feature set** — you're stuck on the vendor's roadmap                 | **Self-improving** — the agent creates its own skills, prompts, and tools                |
| **No audit trail** — opaque logs you can't diff or review                    | **Git-native provenance** — every file change is reviewable, every decision is traceable |
| **No isolation** — shared tenants, no per-user sandboxing                    | **Per-user Daytona sandboxes** with durable volumes and credential isolation             |
| **DIY complexity** — frameworks that give you parts, not a working system    | **Ship as a working app** — clone, install, run, and the agent adapts                    |

## Quick start

**Prerequisites:** Node.js 22+, [pnpm](https://pnpm.io/) (via Corepack), and an LLM provider key.

```zsh
git clone https://github.com/Qredence/fleet-pi.git
cd fleet-pi
corepack enable
pnpm install
cp .env.example .env
# Set GEMINI_API_KEY or another Pi-compatible provider key
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Type `read package.json` to verify the agent is working.

**Need more detail?** See [docs/quickstart.md](docs/quickstart.md).

## Features

| Feature               | Description                                                                      |
| --------------------- | -------------------------------------------------------------------------------- |
| **Chat**              | Persistent Pi sessions, streaming NDJSON, resume after refresh                   |
| **Agent mode**        | Repo-scoped read, write, edit, bash plus approved Pi extensions                  |
| **Plan mode**         | Read-only exploration, structured plans, InputBar questions, execute/refine/stay |
| **OpenUI**            | Inline generative UI blocks inside assistant messages                            |
| **Resources browser** | Browse skills, prompts, extensions, and workspace files from the side panel      |
| **Workspace memory**  | Durable project memory under `agent-workspace/memory/`                           |
| **Web access**        | `web_search`, `fetch_content`, `code_search` in Agent mode                       |
| **Subagents**         | Scout (fast recon), researcher (web research), worker (code changes)             |
| **Extensions**        | Full TypeScript extension system; 5,300+ community Pi packages                   |
| **Settings**          | Provider credentials, model selection, skills, appearance                        |
| **Auth**              | Email/password, Google OAuth, Neon Managed Auth, or anonymous                    |
| **Sandbox**           | Optional Daytona sandbox for isolated execution                                  |

## How it works

```
Browser → Fleet Pi API → Pi Agent Session → agent-workspace/ (filesystem)
                                              ↓
                                         Daytona Sandbox (optional)
```

You send a message from the web app. Fleet Pi creates or resumes a Pi session scoped to the project root. The agent operates inside `agent-workspace/` — reading memory, writing plans, creating skills, evaluating itself. Tool calls run on the server; Plan mode blocks mutating commands. Everything the agent does is written to the workspace, reviewable in Git, and available to future sessions.

## Architecture

| Layer             | Tech                     | Role                                                  |
| ----------------- | ------------------------ | ----------------------------------------------------- |
| **Web framework** | TanStack Start           | File-based routes, SSR, API routes                    |
| **UI**            | `@workspace/hax-design`  | All components: chat, settings, workspace browser     |
| **Protocol**      | `@workspace/pi-protocol` | Wire types, Zod schemas, model patterns               |
| **Agent harness** | [Pi](https://pi.dev/)    | Agent loop, tools, sessions, model resolution (77k ★) |
| **Database**      | Neon Postgres            | Session mirroring, settings persistence, auth         |
| **Sandbox**       | Daytona                  | Per-user isolated execution environments              |
| **Auth**          | Neon Managed Auth        | Cookie + JWT, BYOK credential encryption              |

## Project structure

```
fleet-pi/
├── apps/web/                 # TanStack Start web app
│   ├── src/routes/           # File-based routes
│   ├── src/lib/              # Server/client libraries
│   └── e2e/                  # Playwright tests
├── packages/
│   ├── hax-design/           # UI components (shadcn registry, agent-elements, OpenUI)
│   └── pi-protocol/          # Chat protocol types and schemas
├── agent-workspace/          # Durable agent workspace (growth domain)
│   ├── memory/               # Project memory, research, daily logs
│   ├── plans/                # Active, completed, abandoned plans
│   ├── evals/                # Evaluation rubrics and results
│   ├── artifacts/            # Reports, diagrams, datasets
│   └── .pi/                  # Pi skills, prompts, extensions
├── .pi/                      # Pi settings, extensions, skills, prompts
├── .agents/skills/           # 30+ agent skills
└── docs/                     # Documentation and pitches
```

## Docs

| Document                                                                   | Description                        |
| -------------------------------------------------------------------------- | ---------------------------------- |
| [docs/README.md](docs/README.md)                                           | Docs hub and reading order         |
| [docs/quickstart.md](docs/quickstart.md)                                   | Setup, providers, and verification |
| [docs/agent-workspace.md](docs/agent-workspace.md)                         | Durable workspace model            |
| [docs/architecture.md](docs/architecture.md)                               | Architecture reference             |
| [docs/api.md](docs/api.md)                                                 | API reference                      |
| [docs/pitches/for-investors.md](docs/pitches/for-investors.md)             | Investor brief                     |
| [docs/pitches/for-technical-users.md](docs/pitches/for-technical-users.md) | Technical deep-dive                |
| [docs/pitches/for-contributors.md](docs/pitches/for-contributors.md)       | Contributor guide                  |

## Development

```zsh
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm test          # Unit tests
pnpm build         # Full build
pnpm e2e           # Playwright tests
pnpm syncpack      # Dependency consistency
pnpm knip          # Unused exports
```

## Contributing

Contributions welcome. See [docs/pitches/for-contributors.md](docs/pitches/for-contributors.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — community standards
- [SECURITY.md](SECURITY.md) — responsible disclosure
- [Issues](https://github.com/Qredence/fleet-pi/issues) — bugs and feature requests

## License

Apache 2.0. See [LICENSE](LICENSE).
