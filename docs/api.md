# Fleet Pi API Reference

Generated from `openapi.json`.

Start with [docs/README.md](README.md) and [docs/quickstart.md](quickstart.md) if you are new to the project. This file is generated reference material.

**Base URL:** `http://localhost:3000`

---

## POST /api/chat

Send a chat message and receive a streaming response

### Request Body

```json
{
  "sessionFile": <string>,
  "sessionId": <string>,
  "message": <string> — User message,
  "model": — Selected model,
  "mode": <string> — Chat mode,
  "planAction": <string> — Plan action,
  "streamingBehavior": <string> — Streaming behavior,
  "userId": <string> — Authenticated user ID (server-injected),
  "userEmail": <string> — Authenticated user email (server-injected)
}
```

### Responses

- **200** — NDJSON stream of chat events
  One of:
  ```json
  {
    "type": <string> (required),
    "id": <string> (required),
    "runId": <string> (required),
    "sessionFile": <string>,
    "sessionId": <string> (required),
    "sessionReset": <boolean>,
    "diagnostics": <array>
  }
  ```
  ```json
  {
    "type": <string> (required),
    "text": <string> (required),
    "messageId": <string>
  }
  ```
  ```json
  {
    "type": <string> (required),
    "part": <object> (required) — Tool message part,
    "messageId": <string>
  }
  ```
  ```json
  {
    "type": <string> (required),
    "mode": <string> (required) — Chat mode,
    "executing": <boolean> (required),
    "completed": <number> (required),
    "total": <number> (required),
    "message": <string>,
    "state": <object> (required) — Structured plan state
  }
  ```
  ```json
  {
    "type": <string> (required),
    "state": <object> (required) — Chat state event
  }
  ```
  ```json
  {
    "type": <string> (required),
    "steering": <array> (required),
    "followUp": <array> (required)
  }
  ```
  ```json
  {
    "type": <string> (required),
    "text": <string> (required),
    "messageId": <string>
  }
  ```
  ```json
  {
    "type": <string> (required),
    "phase": <string> (required),
    "reason": <string> (required)
  }
  ```
  ```json
  {
    "type": <string> (required),
    "phase": <string> (required),
    "reason": <string> (required),
    "aborted": <boolean> (required),
    "willRetry": <boolean> (required),
    "errorMessage": <string>
  }
  ```
  ```json
  {
    "type": <string> (required),
    "phase": <string> (required),
    "attempt": <number> (required),
    "maxAttempts": <number> (required),
    "delayMs": <number> (required),
    "errorMessage": <string> (required)
  }
  ```
  ```json
  {
    "type": <string> (required),
    "phase": <string> (required),
    "success": <boolean> (required),
    "attempt": <number> (required),
    "finalError": <string>
  }
  ```
  ```json
  {
    "type": <string> (required),
    "runId": <string> (required),
    "message": <object> (required) — Chat message,
    "sessionFile": <string>,
    "sessionId": <string> (required),
    "sessionReset": <boolean>
  }
  ```
  ```json
  {
    "type": <string> (required),
    "message": <string> (required),
    "runId": <string>
  }
  ```
- **400** — Bad request
  Type: `string`

---

## GET /api/chat/models

List available chat models

### Responses

- **200** — List of models
  ```json
  {
    "models": <array> (required),
    "selectedModelKey": <string>,
    "defaultProvider": <string>,
    "defaultModel": <string>,
    "defaultThinkingLevel": <string> — Thinking level,
    "diagnostics": <array> (required)
  }
  ```
- **500** — Server error
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## GET /api/chat/resources

List available chat resources (skills, prompts, extensions)

### Responses

- **200** — List of resources
  ```json
  {
    "packages": <array> (required),
    "skills": <array> (required),
    "prompts": <array> (required),
    "extensions": <array> (required),
    "themes": <array> (required),
    "agentsFiles": <array> (required),
    "diagnostics": <array> (required)
  }
  ```
- **500** — Server error
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## GET /api/chat/session

Hydrate a chat session by query parameters

### Parameters

| Name          | In    | Required | Description       |
| ------------- | ----- | -------- | ----------------- |
| `sessionFile` | query | No       | Session file path |
| `sessionId`   | query | No       | Session ID        |

### Responses

- **200** — Session data
  ```json
  {
    "session": <object> (required) — Chat session metadata,
    "messages": <array> (required),
    "sessionReset": <boolean>
  }
  ```
- **500** — Server error
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## DELETE /api/chat/session

Delete an owned Pi session mirror row and ephemeral JSONL

### Parameters

| Name          | In    | Required | Description       |
| ------------- | ----- | -------- | ----------------- |
| `sessionFile` | query | No       | Session file path |
| `sessionId`   | query | No       | Session ID        |

### Responses

- **200** — Session deleted
  ```json
  {
    "ok": <boolean> (required),
    "sessionId": <string>,
    "sessionFile": <string>
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```
- **403** — Forbidden: session belongs to another user
  ```json
  {
    "message": <string> (required)
  }
  ```
- **404** — Session not found or not owned
  ```json
  {
    "ok": <boolean> (required),
    "reason": <string> (required)
  }
  ```
- **500** — Delete failed
  ```json
  {
    "ok": <boolean> (required),
    "reason": <string> (required)
  }
  ```
- **501** — Session mirror is disabled
  ```json
  {
    "ok": <boolean> (required),
    "reason": <string> (required)
  }
  ```
- **503** — Session mirror is temporarily unavailable
  ```json
  {
    "ok": <boolean> (required),
    "reason": <string> (required)
  }
  ```

---

## DELETE /api/chat/account

Erase mirrored Pi sessions and BYOK provider credentials for the signed-in user

### Responses

- **200** — Mirrored Pi data erased
  ```json
  {
    "ok": <boolean> (required),
    "scope": <string> (required),
    "message": <string> (required),
    "erasedSessions": <number> (required),
    "erasedProviders": <number> (required)
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```
- **500** — Failed to erase mirrored Pi data
  ```json
  {
    "ok": <boolean> (required),
    "reason": <string> (required),
    "message": <string> (required)
  }
  ```

---

## GET /api/chat/sessions

List all chat sessions

### Responses

- **200** — List of sessions
  ```json
  {
    "sessions": <array> (required)
  }
  ```
- **500** — Server error
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## POST /api/chat/new

Create a new chat session

### Responses

- **200** — New session metadata
  ```json
  {
    "sessionFile": <string> — Session file path,
    "sessionId": <string> — Session ID
  }
  ```
- **500** — Server error
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## POST /api/chat/resume

Resume an existing chat session

### Request Body

```json
{
  "sessionFile": <string> — Session file path,
  "sessionId": <string> — Session ID
}
```

### Responses

- **200** — Session data
  ```json
  {
    "session": <object> (required) — Chat session metadata,
    "messages": <array> (required),
    "sessionReset": <boolean>
  }
  ```
- **500** — Server error
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## POST /api/chat/abort

Abort the active chat session

### Request Body

```json
{
  "sessionFile": <string> — Session file path,
  "sessionId": <string> — Session ID
}
```

### Responses

- **200** — Abort result
  ```json
  {
    "aborted": <boolean> (required)
  }
  ```
- **500** — Server error
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## POST /api/chat/question

Answer a question prompt from the assistant

### Request Body

```json
{
  "sessionFile": <string>,
  "sessionId": <string>,
  "toolCallId": <string>,
  "answer": <object> (required) — Question answer
}
```

### Responses

- **200** — Answer processed
  ```json
  {
    "ok": <boolean> (required),
    "message": <string>,
    "mode": <string> — Chat mode,
    "planAction": <string> — Plan action
  }
  ```
- **400** — Bad request
  Type: `string`
- **404** — Not found
  ```json
  {
    "ok": <boolean> (required),
    "message": <string>,
    "mode": <string> — Chat mode,
    "planAction": <string> — Plan action
  }
  ```

---

## GET /api/chat/settings

Load Pi project settings (overrides merged with Fleet base defaults)

### Responses

- **200** — Settings snapshot
  ```json
  {
    "diagnostics": <array> (required),
    "effective": <object> (required) — Editable Pi settings,
    "project": <object> (required) — Pi settings update,
    "projectPath": <string> (required),
    "updateImpact": <object> (required)
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## PATCH /api/chat/settings

Persist Pi project settings overrides and hot-reload active runtimes

### Request Body

```json
{
  "settings": <object> (required) — Pi settings update
}
```

### Responses

- **200** — Updated settings
  ```json
  {
    "diagnostics": <array> (required),
    "effective": <object> (required) — Editable Pi settings,
    "project": <object> (required) — Pi settings update,
    "projectPath": <string> (required),
    "updateImpact": <object> (required)
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## GET /api/chat/providers

List provider credential configuration status

### Responses

- **200** — Provider catalog
  ```json
  {
    "providers": <array> (required)
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## POST /api/chat/providers

Save encrypted BYOK provider credentials

### Request Body

```json
{
  "providerId": <string> (required),
  "apiKey": <string> (required),
  "baseUrl": <string>,
  "modelId": <string>
}
```

### Responses

- **200** — Provider saved
  ```json
  {
    "success": <boolean> (required),
    "providers": <array> (required),
    "reloadRequired": <boolean>
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## DELETE /api/chat/providers

Remove BYOK provider credentials

### Request Body

```json
{
  "providerId": <string> (required)
}
```

### Responses

- **200** — Provider removed
  ```json
  {
    "success": <boolean> (required),
    "providers": <array> (required),
    "reloadRequired": <boolean>
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## GET /api/chat/commands

List slash commands for the InputBar

### Responses

- **200** — Slash commands
  ```json
  {
    "commands": <array> (required),
    "diagnostics": <array> (required)
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## POST /api/chat/models/discover

Discover remote models from configured providers

### Request Body

```json
{
  "providerId": <string> (required)
}
```

### Responses

- **200** — Discovered models
  ```json
  {
    "providerId": <string> (required),
    "models": <array> (required)
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## GET /api/workspace/tree

List agent-workspace filesystem tree

### Responses

- **200** — Workspace tree
  ```json
  {
    "root": <string> (required),
    "nodes": <array> (required)
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## GET /api/chat/runs

List chat runs for a session

### Responses

- **200** — Run list
  ```json
  {
    "runs": <array> (required)
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## GET /api/chat/run

Fetch a single chat run

### Responses

- **200** — Run detail
  Type: `object`
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```
- **404** — Not found
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## GET /api/chat/provenance

File mutation provenance for workspace paths

### Responses

- **200** — Provenance records
  ```json
  {
    "records": <array> (required)
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## GET /api/workspace/file

Read a file inside agent-workspace

### Responses

- **200** — File preview
  ```json
  {
    "path": <string> (required),
    "content": <string> (required),
    "mimeType": <string>
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## GET /api/workspace/health

Workspace bootstrap health

### Responses

- **200** — Health status
  Type: `object`
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## GET /api/sandbox/preview

Preview URL for a Daytona sandbox port

### Responses

- **200** — Preview link
  ```json
  {
    "url": <string>
  }
  ```
- **401** — Unauthorized
  ```json
  {
    "message": <string> (required)
  }
  ```

---

## POST /api/webhooks/daytona

Daytona webhook receiver

### Responses

- **200** — Acknowledged
  ```json
  {
    "ok": <boolean> (required)
  }
  ```

---

## GET /api/health

Health check endpoint

### Responses

- **200** — Service is healthy
  ```json
  {
    "status": <string> (required)
  }
  ```

---
