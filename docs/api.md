# Fleet Pi API Reference

Generated from `openapi.json`.

**Base URL:** `http://localhost:3000`

---

## POST /api/chat

Send a chat message and receive a streaming response

### Request Body

```json
{
  "sessionFile": <string>
  "sessionId": <string>
  "message": <string> — User message
  "model": — Selected model
  "mode": <string> — Chat mode
  "planAction": <string> — Plan action
  "streamingBehavior": <string> — Streaming behavior
}
```

### Responses

- **200** — NDJSON stream of chat events
  One of:
  ```json
  {
    "type": <string> (required)
    "id": <string> (required)
    "sessionFile": <string>
    "sessionId": <string> (required)
    "sessionReset": <boolean>
    "diagnostics": <array>
  }
  ```
  ```json
  {
    "type": <string> (required)
    "text": <string> (required)
    "messageId": <string>
  }
  ```
  ```json
  {
    "type": <string> (required)
    "part": <object> (required) — Tool message part
    "messageId": <string>
  }
  ```
  ```json
  {
    "type": <string> (required)
    "mode": <string> (required) — Chat mode
    "executing": <boolean> (required)
    "completed": <number> (required)
    "total": <number> (required)
    "message": <string>
  }
  ```
  ```json
  {
    "type": <string> (required)
    "state": <object> (required) — Chat state event
  }
  ```
  ```json
  {
    "type": <string> (required)
    "steering": <array> (required)
    "followUp": <array> (required)
  }
  ```
  ```json
  {
    "type": <string> (required)
    "text": <string> (required)
    "messageId": <string>
  }
  ```
  ```json
  {
    "type": <string> (required)
    "phase": <string> (required)
    "reason": <string> (required)
  }
  ```
  ```json
  {
    "type": <string> (required)
    "phase": <string> (required)
    "reason": <string> (required)
    "aborted": <boolean> (required)
    "willRetry": <boolean> (required)
    "errorMessage": <string>
  }
  ```
  ```json
  {
    "type": <string> (required)
    "phase": <string> (required)
    "attempt": <number> (required)
    "maxAttempts": <number> (required)
    "delayMs": <number> (required)
    "errorMessage": <string> (required)
  }
  ```
  ```json
  {
    "type": <string> (required)
    "phase": <string> (required)
    "success": <boolean> (required)
    "attempt": <number> (required)
    "finalError": <string>
  }
  ```
  ```json
  {
    "type": <string> (required)
    "message": <object> (required) — Chat message
    "sessionFile": <string>
    "sessionId": <string> (required)
    "sessionReset": <boolean>
  }
  ```
  ```json
  {
    "type": <string> (required)
    "message": <string> (required)
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
    "models": <array> (required)
    "selectedModelKey": <string>
    "defaultProvider": <string>
    "defaultModel": <string>
    "defaultThinkingLevel": <string> — Thinking level
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
    "packages": <array> (required)
    "skills": <array> (required)
    "prompts": <array> (required)
    "extensions": <array> (required)
    "themes": <array> (required)
    "agentsFiles": <array> (required)
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
    "session": <object> (required) — Chat session metadata
    "messages": <array> (required)
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
    "sessionFile": <string> — Session file path
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
  "sessionFile": <string> — Session file path
  "sessionId": <string> — Session ID
}
```

### Responses

- **200** — Session data
  ```json
  {
    "session": <object> (required) — Chat session metadata
    "messages": <array> (required)
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
  "sessionFile": <string> — Session file path
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
  "sessionFile": <string>
  "sessionId": <string>
  "toolCallId": <string>
  "answer": <object> (required) — Question answer
}
```

### Responses

- **200** — Answer processed
  ```json
  {
    "ok": <boolean> (required)
    "message": <string>
    "mode": <string> — Chat mode
    "planAction": <string> — Plan action
  }
  ```
- **400** — Bad request
  Type: `string`
- **404** — Not found
  ```json
  {
    "ok": <boolean> (required)
    "message": <string>
    "mode": <string> — Chat mode
    "planAction": <string> — Plan action
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
