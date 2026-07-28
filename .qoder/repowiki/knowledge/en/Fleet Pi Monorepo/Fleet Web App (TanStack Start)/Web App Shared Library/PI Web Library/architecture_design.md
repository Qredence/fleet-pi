The `pi/` directory is organized as three cooperating layers that are re-exported through top-level entry points (`server.ts`, `runtime/index.ts`, `chat-client.ts`):

- `runtime/` holds the runtime core (session factory, settings merge/persist, model/resource/provider catalogs, hot-reload) and is the foundation both server-side and client-side depend on.
- `chat-runtime/handlers/` implements the HTTP endpoints (new, run, question, resume, abort, sessions) that consume the runtime core via a shared router with CORS and auth middleware.
- `shared_chat_utilities` (files at the `pi/` root like `server-runtime.ts`, `server-sessions.ts`, `server-shared.ts`, `chat-fetch.ts`, `use-pi-chat.ts`) provide the client-facing wrapper over those handlers plus server-side session lifecycle helpers.
  Cross-child wiring happens through the runtime core: chat handlers call into `session-factory.ts` to create sessions, settings flows go through `settings-bridge.ts` → `project-settings-*` modules, and provider discovery goes through `provider-catalog.ts`. Tests under `__tests__/` mirror each layer, while spec files at the root validate cross-cutting concerns (plan mode, command policy, URL security).
