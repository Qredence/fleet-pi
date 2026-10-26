# API Endpoints

All types referenced below are defined in [`packages/pi-protocol/src/chat-protocol.ts`](../../../packages/pi-protocol/src/chat-protocol.ts) unless noted otherwise.

## Authentication

On Cloudflare (`FLEET_PI_DEPLOYMENT=cloudflare`) these routes require a signed-in user through `withAuthenticatedChatRequest`. Neon Managed Auth applies when `NEON_AUTH_BASE_URL`/`NEON_AUTH_URL` is set; otherwise Better Auth.

- Session routes: `/api/chat`, `/api/chat/session`, `/api/chat/resume`, `/api/chat/sessions`, `/api/chat/new`, `/api/chat/abort`, `/api/chat/question`, `/api/chat/runs`, `/api/chat/run`, `/api/chat/provenance`, `PATCH /api/chat/settings`, `/api/chat/providers`, `DELETE /api/chat/account`.
- Catalog routes: `/api/chat/models`, `/api/chat/models/discover`, `/api/chat/resources`, `/api/chat/commands`.
- Workspace routes: `/api/workspace/tree`, `/file`, `/item`, `/items`, `/search`, `/reindex`, `/health`. With Daytona BYOK they resolve the sandbox through `resolveWorkspaceContext`.

Anonymous local chat and workspace access applies only when neither Neon Auth URL is set.

---

## Chat Endpoints

### `POST /api/chat`

Stream a Pi AI response.

**Source:** `apps/web/src/routes/api/chat.ts`

**Request body:** `ChatRequest`

```ts
type ChatRequest = {
  message?: string
  model?: ChatModelSelection // string key or { provider, id, thinkingLevel }
  mode?: ChatMode // "agent" | "plan" | "harness"
  planAction?: ChatPlanAction // "execute" | "refine"
  streamingBehavior?: "steer" | "followUp"
  sessionFile?: string // Pi session JSONL path (from localStorage)
  sessionId?: string // Pi session ID (from localStorage)
  userId?: string // set from auth session, do not pass manually
  userEmail?: string // set from auth session, do not pass manually
}
```

**Response:** `application/x-ndjson` stream of `ChatStreamEvent` objects, one per line.

The stream always starts with a `start` event and ends with either `done` or `error`. Intermediate events carry text deltas, tool execution updates, plan state, thinking tokens, compaction signals, and retry notices.

```ts
type ChatStreamEvent =
  | { type: "start"; id: string; runId: string; sessionFile?: string; sessionId: string; sessionReset?: boolean; diagnostics?: string[] }
  | { type: "delta"; text: string; messageId?: string }
  | { type: "tool"; part: ChatToolPart; messageId?: string }
  | { type: "plan"; mode: ChatMode; executing: boolean; completed: number; total: number; message?: string; state: ChatPlanState }
  | { type: "state"; state: ChatStateEvent }
  | { type: "queue"; steering: string[]; followUp: string[] }
  | { type: "thinking"; text: string; messageId?: string }
  | { type: "compaction"; phase: "start" | "end"; reason: string; ... }
  | { type: "retry"; phase: "start" | "end"; attempt: number; ... }
  | { type: "done"; runId: string; message: ChatMessage; sessionFile?: string; sessionId: string; sessionReset?: boolean }
  | { type: "error"; message: string; runId?: string }
```

If `streamingBehavior` is set and an active run is in progress for the session, the message is queued instead of starting a new stream. The response is a single `queue` event.

---

### `POST /api/chat/new`

Create a new Pi session.

**Source:** `apps/web/src/routes/api/chat/new.ts`

**Request body:** `ChatSessionMetadata` (optional, used as hints)

**Response:** `ChatSessionResponse`

---

### `POST /api/chat/resume`

Resume an existing Pi session by session file path or ID.

**Source:** `apps/web/src/routes/api/chat/resume.ts`

**Request body:** `ChatSessionMetadata`

```ts
type ChatSessionMetadata = {
  sessionFile?: string
  sessionId?: string
}
```

**Response:** `ChatSessionResponse`

```ts
type ChatSessionResponse = {
  session: ChatSessionMetadata
  messages: ChatMessage[]
  sessionReset?: boolean // true if the requested session was invalid and a fresh one was created
}
```

---

### `GET /api/chat/session`

Fetch session metadata and hydrated messages.

**Source:** `apps/web/src/routes/api/chat/session.ts`

**Query params:** `sessionFile`, `sessionId` (both optional)

**Response:** `ChatSessionResponse`

---

### `GET /api/chat/sessions`

List all Pi sessions for the active runtime context.

**Source:** `apps/web/src/routes/api/chat/sessions.ts`

**Response:** `{ sessions: ChatSessionInfo[] }`

```ts
type ChatSessionInfo = {
  path: string
  id: string
  cwd: string
  name?: string
  created: string
  modified: string
  messageCount: number
  firstMessage: string
}
```

---

### `POST /api/chat/abort`

Abort an active streaming run for a session.

**Source:** `apps/web/src/routes/api/chat/abort.ts`

**Request body:** `ChatSessionMetadata`

**Response:** `{ aborted: boolean }`

---

### `POST /api/chat/fork`

Fork an existing hosted `UserPiDurable` conversation (`durable:<id>`).

**Source:** `apps/web/src/routes/api/chat/fork.ts`

**Request body:** `ChatSessionMetadata`

**Response:** `{ sessionId: string; conversationId: string }`

---

### `DELETE /api/chat/session`

Delete an owned mirrored Pi session or tombstone a hosted `UserPiDurable` conversation.

**Source:** `apps/web/src/routes/api/chat/session.ts`

**Query params:** `sessionFile`, `sessionId`

**Response:** `{ ok: true; sessionId?: string; sessionFile?: string }`

---

### `DELETE /api/chat/account`

Erase mirrored Pi sessions, BYOK provider credentials, and hosted `UserPiDurable` storage for the signed-in user.

**Source:** `apps/web/src/routes/api/chat/account.ts`

**Response:** `{ ok: true; scope: "pi-mirror" | "pi-mirror+hosted"; message: string; erasedSessions: number; erasedProviders: number; erasedHostedTranscripts: boolean }`

---

### `GET /api/chat/providers` / `POST /api/chat/providers` / `DELETE /api/chat/providers`

List, upsert, or remove provider credentials and custom provider instances (`custom+<slug>` / `openai-chat-completions+<slug>`).

**Source:** `apps/web/src/routes/api/chat/providers.ts`

---

### `POST /api/chat/models/discover`

Discover available models from a configured provider (`GET {baseUrl}/models` for custom providers, or catalog entries for built-in providers).

**Source:** `apps/web/src/routes/api/chat/models.discover.ts`

---

### `GET /api/chat/commands`

List slash commands for the InputBar (`builtin`, `extension`, `prompt`, and `skill`).

**Source:** `apps/web/src/routes/api/chat/commands.ts`

---

### `POST /api/chat/question`

Answer a plan-mode questionnaire prompt. Used when the InputBar shows a pending question from the Pi agent.

**Source:** `apps/web/src/routes/api/chat/question.ts`

**Request body:** `ChatQuestionAnswerRequest`

```ts
type ChatQuestionAnswerRequest = {
  sessionFile?: string
  sessionId?: string
  toolCallId?: string
  answer: ChatQuestionAnswer
}

type ChatQuestionAnswer = {
  kind: "single" | "multi" | "text" | "skip"
  questionId?: string
  selectedIds?: string[]
  text?: string
}
```

**Response:** `ChatQuestionAnswerResponse`

```ts
type ChatQuestionAnswerResponse = {
  ok: boolean
  message?: string
  mode?: ChatMode
  planAction?: ChatPlanAction
}
```

---

### `GET /api/chat/models`

List available Pi models from the active runtime's `ModelRegistry`.

**Source:** `apps/web/src/routes/api/chat/models.ts`

**Response:** `ChatModelsResponse`

```ts
type ChatModelsResponse = {
  models: ChatModelInfo[]
  selectedModelKey?: string
  defaultProvider?: string
  defaultModel?: string
  defaultThinkingLevel?: ChatThinkingLevel
  diagnostics: string[]
}

type ChatModelInfo = {
  key: string
  provider: string
  id: string
  name: string
  version?: string
  reasoning: boolean
  input: ("text" | "image")[]
  contextWindow?: number
  maxTokens?: number
  available: boolean
  defaultThinkingLevel?: ChatThinkingLevel
}
```

---

### `GET /api/chat/resources`

List Pi resources discovered by the active runtime: skills, prompts, extensions, packages, themes, and agent files.

**Source:** `apps/web/src/routes/api/chat/resources.ts`

**Response:** `ChatResourcesResponse`

```ts
type ChatResourcesResponse = {
  packages: ChatResourceInfo[]
  skills: ChatResourceInfo[]
  prompts: ChatResourceInfo[]
  extensions: ChatResourceInfo[]
  themes: ChatResourceInfo[]
  agentsFiles: ChatResourceInfo[]
  diagnostics: string[]
}

type ChatResourceInfo = {
  activationStatus?: "active" | "staged" | "reload-required"
  name: string
  description?: string
  installedInWorkspace?: boolean
  path?: string
  source?: string
  workspacePath?: string
  argumentHint?: string
}
```

---

### `GET /api/chat/settings`

Read Pi settings for the active runtime context.

**Source:** `apps/web/src/routes/api/chat/settings.ts`

**Response:** `ChatSettingsResponse`

```ts
type ChatSettingsResponse = {
  diagnostics: string[]
  effective: ChatPiSettings // merged effective settings
  project: ChatPiSettingsUpdate // project-local overrides from .pi/settings.json
  projectPath: string
  updateImpact: {
    newSessionRecommended: boolean
    resourceReloadRequired: boolean
  }
}
```

---

### `PATCH /api/chat/settings`

Update Pi settings. Persists supported overrides to `.pi/settings.json`.

**Source:** `apps/web/src/routes/api/chat/settings.ts`

**Request body:** `ChatSettingsUpdateRequest`

```ts
type ChatSettingsUpdateRequest = {
  settings: ChatPiSettingsUpdate
}
```

**Response:** `ChatSettingsResponse` (same as GET, reflecting the updated state)

---

### `GET /api/chat/run`

Fetch a single run record by run ID.

**Source:** `apps/web/src/routes/api/chat/run.ts`

**Query params:** `runId`

**Response:** The run record from Neon Postgres (requires `FLEET_PI_CHAT_DATABASE_URL`).

---

### `GET /api/chat/runs`

List run records for a session.

**Source:** `apps/web/src/routes/api/chat/runs.ts`

**Query params:** `sessionId`

**Response:** `{ runs: [...] }` from Neon Postgres.

---

### `GET /api/chat/provenance`

Fetch provenance metadata for a chat session or run.

**Source:** `apps/web/src/routes/api/chat/provenance.ts`

**Response:** Provenance data from the run recorder.

---

## Workspace Endpoints

### `GET /api/workspace/tree`

Return the agent-workspace file tree.

**Source:** `apps/web/src/routes/api/workspace/tree.ts`

**Response:** `WorkspaceTreeResponse`

```ts
type WorkspaceTreeResponse = {
  root: string
  nodes: WorkspaceTreeNode[]
  diagnostics: string[]
}

type WorkspaceTreeNode = {
  name: string
  path: string
  type: "directory" | "file"
  children?: WorkspaceTreeNode[]
}
```

---

### `GET /api/workspace/file`

Read a file from agent-workspace. Only files inside the active `workspaceRoot` are accessible.

**Source:** `apps/web/src/routes/api/workspace/file.ts`

**Query params:** `path` — path relative to workspace root

**Response:** `WorkspaceFileResponse`

```ts
type WorkspaceFileResponse = {
  path: string
  name: string
  content: string
  mediaType: "text/markdown" | "text/plain" | "application/octet-stream"
  size?: number
  status?: "ok" | "too-large" | "unsupported"
}
```

---

### `GET /api/workspace/item`

Fetch a single indexed workspace projection item by ID.

**Source:** `apps/web/src/routes/api/workspace/item.ts`

**Query params:** `id`

**Response:** `WorkspaceItemDetailResponse`

---

### `GET /api/workspace/items`

List indexed workspace projection items.

**Source:** `apps/web/src/routes/api/workspace/items.ts`

**Response:** `WorkspaceItemsResponse` (`{ ok: true; total: number; items: WorkspaceItemSummary[] }`)

---

### `GET /api/workspace/reindex` & `POST /api/workspace/reindex`

`GET` issues a CSRF token; `POST` triggers an explicit reindex of canonical `agent-workspace/` files into the workspace projection.

**Source:** `apps/web/src/routes/api/workspace/reindex.ts`

**Response:** `WorkspaceReindexResponse`

---

### `GET /api/workspace/search`

Search indexed workspace items and semantic records.

**Source:** `apps/web/src/routes/api/workspace/search.ts`

**Query params:** `q` — search query string

**Response:** `WorkspaceSearchResponse` (`{ ok: true; query: string; total: number; hits: ... }`)

---

### `GET /api/workspace/health`

Workspace health check. Returns the status of workspace subsystems.

**Source:** `apps/web/src/routes/api/workspace/health.ts`

**Response:** `{ status: "ok" | "degraded"; workspaceAvailable: boolean; bootstrapComplete: boolean; projectionStatus: "ok" | "degraded" }`

---

## Other Endpoints

### `GET /api/health`

Application-level health check.

**Source:** `apps/web/src/routes/api/health.ts`

**Response:** `{ status: "ok" }`

---

### `GET /api/sandbox/settings` & `POST /api/sandbox/settings`

Read or update Daytona sandbox configuration and readiness status.

**Source:** `apps/web/src/routes/api/sandbox/settings.ts`

---

### `GET /api/sandbox/preview`

Proxy a Daytona sandbox preview URL for the authenticated user.

**Source:** `apps/web/src/routes/api/sandbox/preview.ts`

**Auth:** Required. Returns 401 if unauthenticated, 503 if Daytona is not enabled, 404 if no active sandbox exists.

**Query params:** `port` — port number inside the sandbox (1–65535; default 3000)

**Response:** `{ url: string; token: string; port: number }`

---

### `POST /api/webhooks/daytona`

Receive Daytona sandbox lifecycle events. Verifies the `x-daytona-signature` header against `DAYTONA_WEBHOOK_SECRET` using timing-safe comparison before processing side effects. Returns `401` on invalid signature and `503` when `DAYTONA_WEBHOOK_SECRET` is unset on a hosted deployment.

**Source:** `apps/web/src/routes/api/webhooks/daytona.ts`

**Request body:** Daytona webhook payload (JSON)

**Response:** `{ received: true }`

---

### `ALL /api/auth/$`

Better Auth wildcard handler. Handles all Better Auth operations including sign-in, sign-up, session management, OAuth callbacks, and sign-out.

**Source:** `apps/web/src/routes/api/auth/$` (Better Auth TanStack Start adapter)

Refer to the [Better Auth documentation](https://www.better-auth.com/) for the full list of sub-routes.
