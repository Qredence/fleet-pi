# Data Models

This page documents the key TypeScript types used in the chat protocol and the Neon Postgres schema for the session mirror.

All chat protocol types are in [`apps/web/src/lib/pi/chat-protocol.ts`](../../../apps/web/src/lib/pi/chat-protocol.ts). UI message types are in [`packages/hax-design/src/components/agent-elements/chat-types.ts`](../../../packages/hax-design/src/components/agent-elements/chat-types.ts). The Neon schema is in [`apps/web/src/lib/db/chat-postgres-schema.ts`](../../../apps/web/src/lib/db/chat-postgres-schema.ts).

---

## Chat Protocol Types

### `ChatMode`

```ts
type ChatMode = "agent" | "plan" | "harness"
```

- `"agent"` — full coding agent with read/write/edit/bash tools and approved external tools.
- `"plan"` — read-only planning mode; no file mutations or subagent tools.
- `"harness"` — eval harness mode.

### `ChatRequest`

Sent as the JSON body of `POST /api/chat`.

```ts
type ChatRequest = {
  message?: string
  model?: ChatModelSelection
  mode?: ChatMode
  planAction?: ChatPlanAction // "execute" | "refine"
  streamingBehavior?: "steer" | "followUp"
  sessionFile?: string // JSONL session file path
  sessionId?: string // Pi session ID
  userId?: string // populated from auth session server-side
  userEmail?: string // populated from auth session server-side
}
```

`ChatModelSelection` is either a string key (e.g. `"anthropic/claude-sonnet-4-5"`) or a structured object:

```ts
type ChatModelSelection =
  | string
  | { provider: string; id: string; thinkingLevel?: ChatThinkingLevel }
```

### `ChatStreamEvent`

The NDJSON stream from `POST /api/chat` emits one `ChatStreamEvent` per line.

| `type`         | When emitted                               | Key fields                                                               |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `"start"`      | First event; session is ready              | `id`, `runId`, `sessionId`, `sessionFile`, `sessionReset`, `diagnostics` |
| `"delta"`      | Each text token from the model             | `text`, `messageId`                                                      |
| `"tool"`       | Tool call start, progress, or completion   | `part` (ChatToolPart), `messageId`                                       |
| `"plan"`       | Plan state update                          | `mode`, `executing`, `completed`, `total`, `state`                       |
| `"state"`      | Agent lifecycle event                      | `state.name` (e.g. `"turn_start"`, `"turn_end"`)                         |
| `"queue"`      | Prompt queued on active session            | `steering`, `followUp`                                                   |
| `"thinking"`   | Reasoning token (extended thinking models) | `text`, `messageId`                                                      |
| `"compaction"` | Context compaction started or ended        | `phase`, `reason`, `aborted`, `willRetry`                                |
| `"retry"`      | Automatic retry started or ended           | `phase`, `attempt`, `maxAttempts`, `delayMs`, `errorMessage`             |
| `"done"`       | Stream complete                            | `runId`, `message` (ChatMessage), `sessionId`, `sessionFile`             |
| `"error"`      | Stream error                               | `message`, `runId`                                                       |

### `ChatSessionMetadata`

Lightweight session reference stored in the browser and sent with each request.

```ts
type ChatSessionMetadata = {
  sessionFile?: string // absolute path to the Pi JSONL session file
  sessionId?: string // Pi session ID (UUID)
}
```

### `ChatSessionInfo`

Summary of a stored Pi session, used in the sessions list.

```ts
type ChatSessionInfo = {
  path: string // absolute path to JSONL file
  id: string // session UUID
  cwd: string // working directory at session creation time
  name?: string // optional display name
  created: string // ISO timestamp
  modified: string // ISO timestamp
  messageCount: number
  firstMessage: string // preview of the first user message
}
```

### `ChatPiSettings` / `ChatPiSettingsUpdate`

`ChatPiSettings` is the full, effective Pi settings object. `ChatPiSettingsUpdate` is a partial version used for patching `.pi/settings.json`.

```ts
type ChatPiSettings = {
  compaction: {
    enabled: boolean
    reserveTokens: number
    keepRecentTokens: number
  }
  defaultModel?: string
  defaultProvider?: string
  defaultThinkingLevel?: ChatThinkingLevel
  enableSkillCommands: boolean
  enabledModels?: string[]
  extensions: string[]
  followUpMode: ChatDeliveryMode // "all" | "one-at-a-time"
  packages: ChatPackageSource[]
  prompts: string[]
  retry: { enabled: boolean; maxRetries: number; baseDelayMs: number }
  skills: string[]
  steeringMode: ChatDeliveryMode
  themes: string[]
  transport: ChatTransport // "auto" | "sse" | "websocket"
}
```

### `ChatQuestionAnswer` / `ChatQuestionAnswerRequest`

Used when the plan-mode InputBar presents a question prompt. The client posts the user's answer to `POST /api/chat/question`.

```ts
type ChatQuestionAnswer = {
  kind: "single" | "multi" | "text" | "skip"
  questionId?: string
  selectedIds?: string[]
  text?: string
}

type ChatQuestionAnswerRequest = {
  sessionFile?: string
  sessionId?: string
  toolCallId?: string
  answer: ChatQuestionAnswer
}
```

### `ChatPlanState`

Tracks plan execution progress across steps.

```ts
type ChatPlanState = {
  mode: ChatMode
  executing: boolean
  pendingDecision: boolean
  completed: number
  total: number
  todos: ChatPlanTodo[]
  message?: string
}

type ChatPlanTodo = {
  step: number
  text: string
  completed: boolean
}
```

---

## UI Message Types

Defined in [`packages/hax-design/src/components/agent-elements/chat-types.ts`](../../../packages/hax-design/src/components/agent-elements/chat-types.ts).

### `ChatMessage`

The primary unit of conversation history. Each message has a role and an array of parts.

```ts
type ChatMessage = {
  id: string
  role: "user" | "assistant"
  parts: ChatMessagePart[]
  createdAt?: Date | string | number
  experimental_attachments?: Array<{ contentType?: string; url?: string }>
  [key: string]: unknown
}
```

### `ChatMessagePart`

Messages are composed of typed parts:

```ts
type ChatTextPart = {
  type: "text"
  text: string
}

type ChatErrorPart = {
  type: "error"
  title?: string
  message: string
}

type ChatToolPart = {
  type: string // e.g. "tool-Read", "tool-Write", "tool-Bash"
  toolCallId?: string
  state?: string // "pending" | "running" | "done" | "error"
  input?: unknown
  output?: unknown
  result?: unknown
  [key: string]: unknown
}

type ChatMessagePart = ChatTextPart | ChatErrorPart | ChatToolPart
```

---

## Neon Postgres Schema

When `FLEET_PI_CHAT_DATABASE_URL` is set, Fleet Pi mirrors session data into Neon Postgres. Pi JSONL files remain the source of truth; the Postgres tables are derived data for querying, search, and analytics.

Schema source: [`apps/web/src/lib/db/chat-postgres-schema.ts`](../../../apps/web/src/lib/db/chat-postgres-schema.ts).

### `pi_sessions`

One row per Pi session.

| Column                     | Type          | Description                                     |
| -------------------------- | ------------- | ----------------------------------------------- |
| `id`                       | `TEXT PK`     | Pi session UUID                                 |
| `user_id`                  | `TEXT NULL`   | Auth user ID (nullable for unauthenticated use) |
| `session_file_path`        | `TEXT UNIQUE` | Absolute path to the JSONL file                 |
| `cwd`                      | `TEXT`        | Working directory when the session was created  |
| `version`                  | `INTEGER`     | Pi session format version (default 3)           |
| `parent_session_file_path` | `TEXT`        | Path to parent session for forked sessions      |
| `name`                     | `TEXT`        | Optional display name                           |
| `first_message_preview`    | `TEXT`        | Preview of the first user message               |
| `leaf_entry_id`            | `TEXT`        | ID of the most recent JSONL entry               |
| `entry_count`              | `INTEGER`     | Total number of JSONL entries                   |
| `message_count`            | `INTEGER`     | Number of user+assistant messages               |
| `created_at`               | `TIMESTAMPTZ` | Session creation time                           |
| `updated_at`               | `TIMESTAMPTZ` | Last modification time                          |
| `last_synced_at`           | `TIMESTAMPTZ` | Last time this row was synced from JSONL        |

### `pi_session_entries`

Raw JSONL entries mirrored from the Pi session file.

| Column            | Type                       | Description                                         |
| ----------------- | -------------------------- | --------------------------------------------------- |
| `session_id`      | `TEXT FK → pi_sessions.id` | Parent session                                      |
| `entry_id`        | `TEXT`                     | Entry UUID from JSONL                               |
| `parent_entry_id` | `TEXT`                     | Parent entry for tree-shaped sessions               |
| `entry_type`      | `TEXT`                     | Pi entry type (e.g. `user`, `assistant`, `summary`) |
| `role`            | `TEXT`                     | Message role                                        |
| `content_text`    | `TEXT`                     | Extracted plain-text content for full-text search   |
| `raw_entry`       | `JSONB`                    | Full JSONL entry as JSONB for flexible querying     |
| `entry_timestamp` | `TIMESTAMPTZ`              | Entry creation time                                 |
| `tokens_total`    | `INTEGER`                  | Token count if available                            |
| `cost_total`      | `NUMERIC`                  | Cost in USD if available                            |

A GIN index on `raw_entry` supports ad-hoc JSONB queries. A full-text search index on `content_text` supports text search across session history.

### `pi_runs`

One row per streaming chat run (one user turn → one assistant response).

| Column                 | Type                       | Description                                         |
| ---------------------- | -------------------------- | --------------------------------------------------- |
| `id`                   | `TEXT PK`                  | Run UUID                                            |
| `session_id`           | `TEXT FK → pi_sessions.id` | Parent session                                      |
| `assistant_message_id` | `TEXT`                     | ID of the resulting assistant message               |
| `session_turn_index`   | `INTEGER`                  | Turn index within the session                       |
| `mode`                 | `TEXT`                     | Chat mode at run time (`agent`, `plan`, `harness`)  |
| `plan_action`          | `TEXT`                     | Plan action if in plan mode                         |
| `status`               | `TEXT`                     | `in_progress`, `completed`, `errored`, or `aborted` |
| `assistant_preview`    | `TEXT`                     | Short preview of the assistant response             |
| `error_message`        | `TEXT`                     | Error message if `status = errored`                 |
| `event_count`          | `INTEGER`                  | Number of stream events recorded                    |
| `tool_call_count`      | `INTEGER`                  | Number of tool executions                           |
| `mutation_count`       | `INTEGER`                  | Number of file mutations                            |
| `started_at`           | `TIMESTAMPTZ`              | Run start time                                      |
| `completed_at`         | `TIMESTAMPTZ`              | Run completion time                                 |

### `pi_run_events`

Individual stream events recorded for each run, in sequence order.

| Column        | Type                   | Description                   |
| ------------- | ---------------------- | ----------------------------- |
| `run_id`      | `TEXT FK → pi_runs.id` | Parent run                    |
| `sequence`    | `INTEGER`              | Event sequence number         |
| `event_type`  | `TEXT`                 | `ChatStreamEvent` type string |
| `summary`     | `TEXT`                 | Human-readable summary        |
| `payload`     | `JSONB`                | Full event payload            |
| `recorded_at` | `TIMESTAMPTZ`          | Recording time                |

### `pi_tool_executions`

One row per tool call executed within a run.

| Column           | Type                   | Description                               |
| ---------------- | ---------------------- | ----------------------------------------- |
| `id`             | `TEXT PK`              | Tool execution UUID                       |
| `session_id`     | `TEXT FK`              | Parent session                            |
| `run_id`         | `TEXT FK → pi_runs.id` | Parent run                                |
| `tool_call_id`   | `TEXT`                 | Pi tool call ID (unique within a run)     |
| `tool_name`      | `TEXT`                 | Tool name (e.g. `read`, `write`, `bash`)  |
| `state`          | `TEXT`                 | Final state of the tool call              |
| `is_error`       | `BOOLEAN`              | Whether the call ended in error           |
| `input`          | `JSONB`                | Tool input arguments                      |
| `output`         | `JSONB`                | Tool output                               |
| `claimed_paths`  | `TEXT[]`               | File paths touched by this tool call      |
| `first_sequence` | `INTEGER`              | First stream event sequence for this call |
| `last_sequence`  | `INTEGER`              | Last stream event sequence for this call  |

### `pi_file_mutations`

One row per file path mutated within a run.

| Column           | Type                   | Description                        |
| ---------------- | ---------------------- | ---------------------------------- |
| `id`             | `TEXT PK`              | Mutation UUID                      |
| `run_id`         | `TEXT FK → pi_runs.id` | Parent run                         |
| `canonical_path` | `TEXT`                 | Absolute canonical file path       |
| `kind`           | `TEXT`                 | `created`, `updated`, or `deleted` |
| `tool_call_id`   | `TEXT`                 | Tool call that caused the mutation |
| `before_digest`  | `TEXT`                 | SHA digest before mutation         |
| `after_digest`   | `TEXT`                 | SHA digest after mutation          |
| `before_size`    | `INTEGER`              | File size in bytes before mutation |
| `after_size`     | `INTEGER`              | File size in bytes after mutation  |
| `summary`        | `TEXT`                 | Description of the change          |
| `recorded_at`    | `TIMESTAMPTZ`          | Mutation record time               |
