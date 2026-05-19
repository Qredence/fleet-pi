# Architecture

Durable architecture notes for Fleet Pi’s Pi-native agent workspace and chat runtime.

## Stable structure

- `agent-workspace/` is Fleet Pi’s durable adaptive layer: repo-local memory, policies, plans, evals, skills, artifacts, indexes, scratch space, and workspace-native Pi resources.
- `.pi/settings.json` is the Pi compatibility bridge that points Pi at workspace-native resources under `agent-workspace/pi/{skills,prompts,extensions,packages}` while keeping provider/model settings in Pi’s normal settings shape.
- `.pi/extensions/*` contains trusted executable bridge extensions; `agent-workspace/pi/extensions/staged` contains proposed executable resources, and `agent-workspace/pi/extensions/enabled` contains approved active workspace extensions.
- `apps/web` is a TanStack Start app whose chat API streams newline-delimited JSON from Pi sessions to the browser.
- `packages/ui` contains shared agent-elements components and tool renderers used by the Fleet Pi chat UI.

## Runtime boundaries

- `apps/web/src/lib/pi/server-runtime.ts` creates and retains Pi `AgentSessionRuntime` instances, selects models through Pi settings/registry, and applies mode-specific policy.
- `apps/web/src/routes/api/chat.ts` is the primary streaming endpoint; it sanitizes prompts, creates/resumes Pi runtimes, records run provenance, and normalizes Pi events for the browser.
- `apps/web/src/lib/pi/plan-mode.ts` owns Agent, Plan, and Harness mode boundaries, including tool allowlists, plan state, and unsafe bash blocking.
- `.pi/extensions/workspace-context.ts` injects workspace orientation, active plan status, and project memory index/recall snippets into Pi startup context.
- `.pi/extensions/workspace-index.ts`, `workspace-write.ts`, `resource-install.ts`, and `project-inventory.ts` expose the agent-workspace as Pi tools.

## Key data flows

- Browser chat sends one user message plus session metadata to `/api/chat`; the server resumes or creates a persistent Pi JSONL session and streams normalized events back to the client.
- Pi resources flow from `.pi/settings.json` through Pi resource loading into runtime skills, prompts, extensions, packages, and the Fleet Pi resource browser.
- Workspace memory flows from `agent-workspace/memory/project/*.md` through `.pi/extensions/lib/workspace-memory-index.ts` into startup context and `workspace_index` summaries.
- Chat-installed resources flow through `resource_install` into `agent-workspace/pi/*`; executable extensions and package bundles should remain staged unless explicitly activated.
- Run evidence flows into provenance and artifacts, then should be synthesized into memory, plans, evals, or backlog items when durable learning is justified.

## Source anchors

- `apps/web/src/lib/pi/server-runtime.ts`
- `apps/web/src/routes/api/chat.ts`
- `apps/web/src/lib/pi/plan-mode.ts`
- `.pi/settings.json`
- `.pi/extensions/workspace-context.ts`
- `.pi/extensions/lib/workspace-memory-index.ts`
- `agent-workspace/AGENTS.md`
- `agent-workspace/ARCHITECTURE.md`
