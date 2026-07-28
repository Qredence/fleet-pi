Four independent utility modules under `apps/web/src/lib/` that are imported by other parts of the web app but have no internal dependencies on each other:

- `app-runtime.ts` resolves the project root from `FLEET_PI_REPO_ROOT` or `process.cwd()`, derives the workspace root via `AGENT_WORKSPACE_DIRECTORY`, and exposes an `AppRuntimeContext` shape plus a `RequestContextError` for HTTP status propagation.
- `env-manager.ts` provides synchronous-style async helpers (`updateEnvVar`, `updateEnvVars`, `removeEnvVars`) that atomically rewrite `.env.local` using a temp file + rename, mirror changes into `process.env`, and expose `isEnvVarConfigured` / `sanitizeProviderCredentialValue`.
- `logger.ts` exports a singleton `pino` logger configured with redaction paths for secrets; it switches between `pino-pretty` transport in development and raw JSON in production (Neon/Vercel detected via env vars).
- `query-client.ts` creates a single `@tanstack/react-query` `QueryClient` per server request and a singleton per browser page, with default stale/retry/refetch policies.

Dependency direction is one-way: these modules depend only on Node builtins, third-party packages (`pino`, `@tanstack/react-query`), and shared type contracts from sibling `workspace/` modules. They export pure functions or singletons — no class-based state management beyond `RequestContextError`.
