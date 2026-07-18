# API Overview

All Fleet Pi API routes are TanStack Start file routes defined under `apps/web/src/routes/api/`. Each file exports a `Route` created with `createFileRoute` and declares server handlers for the HTTP methods it supports.

## Route Groups

### Chat endpoints

Endpoints under `/api/chat` manage Pi AI sessions and streaming responses.

| Endpoint                   | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `POST /api/chat`           | Stream a Pi AI response (NDJSON)                |
| `POST /api/chat/new`       | Create a new Pi session                         |
| `POST /api/chat/resume`    | Resume an existing Pi session                   |
| `GET /api/chat/session`    | Fetch session metadata and hydrated messages    |
| `GET /api/chat/sessions`   | List all sessions                               |
| `POST /api/chat/abort`     | Abort an active streaming run                   |
| `POST /api/chat/question`  | Answer a plan-mode questionnaire prompt         |
| `GET /api/chat/models`     | List available Pi models                        |
| `GET /api/chat/resources`  | List Pi resources (skills, prompts, extensions) |
| `GET /api/chat/settings`   | Read Pi settings                                |
| `PATCH /api/chat/settings` | Update Pi settings                              |
| `GET /api/chat/run`        | Fetch a single run record                       |
| `GET /api/chat/runs`       | List run records for a session                  |
| `GET /api/chat/provenance` | Chat provenance metadata                        |

### Workspace endpoints

Endpoints under `/api/workspace` expose `agent-workspace/` as a read/write file layer.

| Endpoint                      | Purpose                             |
| ----------------------------- | ----------------------------------- |
| `GET /api/workspace/tree`     | Fetch the agent-workspace file tree |
| `GET /api/workspace/file`     | Read a file from agent-workspace    |
| `GET /api/workspace/item`     | Fetch a single workspace item       |
| `POST /api/workspace/item`    | Create or update a workspace item   |
| `GET /api/workspace/items`    | List workspace items                |
| `POST /api/workspace/reindex` | Trigger workspace reindex           |
| `GET /api/workspace/search`   | Search workspace contents           |
| `GET /api/workspace/health`   | Workspace health check              |

### Other endpoints

| Endpoint                     | Purpose                                |
| ---------------------------- | -------------------------------------- |
| `GET /api/health`            | Application health check               |
| `GET /api/sandbox/preview`   | Daytona sandbox preview URL proxy      |
| `POST /api/webhooks/daytona` | Daytona sandbox event webhook receiver |
| `ALL /api/auth/$`            | Better Auth wildcard handler           |

## Authentication

Most endpoints accept an optional Better Auth session cookie. When a valid session is present, the user's `id` and `email` are attached to chat requests. Unauthenticated access is allowed for the chat and workspace endpoints in the default configuration, so the app works without login. The `/api/sandbox/preview` endpoint requires authentication — it returns 401 when no session is present.

## Request and Response Formats

The primary chat endpoint (`POST /api/chat`) accepts a JSON body and returns newline-delimited JSON (`application/x-ndjson`). All other endpoints accept and return `application/json`.

Detailed type definitions are in [`packages/pi-protocol/src/chat-protocol.ts`](../../../packages/pi-protocol/src/chat-protocol.ts). See [endpoints.md](./endpoints.md) for per-endpoint documentation.
