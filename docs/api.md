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
  "streamingBehavior": <string> — Streaming behavior
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

## GET /api/chat/settings

Load effective and project-scoped Pi settings from `.pi/settings.json` via Pi `SettingsManager`.

### Responses

- **200** — Settings payload
  ```json
  {
    "diagnostics": <array> (required),
    "effective": <object> (required),
    "project": <object> (required),
    "projectPath": ".pi/settings.json",
    "updateImpact": {
      "newSessionRecommended": <boolean>,
      "resourceReloadRequired": <boolean>
    }
  }
  ```
- **500** — Server error

---

## PATCH /api/chat/settings

Update project Pi settings. Writes `.pi/settings.json`, then hot-reloads active in-memory runtimes.

### Request body

```json
{
  "settings": {
    "defaultProvider": "google",
    "defaultModel": "gemini-3.5-flash",
    "enabledModels": ["google/*"],
    "packages": [
      "npm:pi-web-access",
      { "source": "npm:pi-skill-palette", "skills": ["brave-search"] }
    ],
    "enableSkillCommands": true
  }
}
```

`packages` entries may be strings (`npm:...`) or objects with a `source` field plus optional Pi package filters.

### Responses

- **200** — Updated settings (same shape as GET)
- **400** — Invalid settings payload
- **500** — Server error

---

## GET /api/chat/providers

List configured provider credential status for the Configurations panel.

### Responses

- **200**
  ```json
  {
    "providers": [
      {
        "id": "google",
        "name": "Google Gemini",
        "envVarName": "GEMINI_API_KEY",
        "isConfigured": true
      }
    ]
  }
  ```
- **500** — Server error

---

## POST /api/chat/providers

Persist a provider API key locally (`.env.local`) or encrypted per-user BYOK on Vercel, then hot-reload active runtimes for that user.

### Request body

```json
{
  "providerId": "google",
  "apiKey": "..."
}
```

### Responses

- **200**
  ```json
  {
    "success": true,
    "providers": <array>,
    "reloadRequired": true
  }
  ```
- **400** — Unknown provider
- **401** — Unauthorized on Vercel without session
- **500** — Server error

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
