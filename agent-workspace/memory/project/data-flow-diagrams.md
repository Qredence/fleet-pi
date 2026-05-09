# Fleet Pi Chat Architecture: Complete Data Flow Diagram

## High-Level Request-Response Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            BROWSER (React)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────┐         ┌──────────────────┐                      │
│  │   Chat UI        │         │  localStorage    │                      │
│  │                  │         │                  │                      │
│  │ • Input Bar      │◄───────►│ sessionFile      │                      │
│  │ • Message List   │         │ sessionId        │                      │
│  │ • Tool Cards     │         │ mode             │                      │
│  │ • Right Panels   │         │ themePreference  │                      │
│  └────────┬─────────┘         └──────────────────┘                      │
│           │                                                              │
│           │ 1. POST /api/chat                                           │
│           │    { message, model, mode, sessionId }                      │
│           │                                                              │
└───────────┼──────────────────────────────────────────────────────────────┘
            │
            │ HTTP Request
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SERVER (TanStack Start)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  /api/chat POST Handler (apps/web/src/routes/api/chat.ts)              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 1. Parse ChatRequest                                            │   │
│  │ 2. createPiRuntime(context, metadata, model)                   │   │
│  │    ├─ Check runtimeRecords[sessionId] (cache hit?)             │   │
│  │    ├─ If reuse: applyModelSelection + applyPlanMode            │   │
│  │    └─ If new:                                                  │   │
│  │        ├─ createSessionManager(metadata)                       │   │
│  │        │   ├─ resolveSessionFile(sessionId)                    │   │
│  │        │   └─ SessionManager.open() or .create()              │   │
│  │        ├─ createSessionServices(context)                       │   │
│  │        │   ├─ ModelRegistry (Bedrock connection)               │   │
│  │        │   ├─ SettingsManager (.pi/settings.json)              │   │
│  │        │   ├─ ResourceLoader (skills, prompts, extensions)     │   │
│  │        │   └─ ToolRegistry (CHAT_TOOL_ALLOWLIST)               │   │
│  │        ├─ resolveModelSelection(services, model)               │   │
│  │        ├─ bedrockCircuitBreaker.fire({...})                    │   │
│  │        │   └─ createAgentSessionFromServices (Bedrock)         │   │
│  │        └─ createAgentSessionRuntime(factory)                   │   │
│  │            ├─ applyPlanMode(runtime, mode, planAction)         │   │
│  │            └─ trackRuntime(runtime) → runtimeRecords cache     │   │
│  │                                                                 │   │
│  │ 3. Subscribe to session.subscribe(event)                       │   │
│  │    ├─ Listen for Pi AgentSessionEvent                          │   │
│  │    └─ Convert to ChatStreamEvent + encode NDJSON              │   │
│  │                                                                 │   │
│  │ 4. Return ReadableStream<Uint8Array>                           │   │
│  │    └─ Content-Type: application/x-ndjson                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────┬──────────────────────┘
                                                    │
                          2. HTTP Streaming Response (NDJSON)
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            BROWSER (Fetch)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  readChatStream(response, onEvent)                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 1. response.body.getReader()                                    │   │
│  │ 2. For each chunk:                                              │   │
│  │    ├─ decoder.decode(value, { stream: true })                  │   │
│  │    ├─ Split on newlines                                         │   │
│  │    └─ For each line:                                            │   │
│  │        ├─ JSON.parse(line)                                      │   │
│  │        ├─ Validate against ChatStreamEventSchema (Zod)          │   │
│  │        └─ onEvent(chatStreamEvent)                              │   │
│  │                                                                  │   │
│  │ 3. usePiChat hook receives event                                │   │
│  │    └─ applyChatStreamEvent(transition, event)                   │   │
│  │        └─ Reducer: accumulate state (messages, activity, plan)  │   │
│  │                                                                  │   │
│  │ 4. React re-render                                              │   │
│  │    └─ UI updates with new message text/tools/plan              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  3. Streaming complete (done event or connection closes)                │
│     └─ setStatus("ready") → allow new message                           │
│     └─ persistSession(sessionMetadata) → localStorage                   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Internal Server Runtime Lifecycle

```
createPiRuntime() ──────────────────────────────────────────────────┐
                                                                    │
                                                                    ▼
                                              ┌─────────────────────────┐
                                              │ runtimeRecords Cache    │
                                              │                         │
                                              │ sessionId → record      │
                                              │  ├─ runtime             │
                                              │  ├─ sessionFile         │
                                              │  ├─ sessionId           │
                                              │  ├─ lastUsedAt          │
                                              │  └─ disposeTimer?       │
                                              └────────────┬────────────┘
                                                           │
                                    ┌──────────────────────┴──────────────────┐
                                    │                                          │
                                    ▼ Cache Hit (< TTL)                       ▼ Cache Miss
                                    │                                          │
                    Reuse existing runtime              Create new runtime
                    │                                   │
                    ├─ Clear disposeTimer                ├─ createSessionManager
                    ├─ applyModelSelection              │   ├─ resolveSessionFile
                    ├─ applyPlanMode                    │   │   ├─ validate path
                    ├─ retainPiRuntime()                │   │   │  (inside sessionDir)
                    │  └─ scheduleRuntimeDisposal()     │   │   └─ open JSONL or create
                    │     (set timeout @ RUNTIME_TTL)   │   ├─ SessionManager ready
                    └─ Return runtime                   │
                                                        ├─ createSessionServices
                                                        │   ├─ Bedrock ModelRegistry
                                                        │   ├─ SettingsManager
                                                        │   ├─ ResourceLoader
                                                        │   │   ├─ Load .pi/skills
                                                        │   │   ├─ Load workspace skills
                                                        │   │   ├─ Load extensions
                                                        │   │   └─ Collect diagnostics
                                                        │   └─ ToolRegistry
                                                        │
                                                        ├─ resolveModelSelection
                                                        │   ├─ Parse provider/id/thinking
                                                        │   ├─ Handle Bedrock region variants
                                                        │   └─ Return Model + thinking level
                                                        │
                                                        ├─ bedrockCircuitBreaker.fire
                                                        │   ├─ createAgentSessionFromServices
                                                        │   │   ├─ Connect Bedrock
                                                        │   │   ├─ Validate model available
                                                        │   │   └─ AgentSession ready
                                                        │   └─ Return result or fallback error
                                                        │
                                                        ├─ createAgentSessionRuntime
                                                        │   ├─ Wrap AgentSession
                                                        │   ├─ Add execute/evaluate methods
                                                        │   └─ Ready for streaming
                                                        │
                                                        ├─ trackRuntime(runtime)
                                                        │   ├─ Store in runtimeRecords
                                                        │   └─ scheduleRuntimeDisposal()
                                                        │
                                                        ├─ applyPlanMode
                                                        │   ├─ If mode="plan": restrict tools
                                                        │   └─ Restore plan state if resuming
                                                        │
                                                        └─ Return { runtime, sessionReset, diagnostics }
```

## Session Event Streaming Pipeline

```
runtime.session.prompt(message)
  │
  └─► Pi processes message:
      ├─ LLM call to Bedrock (streaming)
      ├─ Tool execution (read/write/edit/bash/etc)
      ├─ Tool result processing
      └─ Session event emission
           │
           └─► session.subscribe(onEvent)
               │
               ├─► Server receives AgentSessionEvent
               │   └─ Types: message_update, tool_execution_*, queue_update,
               │            compaction_*, auto_retry_*, agent_*, turn_*, etc
               │
               └─► Server: handleSessionEvent(event)
                   │
                   ├─ text_delta        ──► ChatStreamEvent { type: "delta" }
                   ├─ thinking_delta    ──► ChatStreamEvent { type: "thinking" }
                   ├─ tool_execution_*  ──► ChatStreamEvent { type: "tool", part }
                   ├─ queue_update      ──► ChatStreamEvent { type: "queue" }
                   ├─ compaction_*      ──► ChatStreamEvent { type: "compaction" }
                   ├─ auto_retry_*      ──► ChatStreamEvent { type: "retry" }
                   └─ state events      ──► ChatStreamEvent { type: "state" }
                       │
                       └─► encodeEvent(event)
                           ├─ JSON.stringify(event)
                           ├─ Append newline
                           └─ TextEncoder.encode()
                               │
                               └─► controller.enqueue(bytes)
                                   └─ Stream to browser
```

## Complete Message Lifecycle (Example: "Find Python files")

```
1. USER INPUT
   ┌─────────────────────────────────────┐
   │ User types "Find Python files"      │
   │ Selects model: claude-sonnet-4-6    │
   │ Mode: agent                         │
   └─────────────────────────────────────┘
                   │
                   ▼
2. BROWSER SENDS
   ┌─────────────────────────────────────┐
   │ POST /api/chat                      │
   │ {                                   │
   │   message: "Find Python files",     │
   │   model: { provider, id, ...},      │
   │   mode: "agent",                    │
   │   sessionId: "sess-123"             │
   │ }                                   │
   └─────────────────────────────────────┘
                   │
                   ▼
3. SERVER CREATES RUNTIME
   ┌─────────────────────────────────────┐
   │ Check runtimeRecords cache          │
   │ Find running: sess-123 (cache hit)  │
   │ Reuse + applyModelSelection         │
   └─────────────────────────────────────┘
                   │
                   ▼
4. PI PROCESSES MESSAGE
   ┌─────────────────────────────────────┐
   │ session.prompt("Find Python files") │
   │ ├─ LLM streaming: "I'll search..."  │
   │ ├─ Tool call: bash -c 'find ...'   │
   │ ├─ Tool exec + output               │
   │ └─ Final response                   │
   └─────────────────────────────────────┘
                   │
                   ▼
5. SERVER EMITS NDJSON STREAM
   ┌─────────────────────────────────────┐
   │ {"type":"start","id":"msg-1",...}   │
   │ {"type":"delta","text":"I'll..."}   │
   │ {"type":"tool","part":{type:"bash"}}│
   │ {"type":"tool","part":{...,status}} │
   │ {"type":"delta","text":" Found..."}│
   │ {"type":"done"}                     │
   └─────────────────────────────────────┘
                   │
                   ▼
6. BROWSER PARSES STREAM
   ┌─────────────────────────────────────┐
   │ readChatStream                      │
   │ ├─ Parse line 1: {type:start}       │
   │ │   └─ applyChatStreamEvent         │
   │ │       └─ Create message, store id │
   │ │                                   │
   │ ├─ Parse line 2: {type:delta}       │
   │ │   └─ appendAssistantDelta()       │
   │ │       └─ Add text to message      │
   │ │                                   │
   │ ├─ Parse line 3-4: {type:tool}      │
   │ │   └─ upsertAssistantToolPart()    │
   │ │       └─ Add tool card            │
   │ │                                   │
   │ ├─ Parse line 5: {type:delta}       │
   │ │   └─ Continue text                │
   │ │                                   │
   │ └─ Parse line 6: {type:done}        │
   │   └─ Stream complete               │
   └─────────────────────────────────────┘
                   │
                   ▼
7. UI UPDATES IN REAL-TIME
   ┌─────────────────────────────────────┐
   │ React re-renders after each event   │
   │ ├─ Message text appears streaming   │
   │ ├─ Tool card shows bash command     │
   │ ├─ Tool output appears as it runs   │
   │ └─ Final message complete           │
   └─────────────────────────────────────┘
                   │
                   ▼
8. CLEANUP & PERSISTENCE
   ┌─────────────────────────────────────┐
   │ retainPiRuntime()                   │
   │ ├─ Clear disposeTimer               │
   │ └─ Schedule new timeout (10 min)    │
   │                                     │
   │ persistSession()                    │
   │ └─ localStorage.setItem(             │
   │    "fleet-pi-chat-session",         │
   │    { sessionFile, sessionId }       │
   │ )                                   │
   └─────────────────────────────────────┘
```

## Plan Mode Decision Flow (if mode: "plan")

```
Plan extraction:
  ├─ Pi detects "Plan:" header in response
  ├─ Extract numbered steps: 1. ..., 2. ..., 3. ...
  └─ Create ChatStreamEvent { type: "plan", todos: [...] }
                   │
                   ▼
Browser shows plan with buttons:
  ├─ Execute   → Send planAction: "execute" → switch to agent mode
  ├─ Refine    → Send question answer (same mode)
  └─ Stay      → Send question answer (stay in plan mode)
                   │
                   ▼
User clicks Execute:
  ├─ POST /api/chat { mode: "agent", message: "Execute plan" }
  ├─ Server: mode changed to agent (full tools available)
  └─ Chat continues with tool execution
```

## Tool Allowlist Selection

```
Agent Mode (CHAT_TOOL_ALLOWLIST):
  ├─ read, bash, edit, write
  ├─ workspace_write, resource_install
  ├─ questionnaire, web_fetch
  ├─ project_inventory, workspace_index
  ├─ Autocontext: judge, improve, status, scenarios, etc
  ├─ Autoresearch: init, run, log, experiment
  └─ subagent

Plan Mode (PLAN_MODE_TOOLS):
  ├─ read (files only)
  ├─ bash (read-only commands, validated by command-policy)
  ├─ grep, find, ls (file browsing)
  ├─ questionnaire
  ├─ project_inventory, workspace_index (read-only)
  └─ Autocontext status tools (no mutations)

Enforcement:
  ├─ CHAT_TOOL_ALLOWLIST passed to Pi during runtime creation
  └─ If plan mode: plan-mode.ts extension hooks tool_call
      └─ Blocks non-allowed tools with reason
```

## Error Recovery Paths

```
Bedrock Error:
  ├─ Circuit breaker catches
  ├─ Emits ChatStreamEvent { type: "error", message }
  ├─ Diagnostics added to next ChatStartEvent
  └─ User can retry with different model

Invalid Session File:
  ├─ isUsableSessionFile() validates path
  ├─ Outside sessionDir? → Fresh session
  ├─ Doesn't exist? → Fresh session
  └─ Corrupted? → SessionManager.open() throws, fresh session

Connection Interrupted:
  ├─ reader.read() returns { done: true }
  ├─ If no "done" event: treat as error
  ├─ Browser shows error toast
  └─ User can retry (session file preserved)

Invalid NDJSON:
  ├─ JSON.parse() fails
  ├─ ChatStreamEventSchema validation fails
  ├─ Error logged + stream aborts
  └─ Browser treats as protocol error
```

## Performance Bottlenecks & Optimizations

```
Potential Bottlenecks:
  ├─ Bedrock API latency (first token ~1-2s typical)
  ├─ Tool execution (bash, read, write can be slow)
  ├─ Session JSONL growth (compaction mitigates)
  ├─ React re-render per event (~5-20ms)
  └─ Browser NDJSON parsing (~1-2ms per event)

Optimizations In Place:
  ├─ Runtime caching (10 min TTL per session)
  ├─ Session compaction (auto-triggered at token budget)
  ├─ Streaming events (not batch requests)
  ├─ Circuit breaker (avoid Bedrock cascading failures)
  ├─ Plan mode question batching (single turn)
  └─ Resource caching (per session)
```
