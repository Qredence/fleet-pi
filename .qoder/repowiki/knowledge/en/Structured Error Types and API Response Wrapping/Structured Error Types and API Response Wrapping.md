---
kind: error_handling
name: Structured Error Types and API Response Wrapping
category: error_handling
scope:
  - "**"
source_files:
  - apps/web/src/lib/app-runtime.ts
  - apps/web/src/lib/api-utils.ts
  - apps/web/src/lib/pi/server-shared.ts
  - apps/web/src/lib/pi/chat-fetch.ts
  - apps/web/src/lib/workspace/server.ts
  - apps/web/src/lib/db/user-providers.ts
  - apps/web/src/lib/pi/provenance-query.ts
  - apps/web/src/routes/api/workspace/file.ts
---

The Fleet Pi monorepo uses a layered error-handling approach centered on domain-specific `Error` subclasses, HTTP status-aware responses, and centralized response wrapping for TanStack Start API routes.

**Core error types**

- `RequestContextError` (`apps/web/src/lib/app-runtime.ts`) — base class carrying a numeric `status`, used to signal client/server errors with explicit HTTP codes. Subclassed by `ProvenanceQueryApiError` and `WorkspaceQueryApiError`.
- `WorkspaceFileError` (`apps/web/src/lib/workspace/server.ts`) — workspace file access errors (400/403/404/500) thrown during path validation, symlink resolution, and file I/O.
- `ChatPostgresUnavailableError` (`apps/web/src/lib/db/user-providers.ts`) — configuration error when the chat database is missing on Vercel.
- `ChatRequestError` (`apps/web/src/lib/pi/chat-fetch.ts`) — client-side fetch errors carrying `status`, raw `body`, and a formatted message extracted from JSON `{ message }` payloads.

**Response mapping utilities**

- `getResponseStatus(error)` in `app-runtime.ts` returns the error's `status` if it extends `RequestContextError`, otherwise `500`.
- `getErrorMessage(error)` in `lib/pi/server-shared.ts` safely extracts a string message from any thrown value.
- `wrapApiHandler()` in `lib/api-utils.ts` wraps async handlers to log failures via pino and return `Response.json({ message }, status)`.

**API route pattern**
Each TanStack Start route handler follows a consistent shape: call an authenticated wrapper (e.g. `withAuthenticatedChatRequest`), perform operations inside try/catch, catch domain errors like `WorkspaceFileError` to map their `.status` field, and fall back to `getResponseStatus(error)` for unknown errors. Example in `routes/api/workspace/file.ts` shows this pattern explicitly.

**Client-side error handling**

- `fetchJson` retries once on 401 (clearing cached bearer token), then throws `ChatRequestError` with parsed body or raw text.
- `isForbiddenSessionError()` checks for session ownership violations in error bodies.
- `parseWithSchema()` throws plain `Error` when Zod validation fails against expected contracts.

**Logging and redaction**

- Pino logger (`lib/logger.ts`) redacts sensitive fields (`password`, `token`, `apiKey`, `secret`, `authorization`) across all environments; pretty-printing disabled on Neon/Vercel serverless runtimes.
- `createRequestLogger(requestId)` creates child loggers per request.

**No global middleware or panic/recover**
There is no application-wide error middleware or `try/catch` root boundary; each route handler is responsible for its own error capture and response construction. Errors propagate as thrown `Error` instances rather than returning result objects.
