# Fleet Pi — For Technical Users

**A self-improving agent workspace. You bring the keys and the sandbox. The agent builds the rest.**

---

## What is it?

Fleet Pi is a **meta-harness** — a complete, self-hosted agent workspace built on [Pi](https://pi.dev/). It ships as a working web app with a chat UI, Agent and Plan modes, durable workspace memory, and sandboxed execution. But unlike a traditional agent tool, Fleet Pi is designed to be **self-improving**: the agent writes its own skills, registers its own prompts, evaluates its own output, and adapts to you over time.

The agent is simultaneously the worker and the architect of its own environment.

---

## How it works

```
┌─────────────────────────────────────────────────┐
│                  Fleet Pi Web App                │
│  (TanStack Start · Auth · API · Workspace UI)    │
├─────────────────────────────────────────────────┤
│                  Pi Agent Session                 │
│  (Agent loop · Tools · Model resolution · Skills) │
├─────────────────────────────────────────────────┤
│                  agent-workspace/                 │
│  (memory/ · plans/ · skills/ · evals/ · .pi/)    │
├─────────────────────────────────────────────────┤
│              Daytona Sandbox (optional)           │
│  (Isolated execution · Durable volume · BYOK)    │
└─────────────────────────────────────────────────┘
```

**The boundary is the workspace.** The agent operates inside `agent-workspace/` — a structured directory of memory, plans, skills, evals, prompts, and artifacts. The agent never modifies the platform code. It grows inside the workspace, and the platform loads whatever the workspace contains.

**The workspace is the growth record.** Every skill the agent writes, every prompt it registers, every evaluation it runs, every decision it makes — it's in the workspace. The provenance system provides a durable audit trail of what changed and why. After months of use, the workspace is a living document of how the system evolved.

---

## Key concepts

### Agent vs Plan mode

- **Agent mode** — full coding tools: read, write, edit, bash, plus approved Pi extensions (web search, code search, fetch, subagents, Daytona sandbox, file changes)
- **Plan mode** — read-only exploration, structured plans, numbered steps, InputBar questions, execute/refine/stay decisions. Plans persist in `agent-workspace/plans/` and can be resumed after refresh.

### The workspace contract

`agent-workspace/` has a defined structure:

| Directory         | Purpose                                         | Growth pattern                                |
| ----------------- | ----------------------------------------------- | --------------------------------------------- |
| `memory/`         | Project memory, daily logs, research, summaries | Agent writes learnings here                   |
| `plans/`          | Active, completed, and abandoned plans          | Agent creates plans, moves them on completion |
| `evals/`          | Evaluation rubrics and results                  | Agent evaluates itself, stores results        |
| `artifacts/`      | Reports, diagrams, datasets, traces             | Agent stores analysis outputs                 |
| `.pi/prompts/`    | Slash-command prompt templates                  | Agent registers new prompt templates          |
| `.pi/extensions/` | TypeScript tool extensions                      | Agent creates new tools and capabilities      |
| `.pi/skills/`     | Reusable agent skills                           | Agent publishes new skills                    |
| `indexes/`        | Workspace search indexes                        | Auto-generated for fast discovery             |

### BYOK (Bring Your Own Key)

Everything is yours:

- **LLM keys** — your own Gemini, OpenAI, Anthropic, Bedrock, or any Pi-compatible provider
- **Sandbox compute** — your own Daytona sandbox, or none at all
- **Database** — your own Neon Postgres for session mirroring, or skip it
- **Credentials** — encrypted in Postgres on Vercel, local in `.env` for dev

---

## Quick start

```zsh
git clone https://github.com/Qredence/fleet-pi.git
cd fleet-pi
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Set your LLM provider key (e.g. `GEMINI_API_KEY` in `.env`), and you're running.

---

## Architecture

| Layer             | Tech                                       | Role                                              |
| ----------------- | ------------------------------------------ | ------------------------------------------------- |
| **Web framework** | TanStack Start                             | File-based routes, SSR, API routes                |
| **UI**            | `@workspace/hax-design`                    | All components: chat, settings, workspace browser |
| **Protocol**      | `@workspace/pi-protocol`                   | Wire types, Zod schemas, model patterns           |
| **Agent harness** | `@earendil-works/pi-coding-agent`          | Agent loop, tools, sessions, model resolution     |
| **Database**      | Neon Postgres                              | Session mirroring, settings persistence, auth     |
| **Sandbox**       | Daytona                                    | Per-user isolated execution environments          |
| **Auth**          | Neon Managed Auth (+ Better Auth fallback) | Multi-user, BYOK credential encryption            |

---

## What makes it different

| This                                          | Not this                   |
| --------------------------------------------- | -------------------------- |
| Self-improving workspace                      | Fixed feature set          |
| BYOK — your keys, your compute                | SaaS subscription per seat |
| Git-native state — every change is reviewable | Opaque cloud logs          |
| Per-user sandboxed execution                  | Shared tenants             |
| Full TypeScript extension system              | Limited plugin API         |
| Community: 5,300+ Pi packages                 | Proprietary ecosystem      |

---

## Where to start

- **Deployed app:** [fleet-pi-web.vercel.app](https://fleet-pi-web.vercel.app/)
- **Source:** [github.com/Qredence/fleet-pi](https://github.com/Qredence/fleet-pi)
- **Docs:** [docs/](/docs/README.md)
- **Quickstart:** [docs/quickstart.md](/docs/quickstart.md)
- **Agent framework:** [pi.dev](https://pi.dev/)
