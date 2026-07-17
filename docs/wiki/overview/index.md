# Fleet Pi

Fleet Pi is a browser-based coding-agent workspace built on Qredence's Pi AI coding agent. It pairs a streaming chat UI with a persistent agent session, letting you have a full conversation with an AI that can read, write, and run code inside your repository. A durable `agent-workspace/` directory accumulates skills, memory, plans, and artifacts across sessions.

## What it does

- Streams responses from Pi through the current OpenAI-compatible `openai-chat-completions` provider (default model `deepseek-v4-flash-free`)
- Runs Pi's built-in tools — `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls` — scoped to your project root
- Supports **Agent mode** (full tools) and **Plan mode** (read-only planning with numbered steps)
- Maintains persistent Pi JSONL sessions; restores transcript on page refresh
- Optionally mirrors sessions to Neon Postgres, provisions Daytona sandboxes per user, and renders inline generative UI via OpenUI

## Quick links

| Topic                   | Page                                              |
| ----------------------- | ------------------------------------------------- |
| Getting started         | [Getting started](getting-started.md)             |
| Architecture overview   | [Architecture](architecture.md)                   |
| Chat API endpoints      | [API](../api/index.md)                            |
| Plan mode               | [Plan mode](../apps/web/plan-mode.md)             |
| Agent workspace         | [Agent workspace](../features/agent-workspace.md) |
| Configuration reference | [Configuration](../reference/configuration.md)    |

## Repository layout

```
fleet-pi/
├── apps/web/          TanStack Start app (React 19 + Vite + Nitro)
├── packages/hax-design/       Shared component library (@workspace/hax-design)
├── agent-workspace/   Durable agent home (skills, memory, plans)
├── .pi/               Pi runtime configuration and extensions
└── scripts/           Tooling scripts (auth migration, doc generation)
```
