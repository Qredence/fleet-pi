# Fleet Pi NDJSON Streaming Protocol

## Protocol Overview

**Format:** Newline-Delimited JSON (NDJSON)

- One JSON object per line
- UTF-8 encoding
- Content-Type: `application/x-ndjson; charset=utf-8`
- Cache-Control: `no-cache`

## Browser → Server: Request

### POST /api/chat

```typescript
ChatRequest {
  message?: string          // User's prompt (required for normal flow)
  model?: ChatModelSelection // Provider + model ID + thinking level
  mode?: ChatMode           // "agent" | "plan"
  planAction?: ChatPlanAction // "execute" | "refine"
  streamingBehavior?: "steer" | "followUp" // Queue behavior
  sessionFile?: string      // Path to Pi session JSONL
  sessionId?: string        // UUID from prior session
}
```

**Example:**

```json
{
  "message": "Find all Python files in this repo",
  "model": {
    "provider": "amazon-bedrock",
    "id": "us.anthropic.claude-sonnet-4-6",
    "thinkingLevel": "high"
  },
  "mode": "agent",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Request Flow (Browser → Server)

```
1. User types message, selects model/mode
2. Browser -> chatClient.streamMessage(request, onEvent, signal)
3. POST /api/chat with body: JSON.stringify(request)
4. Optional: Add header "x-request-id" for correlation
5. Server responds with 200 + streaming body
```

## Server → Browser: Response Stream

### NDJSON Event Types

All events inherit structure:

```typescript
type ChatStreamEvent =
  | ChatStartEvent
  | ChatDeltaEvent
  | ChatToolEvent
  | ChatThinkingEvent
  | ChatPlanEvent
  | ChatStateEvent
  | ChatQueueEvent
  | ChatCompactionEvent
  | ChatRetryEvent
  | ChatErrorEvent
  | ChatDoneEvent
```

#### 1. ChatStartEvent (First event)

```typescript
{
  type: "start"
  id: string                    // Assistant message UUID
  sessionFile: string           // Path to Pi session JSONL
  sessionId: string             // UUID for this session
  sessionReset?: boolean        // true if fresh session
  diagnostics?: string[]        // Warnings (model fallback, resource errors, etc.)
}
```

**Example:**

```json
{
  "type": "start",
  "id": "uuid-1",
  "sessionFile": ".fleet/sessions/abc123.jsonl",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionReset": false,
  "diagnostics": []
}
```

**Browser handling:**

- Store `sessionFile` + `sessionId` in localStorage
- Create new ChatMessage with empty text (for streaming content)
- Show diagnostics if present

#### 2. ChatDeltaEvent (Streaming text)

```typescript
{
  type: "delta"
  text: string                  // Incremental text chunk (UTF-8)
  messageId?: string            // Optional correlation (normally null)
}
```

**Example:**

```json
{"type":"delta","text":"The repository contains "}
{"type":"delta","text":"the following Python files:"}
```

**Browser handling:**

- Append `text` to current assistant message
- Update UI (streaming text visible in real-time)

#### 3. ChatThinkingEvent (Extended thinking output)

```typescript
{
  type: "thinking"
  text: string                  // Accumulated thinking text
  messageId?: string
}
```

**Example:**

```json
{ "type": "thinking", "text": "I need to search the repo for Python files..." }
```

**Browser handling:**

- Add/update `tool-Thinking` part in message
- May be hidden by default (collapsed) in UI

#### 4. ChatToolEvent (Tool call result)

```typescript
{
  type: "tool"
  part: ChatToolPart            // Rendered tool (read, write, edit, bash, etc.)
  messageId?: string
}
```

**ChatToolPart subtypes:**

```typescript
// Read tool
{
  type: "tool-Read"
  toolCallId: string
  input: { path: string }
  status: "running" | "success" | "error"
  output?: string
  error?: string
}

// Write tool
{
  type: "tool-Write"
  toolCallId: string
  input: { path: string, content: string }
  status: "running" | "success" | "error"
  output?: string
  error?: string
}

// Edit tool
{
  type: "tool-Edit"
  toolCallId: string
  input: { path: string, oldText: string, newText: string }
  status: "running" | "success" | "error"
  output?: string
  error?: string
}

// Bash tool
{
  type: "tool-Bash"
  toolCallId: string
  input: { command: string, cwd?: string }
  status: "running" | "success" | "error"
  output?: string
  error?: string
}

// Plan tool
{
  type: "tool-PlanWrite"
  toolCallId: string
  input: {
    step: number
    text: string
    completed: boolean
    approved?: boolean
    pendingDecision?: boolean
    onExecute?: () => void
    onRefine?: (instructions?: string) => void
    onStay?: () => void
  }
  status: "running" | "success" | "error"
}

// Thinking tool (read-only display)
{
  type: "tool-Thinking"
  toolCallId: string
  input: { content: string }
  status: "success"
}

// Question tool (questionnaire response)
{
  type: "tool-Question"
  toolCallId: string
  input: ChatQuestion
  status: "running" | "success"
}
```

**Example:**

```json
{
  "type": "tool",
  "part": {
    "type": "tool-Bash",
    "toolCallId": "bash-1",
    "input": { "command": "find . -name '*.py' -type f" },
    "status": "success",
    "output": "./src/app.py\n./tests/test_app.py"
  }
}
```

**Browser handling:**

- Create/update tool card in message
- Display tool input (command, path, etc.)
- Show output or error
- For tool-PlanWrite: render buttons (Execute, Refine, Stay)

#### 5. ChatQueueEvent (Follow-up prompt available)

```typescript
{
  type: "queue"
  steering: string[]            // Suggested steering prompts
  followUp: string[]            // Suggested follow-up prompts
}
```

**Example:**

```json
{
  "type": "queue",
  "steering": [],
  "followUp": ["Explain what each file does", "Refactor the imports"]
}
```

**Browser handling:**

- Show queue status badge ("Queued: 2 messages")
- Display follow-up suggestions in InputBar
- User can click to send follow-up without interrupting current stream

#### 6. ChatPlanEvent (Plan mode state update)

```typescript
{
  type: "plan"
  mode: ChatMode
  executing: boolean            // true while executing plan steps
  completed: number
  total: number
  message?: string              // Plan summary or status
  state: ChatPlanState
}
```

**Example:**

```json
{
  "type": "plan",
  "mode": "plan",
  "executing": false,
  "completed": 1,
  "total": 3,
  "message": "Plan created: 3 steps",
  "state": {
    "todos": [{ "step": 1, "text": "Analyze requirements", "completed": true }]
  }
}
```

**Browser handling:**

- Update plan progress indicator
- Show plan steps (completed/pending)
- If `pendingDecision=true`: show decision buttons

#### 7. ChatStateEvent (State machine transitions)

```typescript
{
  type: "state"
  state: { name: "agent_start" | "turn_start" | "message_start" | "message_end" | ... }
}
```

**Example:**

```json
{ "type": "state", "state": { "name": "turn_end" } }
```

**Browser handling:**

- Update `activityLabel` ("Receiving response", "Turn finished", etc.)
- Used for activity indicators

#### 8. ChatCompactionEvent (Session compaction)

```typescript
{
  type: "compaction"
  phase: "start" | "end"
  reason: string                // Why compaction occurred
  aborted?: boolean
  willRetry?: boolean
  errorMessage?: string
}
```

**Example:**

```json
{"type":"compaction","phase":"start","reason":"Token budget exceeded"}
{"type":"compaction","phase":"end","reason":"Token budget exceeded","aborted":false,"willRetry":false}
```

**Browser handling:**

- Show status ("Compacting session", "Compaction finished")
- If `willRetry=true`: show retry indicator

#### 9. ChatRetryEvent (Auto-retry after failure)

```typescript
{
  type: "retry"
  phase: "start" | "end"
  attempt: number
  maxAttempts: number
  delayMs?: number              // Only on phase="start"
  errorMessage?: string
  success?: boolean             // Only on phase="end"
}
```

**Example:**

```json
{"type":"retry","phase":"start","attempt":1,"maxAttempts":3,"delayMs":1000,"errorMessage":"Bedrock throttled"}
{"type":"retry","phase":"end","attempt":1,"success":false}
```

**Browser handling:**

- Show retry indicator ("Retrying request 1/3")
- Display delay countdown if applicable
- Show final success/failure

#### 10. ChatErrorEvent (Error occurred)

```typescript
{
  type: "error"
  message: string
}
```

**Example:**

```json
{ "type": "error", "message": "Model not available" }
```

**Browser handling:**

- Show error toast/banner
- Log error
- Stream typically closes after error

#### 11. ChatDoneEvent (Stream complete)

```typescript
{
  type: "done"
}
```

**Example:**

```json
{ "type": "done" }
```

**Browser handling:**

- Mark stream as complete
- Set status to "ready"
- Allow new message to be sent

## Browser Parsing: readChatStream()

```typescript
async function readChatStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void
) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Chat response did not include a stream")

  const decoder = new TextDecoder()
  let buffer = ""

  // Loop until stream closed
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break

    // Decode bytes (handles multi-byte UTF-8)
    buffer += decoder.decode(value, { stream: true })

    // Split on newlines
    let newlineIndex = buffer.indexOf("\n")
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      if (line) {
        // Parse JSON + validate against schema
        const data = JSON.parse(line)
        onEvent(
          parseWithSchema(ChatStreamEventSchema, data, "Chat stream event")
        )
      }

      buffer = buffer.slice(newlineIndex + 1)
      newlineIndex = buffer.indexOf("\n")
    }
  }

  // Handle final incomplete line
  buffer += decoder.decode()
  if (buffer.trim()) {
    const data = JSON.parse(buffer)
    onEvent(parseWithSchema(ChatStreamEventSchema, data, "Chat stream event"))
  }
}
```

**Key behaviors:**

- Handles multi-byte UTF-8 chars gracefully (`stream: true` in decode)
- Buffers partial lines until newline received
- Validates each event against `ChatStreamEventSchema` (Zod)
- Throws if parse fails (connection error)

## Server Encoding: encodeEvent()

```typescript
function encodeEvent(event: unknown) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`)
}
```

**Example flow:**

```
event = { type: "delta", text: "Hello" }
  ↓
JSON.stringify(event)
  = `{"type":"delta","text":"Hello"}`
  ↓
Append newline
  = `{"type":"delta","text":"Hello"}\n`
  ↓
TextEncoder.encode()
  = Uint8Array [ 123, 34, 116, ... (UTF-8 bytes) ]
  ↓
controller.enqueue(bytes)
  → Network sends bytes
```

## Message Accumulation: applyChatStreamEvent()

```typescript
function applyChatStreamEvent(
  transition: { assistantId: string; snapshot: ChatStreamSnapshot },
  event: ChatStreamEvent
): ChatStreamTransition {
  // Example: "delta" event
  if (event.type === "delta" && transition.assistantId) {
    return {
      ...transition,
      snapshot: {
        ...transition.snapshot,
        messages: appendAssistantDelta(
          transition.snapshot.messages,
          transition.assistantId,
          event.text
        ),
      },
    }
  }

  // Example: "tool" event
  if (event.type === "tool" && transition.assistantId) {
    return {
      ...transition,
      snapshot: {
        ...transition.snapshot,
        messages: upsertAssistantToolPart(
          transition.snapshot.messages,
          transition.assistantId,
          event.part
        ),
      },
    }
  }

  // ... etc for all event types
}
```

**Result:**

- Single `ChatMessage` object accumulates all parts (text + tools + thinking)
- UI re-renders as each event applied (live streaming)

## Example Complete Conversation

```
Browser sends:
POST /api/chat
{
  "message": "List Python files",
  "sessionId": "sess-123"
}

Server responds (NDJSON stream):
{"type":"start","id":"msg-1","sessionId":"sess-123","sessionFile":".fleet/sessions/abc.jsonl"}
{"type":"delta","text":"I'll find all Python files in the repository."}
{"type":"tool","part":{"type":"tool-Bash","toolCallId":"bash-1","input":{"command":"find . -name '*.py' -type f"},"status":"running"}}
{"type":"tool","part":{"type":"tool-Bash","toolCallId":"bash-1","input":{"command":"find . -name '*.py' -type f"},"output":"./src/main.py\n./tests/test_main.py","status":"success"}}
{"type":"delta","text":" Found 2 Python files."}
{"type":"state","state":{"name":"message_end"}}
{"type":"done"}

Browser handling:
1. "start" → Create assistant message, store sessionId
2. "delta" → Append text ("I'll find...")
3. "tool" (bash-1, running) → Show tool card with command
4. "tool" (bash-1, success) → Update card with output
5. "delta" → Append text (" Found 2...")
6. "state" → Update activity label
7. "done" → Mark stream complete
```

## Error Handling

### Connection Error

```
Stream closes unexpectedly
  ↓
reader.read() returns { done: true }
  ↓
Loop breaks
  ↓
If no "done" event received:
  └─ ChatStatus set to "error"
  └─ Show error toast
```

### Parse Error

```
Invalid NDJSON line: "not valid json"
  ↓
JSON.parse() throws SyntaxError
  ↓
Catch & throw: "Chat stream event parsing failed"
  ↓
Browser shows error toast
```

### Schema Validation Error

```
Event doesn't match ChatStreamEventSchema
  ↓
parseWithSchema() throws
  ↓
Error: "Chat stream event did not match the expected contract"
  ↓
Stream aborts (treated as protocol error)
```

## Aborts & Follow-ups

### Abort Active Stream

```
POST /api/chat/abort
{ "sessionId": "sess-123" }

Server:
  ├─ findRuntimeRecord(sessionId)
  ├─ session.abort() (sends signal to Pi)
  ├─ Stops event stream
  └─ Return true/false

Browser:
  ├─ abortController.abort()
  ├─ readChatStream() detects reader.read() closes
  └─ Set status="ready"
```

### Queue Follow-up

```
POST /api/chat { message, sessionId, streamingBehavior: "followUp" }

Server:
  ├─ If session is streaming:
  │   ├─ queuePromptOnActiveSession()
  │   └─ Send ChatQueueEvent
  └─ Else:
      └─ Create new runtime (normal flow)

Browser:
  ├─ Receives ChatQueueEvent
  ├─ Shows queue status ("Queued: 1 message")
  └─ InputBar shows follow-up options
```

## Performance Notes

- **Buffering:** Browser buffers partial UTF-8 chars (handled by TextDecoder)
- **Parsing:** Zod schema validation on every event (minimal overhead)
- **Memory:** Events upserted into immutable message arrays (React reconciliation)
- **Backpressure:** No explicit flow control; relies on OS buffers
- **Latency:** ~0-50ms per event (network + parsing + React render)
