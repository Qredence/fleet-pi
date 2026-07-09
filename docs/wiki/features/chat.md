# Chat

Fleet Pi's chat feature is a streaming, session-persistent conversation with the Pi AI coding agent. It runs in the browser, talks to a single `/api/chat` endpoint, and keeps every Pi session alive long enough to accept follow-up messages and aborts.

## End-to-end flow

```mermaid
sequenceDiagram
    participant Browser
    participant /api/chat
    participant Pi (AgentSessionRuntime)

    Browser->>+/api/chat: POST { message, mode, sessionFile, sessionId, model }
    /api/chat->>+Pi (AgentSessionRuntime): resume or create session, stream run
    loop NDJSON stream
        Pi (AgentSessionRuntime)-->>Browser: start event (session metadata)
        Pi (AgentSessionRuntime)-->>Browser: state / thinking / delta / tool events
        Pi (AgentSessionRuntime)-->>Browser: done event (final message)
    end
    /api/chat-->>-Browser: stream ends
    Browser->>Browser: persist session metadata to localStorage
```

The browser sends a single JSON body. The server writes newline-delimited JSON (`Content-Type: application/x-ndjson`) until the turn is complete. Each line is one `ChatStreamEvent` object typed in `apps/web/src/lib/pi/chat-protocol.ts`.

### Event types

| Type         | When it arrives              | What the UI does                                                                   |
| ------------ | ---------------------------- | ---------------------------------------------------------------------------------- |
| `start`      | Immediately, before any text | Creates a new assistant message, stores `sessionFile`/`sessionId`                  |
| `delta`      | Each streamed text chunk     | Appends text to the current assistant message                                      |
| `thinking`   | Extended-thinking content    | Upserts a collapsible thinking part on the message                                 |
| `tool`       | Each tool call / result      | Upserts or updates a tool part (read, write, edit, bash, …)                        |
| `state`      | Agent state transitions      | Updates the activity label shown below the input bar                               |
| `plan`       | Plan mode writes a plan      | Updates the plan label                                                             |
| `queue`      | A follow-up is queued        | Updates the queue counters                                                         |
| `compaction` | Session being compacted      | Shows a transient "Compacting session" label                                       |
| `retry`      | Bedrock transient error      | Shows retry progress                                                               |
| `done`       | Turn finished                | Replaces the optimistic message with the final canonical message, clears the queue |
| `error`      | Unrecoverable failure        | Throws so the hook sets status to "error"                                          |

All event processing runs through `applyChatStreamEvent` in `apps/web/src/lib/pi/chat-stream-state.ts`, which is a pure function that takes the current transition state and returns the next one. The hook calls it on every incoming event.

## Session persistence

Pi's canonical session state is a JSONL file on the server filesystem. The browser only keeps a thin pointer.

### What is stored in localStorage

Two keys are written by `useChatStorage` (`apps/web/src/lib/pi/use-chat-storage.ts`):

- `fleet-pi-chat-sessions` — a JSON object keyed by session scope (`normal` | `harness`) where each value is `{ sessionFile, sessionId }`.
- `fleet-pi-chat-mode` — the last-used chat mode string (`agent`, `plan`, or `harness`).

Scopes keep the normal and harness sessions independent. If neither key has a value, localStorage is cleaned up entirely.

### Transcript hydration on refresh

When the page loads, `usePiChat` reads `initialSessionMetadata` from `useChatStorage` and calls `client.loadSession(storedSession)`. The server resolves the Pi JSONL file, extracts visible messages, and returns them as `ChatMessage[]`. The hook replaces the empty message list with this hydrated transcript without streaming.

If the stored `sessionFile` points outside the active project root or is otherwise invalid, the server rejects it and returns a fresh session. The hook surfaces this as an "activity label" notice rather than an error.

## Follow-up queuing

Sending a message while streaming does not abort the current turn. The hook checks `status === "streaming"` and takes a different path:

```
sendMessage() → status === "streaming"
    → queueFollowUp() → POST /api/chat with streamingBehavior: "followUp"
    → server queues message on the live AgentSessionRuntime
    → stream returns a "queue" event with updated counts
    → activity label shows "Follow-up queued"
```

When the in-flight turn finishes (the `done` event arrives), the server automatically processes the queued message and starts a new stream. The browser sees a new `start` event on the same connection.

## Abort flow

Pressing Stop calls `usePiChat.stop()`, which:

1. Calls `client.abortSession({ sessionFile, sessionId })` — this hits `/api/chat/abort` and tells the server to cancel the in-flight Pi run.
2. Aborts the local `AbortController` so the browser-side `fetch` stream is cut.
3. Sets `status` back to `"ready"` immediately.

The AbortController ref is held in `abortRef` and replaced on every new send, so concurrent aborts from old sends are ignored.

## Question / answer flow

Plan mode can ask the user a clarifying question mid-turn. Pi emits a `tool-Question` part which renders as a prompt bar above the input. The user types an answer (or picks from options) and the browser calls `/api/chat/question` with the answer.

The server delivers the answer to the waiting Pi runtime without starting a new turn. If the question was a plan decision (`plan_write` tool call), the hook also resolves the `pendingDecision` flag on the matching `tool-PlanWrite` part so the UI updates optimistically.

`resolvePlanDecisionMessages` and `enhancePlanDecisionMessages` in `apps/web/src/lib/pi/use-pi-chat.ts` handle injecting the `onExecute` / `onStay` / `onRefine` callbacks into the part after hydration.

## Memory recall

Before each turn, Fleet Pi builds a memory index from the canonical files under `agent-workspace/memory/project/` (architecture, decisions, preferences, open-questions, known-issues). The retained `workspace-context` message is then rewritten from the latest user prompt: all canonical bullet snippets are scored by prompt-term overlap, the highest-signal matches are placed first, and deterministic fallback snippets fill any remaining slots. This keeps context focused without flooding every turn with the full memory corpus.

## Key source files

| File                                       | Role                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `apps/web/src/lib/pi/use-pi-chat.ts`       | Main React hook — state, send, stop, hydration, question answering            |
| `apps/web/src/lib/pi/chat-stream-state.ts` | Pure event reducer: `applyChatStreamEvent`                                    |
| `apps/web/src/lib/pi/use-chat-storage.ts`  | localStorage read/write for session metadata and mode                         |
| `apps/web/src/lib/pi/chat-protocol.ts`     | Shared browser/server types for events, session metadata, modes               |
| `apps/web/src/lib/pi/chat-client.ts`       | Browser-side fetch wrapper around the `/api/chat` family                      |
| `apps/web/src/routes/api/chat.ts`          | Server-side API route: session resolution, Pi streaming, NDJSON writing       |
| `apps/web/src/lib/pi/server.ts`            | Server helpers: session validation, event normalisation, transcript hydration |
| `apps/web/src/routes/index.tsx`            | Top-level page that wires `usePiChat` into the `AgentChat` component          |

## Related pages

- [Chat API](../apps/web/chat-api.md)
- [Plan mode](../apps/web/plan-mode.md)
- [Agent-elements UI components](../packages/hax-design/agent-elements.md)
