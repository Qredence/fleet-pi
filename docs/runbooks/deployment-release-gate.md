# Deployment release gate

Operator and CI workflow for promoting Fleet Pi on Cloudflare Workers with
Neon-backed auth and Pi session mirroring.

## What the gate checks

`pnpm verify-deployment-readiness` validates:

- Required hosted env vars for Neon Managed Auth and chat mirroring
- Preview trust-zone markers (`FLEET_PI_DEPLOYMENT_TRUST_ZONE=preview`)
- Distinct preview/production database markers on Preview
- Optional owner-connection probes when migration URLs are set:
  - `FLEET_PI_AUTH_MIGRATION_DATABASE_URL`
  - `FLEET_PI_CHAT_MIGRATION_DATABASE_URL`

The web app also calls `assertDeploymentReadyOnBoot()` during Better Auth
initialization on hosted Workers so missing secrets fail before serving auth routes.

## CI

The `cloudflare-release-gate` job in `.github/workflows/ci.yml` runs:

1. `pnpm --filter web build:cloudflare`
2. `pnpm verify-deployment-readiness` for production-shaped env (`FLEET_PI_DEPLOYMENT=cloudflare`)
3. `pnpm verify-deployment-readiness` for preview-shaped env (marker must appear in chat database URLs)
4. Optional owner-connection probes when GitHub Actions secrets are configured:
   - `FLEET_PI_AUTH_MIGRATION_DATABASE_URL`
   - `FLEET_PI_CHAT_MIGRATION_DATABASE_URL`

When migration secrets are absent, CI still enforces env + preview URL/marker checks.
Operators must run the owner-connection probe locally before production promotion.
That probe includes the Data API privilege check (`authenticated` and `anonymous`
must not hold grants on `pi_*`). CI also fails when `neon.ts` sets `dataApi: true`
or the chat migrate runner imports `chat-postgres-data-api-auth`.

## Pre-promotion checklist

1. Apply auth grants: `pnpm auth:migrate`
2. Apply chat mirror migrations: `pnpm chat:migrate`
3. Run readiness with owner URLs:
   ```bash
   FLEET_PI_AUTH_MIGRATION_DATABASE_URL=... \
   FLEET_PI_CHAT_MIGRATION_DATABASE_URL=... \
   FLEET_PI_DEPLOYMENT=cloudflare \
   pnpm verify-deployment-readiness
   ```
4. Deploy Worker: `pnpm --filter web deploy:cloudflare`

## Neon projection and recovery

Hosted transcripts live on the Durable Object. The Neon `pi_*` projection is
fail-open and is not the chat stream. The Neon Function pool stays at most 5
connections when it still serves legacy JSONL sessions (limits below). `pnpm chat:maintain`
is retired (see below). Production `main` has a
daily snapshot schedule (see
[Production backups and recovery](./neon-backup-recovery.md)); record the
latest recovery point before a production promotion.

### Legacy Function Postgres pool (NEON-013)

**How many DB connections can the legacy Function use? At most 5 per
Function instance.**

The pool is created by `createChatPostgresPool()` in
`apps/web/src/lib/db/pi-session-ownership-db.ts` and used through
`getChatPostgresPool()` by the `pi_*` mirror modules. `functions/chat.ts`
(the Neon Function declared in `neon.ts`) reaches it through the chat runtime
router when it serves legacy JSONL sessions.

| Setting                   | Value                                           | Meaning                                             |
| ------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| `max`                     | `5`                                             | Hard cap on open connections per pool               |
| `idleTimeoutMillis`       | `30_000`                                        | Idle connections close after 30 s                   |
| `connectionTimeoutMillis` | `5_000`                                         | A query waiting for a free slot fails after 5 s     |
| Max lifetime              | none                                            | Connections live until idle timeout or process exit |
| Role                      | `fleet_pi_app` via `FLEET_PI_CHAT_DATABASE_URL` | Non-owner; RLS applies                              |

Scope and concurrency:

- **Neon Function / Node:** one module-scoped pool per process, so the cap is
  5 connections per Function instance. Requests beyond 5 concurrent queries
  queue, then fail after 5 s. Total connections = 5 x running instances.
- **Cloudflare Worker:** uses the same factory per request, not this
  module-scoped pool. See
  [worker-postgres-connections.md](./worker-postgres-connections.md) (CF-003)
  for the Worker budget.
- The in-process Pi runtime cap is `MAX_CONCURRENT_RUNTIMES = 50`
  (`apps/web/src/lib/pi/server-runtime.ts`); runtimes share the 5 slots.
- Neon's pooled endpoint (PgBouncer) accepts far more client connections than
  this, so the 5-connection cap is the binding limit, not Neon.

The pool stays: the Worker mirror, session ownership checks and recovery all
use it, not only the legacy path. Change the numbers in
`createChatPostgresPool()` and this table together.

### `chat:maintain` retired (NEON-011)

`pnpm chat:maintain` (`apps/web/scripts/maintain-chat-mirror.ts`) was removed
and is not scheduled. It ran `VACUUM FULL` + `REINDEX` on `pi_user_settings`
and `VACUUM ANALYZE` on four other `pi_*` tables. Nothing it did is still
needed:

- Migration `20260807_db_optimization_2` lowered
  `autovacuum_vacuum_threshold` / `autovacuum_analyze_threshold` to 10 on
  `pi_user_settings` and `pi_user_providers`, the only tables that never hit
  the default thresholds. Neon autovacuum now keeps them and the larger
  tables vacuumed and analyzed.
- The `pi_*` projection is optional and fail-open; hosted transcripts live on
  the Durable Object, so mirror bloat cannot affect chat turns.
- Retention stays with `pnpm chat:purge` (90-day TTL), which is unchanged.

If bloat comes back, check `pg_stat_user_tables` (`last_autovacuum`,
`n_dead_tup`) and tune reloptions in a `chat:migrate` migration before
reintroducing a scheduled job.

## Preview Workers (PR)

Label `cloudflare-preview` on a PR to deploy an isolated Worker Preview. CI
refuses upload when the Neon preview branch `fleet_pi_app` URL is missing or
matches production. See `.github/workflows/cloudflare.yml` and
`apps/web/scripts/cloudflare/assert-preview-worker-secrets.ts`.

- `.github/workflows/neon_workflow.yml` creates and deletes the Neon preview
  branch per PR. It needs the repo secrets `NEON_PROJECT_ID` and `NEON_API_KEY`.
- Previews deploy an allowlisted secret set. Feature-branch previews also need
  `BETTER_AUTH_SECRET` and `FLEET_PI_AUTH_DATABASE_URL` on that set, not only
  on production.
- Neon Managed Auth signup is open, so keep the deployment closed-beta until
  restricted signups exist.

## Related

- [Worker Postgres connection budget](./worker-postgres-connections.md)
