# Design decisions

This page documents the significant architectural choices made in Fleet Pi and why they were made. Each entry describes the decision, the context that led to it, and the consequences worth knowing about.

## Pi over Vercel AI SDK

Fleet Pi uses `@earendil-works/pi-coding-agent` on top of `@earendil-works/pi-ai` rather than the Vercel AI SDK. Pi provides its own session management, JSONL persistence, resource loading system, and mode extension hooks. These features align with Fleet Pi's needs:

- Persistent sessions that survive browser refreshes and process restarts require a durable format. Pi's JSONL session files provide this out of the box.
- Workspace-aware tool execution (scoped reads, writes, and bash) integrates naturally with Pi's tool lifecycle rather than needing a bolt-on layer.
- Pi's resource loading pipeline (skills, prompts, extensions, packages via `.pi/settings.json`) lets Fleet Pi ship project-local tooling without patching or wrapping a third-party SDK.

**Consequence:** Fleet Pi is coupled to the Pi runtime. Migrating to another AI SDK would require replacing session management, event normalization, and the resource loading pipeline.

## JSONL sessions as source of truth

Pi sessions are stored as append-only JSONL files on disk. The optional Neon Postgres mirror (enabled via `FLEET_PI_CHAT_DATABASE_URL`) is a read replica for querying and observability — it is never the write path.

The reasoning is reliability: if the database is unavailable or a mirror write fails, the chat stream must not be interrupted. Pi's native session management handles the canonical state, and Pi's own conflict resolution applies.

**Consequence:** Mirror failures are logged but do not throw or abort the streaming response. Code that reads session history must treat the JSONL file as authoritative and the database tables as a convenience cache. See `apps/web/src/routes/api/chat.ts`.

## In-memory runtime cache with TTL

`AgentSessionRuntime` instances (the live Pi runtime objects) are retained in memory for a configurable TTL (`FLEET_PI_RUNTIME_TTL_MS`, default 10 minutes) after the last request. They are not created fresh on each HTTP request.

This is necessary because abort signals and follow-up prompts must reach the same runtime object to work correctly. Creating a new runtime per request would break mid-stream cancellation and the follow-up queue.

The TTL prevents unbounded memory growth. When a session is accessed after the TTL has elapsed, a new runtime is initialized from the Pi session file. If the session file is missing or invalid, a fresh project-scoped session is started rather than returning an error.

**Source:** `apps/web/src/lib/pi/server-runtime.ts`

## Daytona as an optional isolation layer

Sandbox isolation via Daytona is opt-in, controlled by the presence of `DAYTONA_API_KEY`. When the key is absent, Pi tools (file reads, writes, and bash) run directly in the server Node.js process scoped to the project root.

This trade-off prioritizes low-friction local development: a developer can run Fleet Pi with only AWS credentials, no additional infrastructure. Daytona isolation is recommended for multi-tenant or public-facing deployments where untrusted content might influence tool execution.

**Consequence:** The security posture of a Fleet Pi deployment depends on whether Daytona is configured. Local single-user installations without Daytona rely on workspace scoping and command policy enforcement rather than OS-level container isolation.

## Plan mode as a Pi extension

Plan mode is implemented as a native Pi extension (`createPlanModeExtension` in `apps/web/src/lib/pi/plan-mode.ts`) rather than as a separate API route or a system prompt appended to the user message.

Implementing it as a Pi extension lets it intercept tool calls and inject planning prompts within the Pi session lifecycle. This means plan state travels with the Pi session, mode transitions are handled at the runtime layer, and the same Pi streaming path is used regardless of mode.

**Consequence:** Plan mode behavior (read-only command enforcement, numbered `Plan:` step extraction, question prompts via `tool-Question`) is defined in one place and applies consistently across all session types.

## agent-workspace/ layering model

`agent-workspace/` uses a formal mutation tier system:

| Tier               | Paths                                                      | Access                              |
| ------------------ | ---------------------------------------------------------- | ----------------------------------- |
| Free               | `scratch/`, `artifacts/`, `memory/daily/`                  | Unrestricted agent writes           |
| Rationale required | `memory/project/`, `memory/research/`, `plans/`, `skills/` | Writes need justification           |
| Protected          | `system/`, `evals/`                                        | No writes without explicit override |

This gives AI agents and human contributors a shared contract for which files are safe to modify autonomously. The `workspace_write` tool enforces the tier rules; the `workspace_index` and `project_inventory` tools provide read-only orientation.

The rationale is that unrestricted writes to memory and policy files could corrupt the agent's operating context in ways that are hard to detect and reverse. The tier system makes the risk surface explicit and reviewable.

**Source:** `agent-workspace/AGENTS.md`, `agent-workspace/system/workspace-policy.md`
