# Worker Postgres connection budget (CF-003)

How many Postgres connections the Cloudflare Worker (`fleet-pi-web`) opens
against Neon project `fleet-pi-pg18` (`still-dream-77849440`, PG18,
aws-us-east-2, autoscaling 0.5–4 CU), and why that is within limits.

## Mechanism

- Entry: `apps/web/src/server.ts` wraps every request in `runInRequestScope`
  (`apps/web/src/lib/runtime/request-scope.ts`). Workers forbid sharing sockets
  across requests, so pools are created **once per request**, lazily, only when
  code actually touches Postgres. Covered by
  `apps/web/src/lib/runtime/__tests__/request-scope.test.ts`.
- Driver: `@neondatabase/serverless` `Pool` over WebSocket (no `neon()` HTTP
  driver, no Hyperdrive).
- Chat pool: `getChatPostgresPool()` in
  `apps/web/src/lib/db/pi-session-ownership-db.ts` — `max: 5`,
  `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 5_000`.
- All chat queries go through `withUserContext()` (one `pool.connect()`, one
  transaction setting `app.current_user_id`, `release()` in `finally`). Callers
  run these sequentially, so a request normally holds **1** connection; `max: 5`
  is the hard per-request ceiling.
- Auth: production uses Neon Managed Auth (`auth-mode.ts` → `neon-managed`),
  which talks HTTP to Neon Auth — **0** Worker Postgres connections.
  `legacy-better-auth-server.ts` (per-request `Pool`, driver default max 10) is
  only used when Neon Managed Auth is not configured.

## Per-path fan-out

| Path                                                                                                                       | Opens Postgres?     | Pool              | Typical / max conns | Every chat turn?                    | On DB error                        |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------- | ------------------- | ----------------------------------- | ---------------------------------- |
| Session ownership check (`lookupSessionOwnershipStatus`, `chat-api-auth.ts`)                                               | yes                 | chat, per-request | 1 / 5               | yes                                 | fail-closed on hosted (trust-zone) |
| Pi session mirror (`syncPiSessionMirrorSafely`, `pi-session-mirror*.ts`, from `handle-chat-turn.ts`, `server-sessions.ts`) | yes, after the turn | same request pool | reuses 1            | yes                                 | fail-open (mirror optional)        |
| Sessions list / recovery / delete (`pi-session-postgres.ts`, `pi-session-recovery.ts`, `pi-session-deletion.ts`)           | yes                 | chat, per-request | 1 / 5               | no                                  | see module                         |
| Settings / user providers (`user-settings.ts`, `user-providers.ts`, `remove-provider-with-settings.ts`, `json-storage.ts`) | yes                 | chat, per-request | 1 / 5               | read on turn setup only when needed | error surfaced to settings UI      |
| Provenance (`provenance-sink.ts`, `run-provenance.ts`, `routes/api/chat/provenance.ts`)                                    | yes                 | chat, per-request | 1 / 5               | best-effort                         | fail-open                          |
| Auth (Neon Managed Auth)                                                                                                   | no (HTTP)           | —                 | 0                   | —                                   | —                                  |
| Hosted transcript (`UserPiDurable` Durable Object)                                                                         | no                  | —                 | 0                   | —                                   | —                                  |

**Per chat turn:** 1 Postgres connection (ceiling 5), opened from the
request-scoped pool and shared by the ownership check and the post-turn mirror.

## Budget

- Clients should use the pooled (`-pooler`) host. Neon PgBouncer accepts up to
  10,000 client connections; server-side pool is ~90% of the compute's
  `max_connections` (Neon docs: ~225 at 0.5 CU, ~1,800 at 4 CU).
- Worst case is `5 × concurrent in-flight Worker requests that touch Postgres`.
  At realistic Fleet Pi traffic (tens of concurrent turns) this is well under
  100 client connections and far under the 10,000 pooler cap.

**Conclusion:** within budget. No Hyperdrive or wrangler binding changes needed.

## Known risks / follow-ups

- Request pools are not explicitly `end()`-ed; they are released when the Worker
  request's I/O context ends (and by `idleTimeoutMillis`). Ending them via
  `ctx.waitUntil` would need to wait for streamed chat responses to finish;
  revisit if Neon shows lingering connections.
- Verify the production `FLEET_PI_CHAT_DATABASE_URL` secret points at the
  `-pooler` host (do not print it).
- The legacy Neon Function has its own module-scoped pool (NEON-013).
