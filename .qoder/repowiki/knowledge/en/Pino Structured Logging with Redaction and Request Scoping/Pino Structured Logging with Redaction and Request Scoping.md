---
kind: logging_system
name: Pino Structured Logging with Redaction and Request Scoping
category: logging_system
scope:
  - "**"
source_files:
  - apps/web/src/lib/logger.ts
  - apps/web/src/lib/logger.test.ts
  - apps/web/src/lib/api-utils.ts
---

The Fleet Pi web application uses a centralized, structured logging system built on **pino**, configured in `apps/web/src/lib/logger.ts`. The logger is the single source of truth for all server-side log output across the TanStack Start app.

**Framework and configuration**

- Logger instance is created via `pino({...})` with a default level of `info`, overridable through the `LOG_LEVEL` environment variable.
- Sensitive fields are automatically redacted using pino's built-in `redact` option. The redaction paths cover common secret patterns: `password`, `token`, `apiKey`, `secret`, `authorization`/`Authorization`, and their nested variants (`*.field`, `**.field`). All matched values are replaced with `[Redacted]`.
- In development (non-production, non-Vercel, non-Neon Functions), logs are piped through `pino-pretty` for human-readable console output with colorized timestamps. In production environments (Vercel or Neon Functions), pretty-printing is disabled to avoid bundling issues, producing raw JSON lines suitable for structured log collectors.

**Request-scoped child loggers**

- A `createRequestLogger(requestId)` helper creates pino child loggers bound with a `requestId` field, enabling per-request correlation across distributed log entries. This pattern is used consistently in chat runtime handlers (`post-chat`, `question`, `abort`) and storage modules (`session-blob-store`) to attach request context to every log line.

**Usage conventions across the codebase**

- Modules import the shared `logger` directly from `@/lib/logger` and call structured methods like `logger.info({ ...fields }, "message")`, `logger.warn({ error })`, and `logger.error({ failed })`.
- API handler errors are wrapped via `wrapApiHandler` in `api-utils.ts`, which catches exceptions and logs them through an optional injected `Logger` instance before returning a standardized JSON error response.
- Log levels follow standard pino semantics: `debug` for verbose tracing (e.g., session mirror sync internals), `info` for operational milestones, `warn` for recoverable issues (e.g., non-fatal sync failures), and `error` for failures that need attention (e.g., boot readiness checks).

**Testing and verification**

- `logger.test.ts` verifies both the exported logger interface and the redaction behavior across all sensitive field patterns, including nested objects and HTTP headers. It also asserts that `createRequestLogger` produces child loggers with the correct `requestId` binding.
