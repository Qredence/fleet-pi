# Fleet Pi Chat Runtime Session Lifecycle

## Session States & Transitions

### 1. **Browser-side Persistence (localStorage)**

```
Initial Load:
  ├─ Read from localStorage["fleet-pi-chat-session"]
  │   └─ { sessionFile?: string, sessionId?: string }
  └─ null/empty → Fresh session is created on first message

User Sends Message:
  ├─ POST /api/chat with metadata
  ├─ Server creates/reuses runtime
  └─ Browser calls persistSession(metadata)
      └─ localStorage.setItem("fleet-pi-chat-session", JSON.stringify(metadata))

Page Refresh:
  ├─ useChatStorage reads localStorage
  ├─ initialSessionMetadata populated
  └─ useEffect in usePiChat loads messages via POST /api/chat/resume if sessionId present
```

### 2. **Session Creation Flow**

```
Browser (no sessionId/sessionFile):
  ├─ POST /api/chat with empty metadata
  │   └─ or POST /api/chat/new
  ↓
Server (server-runtime.ts createPiRuntime):
  ├─ createSessionManager()
  │   ├─ resolveSessionFile() → undefined (no file to resolve)
  │   └─ SessionManager.create(projectRoot, sessionDir)
  │       └─ Creates new JSONL file in `.fleet/sessions/`
  ├─ trackRuntime(runtime)
  │   └─ runtimeRecords.set(sessionId, record)
  └─ Return ChatStartEvent
      └─ { sessionFile, sessionId, sessionReset: false }

Browser receives response:
  ├─ Extract sessionFile & sessionId from ChatStartEvent
  └─ persistSession() → localStorage
```

### 3. **Session Reuse / Hydration Flow**

```
Browser (has sessionId in localStorage):
  ├─ Page loads or new message sent
  ├─ POST /api/chat with sessionId
  │   └─ Browser also passes model, mode, message
  ↓
Server (server-runtime.ts createPiRuntime):
  ├─ Check runtimeRecords cache
  │   ├─ If found & not expired (< RUNTIME_TTL_MS):
  │   │   ├─ Clear dispose timeout
  │   │   ├─ retainPiRuntime() scheduled disposal
  │   │   └─ Return cached runtime, sessionReset: false
  │   └─ If not found or expired:
  │       └─ Create fresh runtime from session file
  │
  ├─ If reuse skipped:
  │   ├─ createSessionManager()
  │   │   ├─ resolveSessionFile(metadata, repoRoot, sessionDir)
  │   │   │   ├─ Validate sessionFile path (project-scoped)
  │   │   │   └─ If valid → SessionManager.open(sessionFile, ...)
  │   │   └─ If invalid → fresh SessionManager
  │   └─ Return { sessionReset: true/false }
  ├─ trackRuntime(newRuntime)
  └─ Return ChatStartEvent { sessionReset, ... }

Browser receives response:
  ├─ If sessionReset: true
  │   └─ Messages cleared (conversation reset)
  └─ else
      └─ Messages preserved in JSONL, hydrated from Pi session
```

### 4. **Runtime Lifecycle (In-Memory Cache)**

**Creation:**

- `createPiRuntime()` → `AgentSessionRuntime` instance
- Tracked in `runtimeRecords` Map

**Reuse Window:**

- TTL = `FLEET_PI_RUNTIME_TTL_MS` (default: 600_000 ms = 10 min)
- On reuse: `retainPiRuntime()` clears any existing dispose timeout
- `lastUsedAt` updated on each use

**Cleanup:**

- `scheduleRuntimeDisposal()` after TTL expires
- Dispose calls:
  - `session.abort()` (if streaming)
  - `dispose()` on all Pi services
- `runtimeRecords.delete(sessionId)`

**Follow-up Prompts (Steering/Queue):**

- If session is still streaming:
  - `queuePromptOnActiveSession()` adds prompt to Pi queue
  - Returns `{ steering, followUp }` messages
  - Response type changes to `{ type: "queue", ... }`
  - No new runtime created

## Session File Structure

**Location:**

- Default: `.fleet/sessions/` (or configured via settings)
- Resolves relative to `projectRoot`

**Validation (isUsableSessionFile):**

```
1. File exists on disk
2. Resolve both paths to real paths (follow symlinks)
3. Session file must be INSIDE session directory
   └─ Prevents access to /etc/passwd, /home/user/secret, etc.
```

**Content:**

- JSONL (JSON Lines) format
- One line per Pi turn event
- `SessionManager` reads/writes entries
- Persists all tool execution, LLM messages, etc.

## Session Metadata Contract

```typescript
type ChatSessionMetadata = {
  sessionFile?: string // Relative or absolute path to JSONL
  sessionId?: string // UUID from SessionManager.getSessionId()
}
```

**Storage:**

- Browser: `localStorage["fleet-pi-chat-session"]`
- Server: `runtimeRecords[sessionId]` (TTL-gated)
- Disk: Pi session JSONL file

## Session Reset Scenarios

**Explicit Reset:**

```
User clicks "New session"
  ├─ POST /api/chat/new
  └─ createNewChatSession() always creates fresh SessionManager
```

**Implicit Reset (Transparent):**

```
1. sessionFile path outside sessionDir
   └─ Security boundary violation → fresh session
2. sessionFile does not exist on disk
   └─ Session moved/deleted → fresh session
3. sessionId points to no file in sessionDir
   └─ ID resolution failed → fresh session
4. SessionManager.open() throws
   └─ Corrupted JSONL → fresh session
```

**TTL-based Cleanup:**

```
Runtime not used for 10+ minutes
  └─ Disposed from memory
  └─ Next request creates new runtime from session file
     └─ sessionReset: false (file still valid)
```

## Mode & Plan State Persistence

**Plan Mode:**

```
POST /api/chat { mode: "plan", ... }
  ├─ createPiRuntime() + applyPlanMode()
  └─ Pi runs with tool allowlist (read-only)
      └─ Restricts tool use to read/bash/find/ls/grep/questionnaire

Plan State Persisted in Session:
  ├─ Extracted from Pi turn log via restorePlanState()
  ├─ Restored on hydration (POST /api/chat/resume)
  └─ Converted to ChatPlanTurn tool part for UI

User Action:
  ├─ "Execute" → mode: "agent" (unlock full tools)
  ├─ "Refine" → POST /api/chat/question (same turn)
  └─ "Stay" → POST /api/chat/question (stay in plan mode)
```

## Error Handling & Diagnostics

**Session Validation Errors:**

- Logged but silent to user (fresh session is fallback)
- Diagnostics collected and sent in `ChatStartEvent`

**Examples:**

```
- modelRegistry.getError()
- settingsManager.drainErrors()
- resourceLoader diagnostics (skill load failures, etc.)
- Bedrock circuit breaker fallback errors
```

## Summary Table

| Event                      | Source               | Action                                  | Result                                               |
| -------------------------- | -------------------- | --------------------------------------- | ---------------------------------------------------- |
| Page load (no session)     | Browser localStorage | Create fresh SessionManager             | New JSONL file, sessionFile + sessionId stored       |
| Page load (with sessionId) | Browser localStorage | Check runtimeRecords, open session file | Messages hydrated from JSONL, sessionReset: false    |
| User sends message         | Browser input        | POST /api/chat                          | Create/reuse runtime, return ChatStreamEvent stream  |
| Message complete           | Browser              | persistSession() → localStorage         | Next session reuse will use same sessionId           |
| 10 min idle                | Server timeout       | scheduleRuntimeDisposal                 | Runtime disposed, JSONL file preserved               |
| Next message after idle    | Browser              | POST /api/chat with sessionId           | New runtime created from preserved JSONL file        |
| User clicks "New session"  | Browser              | POST /api/chat/new                      | Fresh SessionManager, no sessionFile in localStorage |
| Session file deleted       | Disk                 | (next POST /api/chat)                   | Fresh session created (silent fallback)              |
