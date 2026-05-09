# Fleet Pi Architecture

Use this file for durable, repo-grounded architecture notes.

What belongs here:

- stable structural facts about the app and monorepo
- important runtime boundaries
- key data flows future agents need often
- links to source files that act as architecture anchors

What does not belong here:

- speculative designs
- session-specific debugging notes
- raw command output

## Current snapshot

- Fleet Pi is a browser-based coding-agent chat UI built in this repository.
- The repo contains a web app under `apps/web`, shared UI under `packages/ui`,
  and Pi resources under `.pi/`.
- Chat-installed Pi runtime resources are canonical under `agent-workspace/pi/`.
  Root `.pi/settings.json` remains the compatibility bridge that points Pi at
  `../agent-workspace/pi/skills`, `../agent-workspace/pi/prompts`, and enabled
  workspace extensions.

## Key entry points

### Browser UI

- **`apps/web/src/routes/index.tsx`**: Main chat surface. Renders `AgentChat` (message transcript), `InputBar` (prompt + model/mode selector), and right-side panels (resources, workspace tree, configuration). Uses `usePiChat` hook for session/stream state management.

### API Routes (all under `/api/`)

- **`/api/chat`** (POST): Primary streaming endpoint. Receives `ChatRequest` with message, model, mode ("agent"/"plan"), and session metadata. Returns NDJSON stream with `ChatStreamEvent` objects. Handles Pi runtime lifecycle (create, reuse, dispose).
- **`/api/chat/new`** (POST): Creates a fresh session. Returns `ChatSessionResponse` with `sessionFile`, `sessionId`, and empty message history.
- **`/api/chat/resume`** (POST): Hydrates an existing session from metadata. Returns `ChatSessionResponse` with persisted message history and plan state if applicable.
- **`/api/chat/session`** (GET): Gets current session metadata (used for local state hydration).
- **`/api/chat/sessions`** (GET): Lists all stored sessions (for session picker).
- **`/api/chat/abort`** (POST): Aborts current streaming session.
- **`/api/chat/question`** (POST): Answers plan-mode or questionnaire prompts. Resumes the same turn.
- **`/api/chat/models`** (GET): Returns available models from Bedrock + Pi registry. Filters by thinking level.
- **`/api/chat/resources`** (GET): Returns discovered skills, prompts, extensions, themes, and diagnostics.
- **`/api/workspace/tree`** (GET): Returns read-only filesystem tree under `agent-workspace/`.
- **`/api/workspace/file`** (GET): Fetches file preview (text files, safe for preview).

### Backend Runtime Modules

- **`apps/web/src/lib/pi/server.ts`**: Barrel export; re-exports from server-\*.ts modules.
- **`apps/web/src/lib/pi/server-runtime.ts`**:
  - `createPiRuntime()`: Initializes or reuses `AgentSessionRuntime` with Pi model/tool setup.
  - `retainPiRuntime()`: Extends runtime TTL (default 10 min) by clearing scheduled disposal.
  - `queuePromptOnActiveSession()`: Adds follow-up prompts to active stream (steer/followUp).
  - `abortActiveSession()`: Stops streaming, aborts bash/retry/compaction.
  - Runtime record tracking with in-memory cache (`runtimeRecords` Map).
- **`apps/web/src/lib/pi/server-sessions.ts`**:
  - `createNewChatSession()`: Fresh `SessionManager` + JSONL file.
  - `hydrateChatSession()`: Restores session from file or creates fresh if invalid/outside.
  - `listChatSessions()`: Lists all stored sessions.
  - Session validation logic (`isUsableSessionFile`, `resolveSessionFile`).
- **`apps/web/src/lib/pi/plan-mode.ts`**: Plan mode extension; extracts `Plan:` steps, manages questionnaire questions and decision prompts.
- **`apps/web/src/lib/pi/chat-protocol.ts`**: Type definitions for `ChatRequest`, `ChatStreamEvent` (start/delta/tool/plan/state/queue/thinking/compaction/retry), `ChatSessionMetadata`, `ChatMode`, etc.

### Browser-side Chat Client

- **`apps/web/src/lib/pi/use-pi-chat.ts`**: React hook managing session state, streaming state, message history, message sending, and answer submission.
- **`apps/web/src/lib/pi/chat-client.ts`**: `ChatClient` — browser HTTP client for `/api/chat*` endpoints.
- **`apps/web/src/lib/pi/chat-stream-state.ts`**: Reducer applying `ChatStreamEvent` to message transcript, handling tool parts, thinking, plan updates.
- **`apps/web/src/lib/pi/chat-message-helpers.ts`**: Normalizes Pi session events into `ChatMessage` + `ChatMessagePart` (tool-Read, tool-Write, tool-Edit, tool-Bash, tool-PlanWrite, tool-Thinking).

### Pi Tool Renderers

- **`apps/web/src/components/pi/tool-renderers.ts`**: Maps `ChatToolPart` type → React renderer for built-in tools (read, write, edit, bash, PlanWrite, thinking).

## Important boundaries

1. **Session scope**: Sessions are project-scoped. Invalid/outside session files silently start fresh.
2. **Runtime lifetime**: In-memory `AgentSessionRuntime` cached for ~10 min (configurable `FLEET_PI_RUNTIME_TTL_MS`). Reused across multiple `/api/chat` requests if sessionId matches.
3. **NDJSON streaming**: Events are newline-delimited JSON; browser reads until connection closes or error.
4. **Tool execution**: All Pi tools (read, write, edit, bash) scoped to `projectRoot`. Plan mode restricts to read-only tools.
5. **resource_install**: Agent-mode only. Writes to `agent-workspace/pi/`. Executable extensions/packages staged unless user explicitly activates.
6. **Plan mode**: If `mode: "plan"`, Pi runs in read-only tool mode with plan extraction and questionnaire interception. Execution switches to full Agent mode on user "Execute" action.

## Data flows worth preserving

### 1. Chat Initiation Flow

```
Browser localStorage [sessionFile/sessionId]
    ↓
GET /api/chat/session (optional)
    ↓
POST /api/chat (with metadata)
    ↓
createPiRuntime(context, metadata)
    ├─ Check runtimeRecords cache (reuse if valid)
    └─ Create fresh AgentSessionRuntime + SessionManager if not reusable
    ↓
Return ChatStartEvent { sessionFile, sessionId, sessionReset, diagnostics }
```

### 2. Message Streaming Flow

```
POST /api/chat { message, model, mode, sessionId }
    ↓
createPiRuntime (reuse or create)
    ↓
session.prompt(message)
    ↓
Pi processes tools (read/write/edit/bash) + LLM streaming
    ↓
SessionEvent subscription sends stream of events:
    - tool-parts normalized to ChatToolPart
    - thinking text wrapped in ChatStreamEvent { type: "thinking" }
    - plan steps extracted & sent as ChatStreamEvent { type: "plan" }
    ↓
encodeEvent (JSON + newline) → ReadableStream → browser
    ↓
Browser NDJSON parser applies ChatStreamEvent to message state
    ↓
applyChatStreamEvent (chat-stream-state.ts reducer)
    ├─ delta → append text
    ├─ tool → upsert ChatMessagePart
    ├─ plan → update plan state + pending decision
    └─ thinking → accumulate thinking text
    ↓
React re-render with updated messages + tool cards
```

### 3. Session Persistence Flow

```
Browser sends POST /api/chat with sessionId
    ↓
server-runtime.ts finds matching runtimeRecord
    ↓
If not found or TTL expired:
    ├─ createSessionManager loads Pi session file
    ├─ Validates sessionFile path (project-scoped)
    └─ If invalid → fresh SessionManager
    ↓
SessionManager.getBranch() → Pi session entries
    ↓
sessionEntriesToChatMessages (server-utils.ts)
    ├─ Convert Pi turn logs to ChatMessage[]
    └─ Restore plan state if present
    ↓
Return ChatSessionResponse { session, messages, sessionReset }
    ↓
Browser localStorage.setItem("sessionFile", response.session.sessionFile)
```

### 4. Model Selection Flow

```
GET /api/chat/models
    ↓
loadChatModels (server-catalog.ts)
    ├─ Bedrock ModelRegistry via Pi
    ├─ Filter by thinking level if applicable
    └─ Append project-local prompt/extension metadata
    ↓
Return Array<ChatModelOption>
    ↓
Browser ModelPicker renders dropdown
    ↓
User selects model + optional thinkingLevel
    ↓
Next POST /api/chat includes model selection
    ↓
createPiRuntime → applyModelSelection()
```

### 5. Plan Mode Question Flow

```
Plan extraction encounters questionnaire tool call
    ↓
isPlanDecisionToolCall() detects it
    ↓
Send ChatStreamEvent { type: "plan", pendingDecision: true }
    ↓
Browser InputBar shows question prompt (Question tool part)
    ↓
User answers question
    ↓
POST /api/chat/question { toolCallId, answer }
    ↓
answerChatQuestion (server-runtime.ts)
    ├─ findRuntimeRecord (same session)
    ├─ resolveQuestionnaireAnswer (decode answer type)
    ├─ answerPlanDecision() resumes turn
    └─ Emit questionnaire response to Pi
    ↓
Same session continues (not a new turn)
```

## Architecture anchors

- **Session identity**: `sessionId` (UUID) + optional `sessionFile` (project-relative path to JSONL).
- **Request routing**: TanStack Start file routes; API handlers are server functions.
- **State management**: Browser localStorage (session metadata), in-memory runtimeRecords (runtime), Pi session files (persistent turn history).
- **Streaming protocol**: NDJSON (one JSON object per line).
- **Tool execution**: Direct in-process; scoped to projectRoot + optional bash cwd.
- **Error handling**: `RequestContextError` for HTTP status, wrapped in `getErrorMessage()` + JSON response.
