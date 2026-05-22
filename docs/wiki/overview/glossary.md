# Glossary

| Term                    | Definition                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pi**                  | Qredence's AI coding agent (`@earendil-works/pi-coding-agent`). Manages LLM sessions, built-in tools, and resource loading.                                                              |
| **AgentSessionRuntime** | The live in-memory Pi object for an active session. Kept alive for `FLEET_PI_RUNTIME_TTL_MS` (default 10 min) after the last request.                                                    |
| **Pi session**          | A persistent JSONL file on disk that records all messages, tool calls, and results for a conversation. Source of truth for the transcript.                                               |
| **Agent mode**          | Chat mode where Pi has access to all tools: `read`, `write`, `edit`, `bash`, plus approved external tools (Daytona, web search, subagent, etc.).                                         |
| **Plan mode**           | Read-only chat mode. Pi can use `read`, `bash`, `grep`, `find`, `ls`, and safe inspection tools, but cannot write or execute side-effecting operations. Produces numbered `Plan:` steps. |
| **Harness mode**        | A third mode (for automated evaluation) that allows the same tools as Agent mode plus `questionnaire`.                                                                                   |
| **agent-workspace**     | The `agent-workspace/` directory at the repo root. Fleet Pi's durable adaptive layer: skills, memory, plans, evals, artifacts.                                                           |
| **NDJSON**              | Newline-delimited JSON. The streaming format used by `/api/chat`. Each line is a `ChatStreamEvent` (`start`, `delta`, `tool_call`, `tool_result`, `done`, `error`).                      |
| **Pi extension**        | A TypeScript module under `.pi/extensions/` that registers new tools or patches Pi's behavior. Loaded at session startup.                                                                |
| **Pi skill**            | A markdown procedure under `.pi/skills/` (or `agent-workspace/skills/`). Activated by Pi to follow a specific workflow.                                                                  |
| **circuit breaker**     | Opossum-based wrapper around Bedrock API calls. Opens after repeated failures to prevent cascading errors.                                                                               |
| **Daytona sandbox**     | An isolated container managed by the Daytona platform. When enabled, tool operations (`read`, `write`, `bash`, etc.) run inside the user's sandbox rather than the local filesystem.     |
| **OpenUI**              | `@openuidev/react-lang` — a DSL for rendering structured generative UI inline in chat responses.                                                                                         |
| **Better Auth**         | Authentication library used for user accounts. Supports SQLite (local) or Neon Postgres backends.                                                                                        |
| **session mirror**      | Optional Neon Postgres replication of Pi JSONL entries. Pi JSONL is the source of truth; the mirror enables SQL-based queries over session history.                                      |
| **workspace index**     | Postgres-backed full-text index over `agent-workspace/` files, built by the `workspace_index` Pi extension.                                                                              |
| **tool allowlist**      | The set of tool names that Pi is permitted to call in a given mode. Enforced by `plan-mode.ts` and `server-runtime.ts`.                                                                  |
| **FLEET_PI_REPO_ROOT**  | Environment variable that overrides the project root Pi operates in. Defaults to `process.cwd()`.                                                                                        |
| **Autocontext**         | External npm package (`npm:pi-autocontext`) that provides workspace context management tools.                                                                                            |
| **provenance**          | Metadata tracking which chat run or tool execution mutated a workspace file. Stored in Neon Postgres.                                                                                    |
