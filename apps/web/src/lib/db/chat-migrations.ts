/**
 * Ordered chat-mirror migration runner used by `pnpm chat:migrate`.
 *
 * Runs inside the caller's transaction. The base schema is re-applied on every
 * run; numbered migrations are ledger-gated (fleet_pi_chat_migrations);
 * reconciliation steps at the end are not gated and must stay idempotent.
 */
import {
  CHAT_POSTGRES_RLS_INITPLAN_MIGRATION_ID,
  CHAT_POSTGRES_RLS_INITPLAN_SQL,
} from "./chat-postgres-rls-initplan"
import {
  CHAT_POSTGRES_RLS_STRICT_MIGRATION_ID,
  CHAT_POSTGRES_RLS_STRICT_SQL,
} from "./chat-postgres-rls-strict"
import {
  CHAT_POSTGRES_SESSION_OWNERSHIP_MIGRATION_ID,
  CHAT_POSTGRES_SESSION_OWNERSHIP_SQL,
} from "./chat-postgres-session-ownership"
import {
  CHAT_POSTGRES_SESSION_OWNER_FUNCTION_SQL,
  CHAT_POSTGRES_SESSION_TOMBSTONES_MIGRATION_ID,
  CHAT_POSTGRES_SESSION_TOMBSTONES_SQL,
} from "./chat-postgres-session-tombstones"
import {
  CHAT_POSTGRES_PROVIDER_AUTH_MIGRATION_ID,
  CHAT_POSTGRES_PROVIDER_AUTH_SQL,
} from "./chat-postgres-provider-auth"
import {
  CHAT_POSTGRES_USER_SETTINGS_MIGRATION_ID,
  CHAT_POSTGRES_USER_SETTINGS_SQL,
} from "./chat-postgres-user-settings"
import {
  CHAT_POSTGRES_DATA_API_REVOKE_MIGRATION_ID,
  CHAT_POSTGRES_DATA_API_REVOKE_SQL,
} from "./chat-postgres-data-api-revoke"
import {
  CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_MIGRATION_ID,
  CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_SQL,
} from "./chat-postgres-data-api-revoke-again"
import {
  CHAT_POSTGRES_FORCE_RLS_MIGRATION_ID,
  CHAT_POSTGRES_FORCE_RLS_SQL,
} from "./chat-postgres-force-rls"
import {
  CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_MIGRATION_ID,
  CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_SQL,
} from "./chat-postgres-ownership-execute-revoke"
import {
  CHAT_POSTGRES_DB_OPTIMIZATION_MIGRATION_ID,
  CHAT_POSTGRES_DB_OPTIMIZATION_SQL,
} from "./chat-postgres-db-optimization"
import {
  CHAT_POSTGRES_DROP_UNUSED_INDEXES_MIGRATION_ID,
  CHAT_POSTGRES_DROP_UNUSED_INDEXES_SQL,
} from "./chat-postgres-drop-unused-indexes"
import {
  MIRROR_WATERMARK_MIGRATION_ID,
  MIRROR_WATERMARK_MIGRATION_SQL,
} from "./chat-postgres-mirror-watermark"
import {
  CHAT_POSTGRES_OPTIMIZATION_2_MIGRATION_ID,
  CHAT_POSTGRES_OPTIMIZATION_2_SQL,
} from "./chat-postgres-optimization-2"
import {
  CHAT_POSTGRES_DROP_RECREATED_INDEXES_MIGRATION_ID,
  CHAT_POSTGRES_DROP_RECREATED_INDEXES_SQL,
} from "./chat-postgres-drop-recreated-indexes"
import {
  CHAT_POSTGRES_RETRY_EVENT_TYPE_FIX_MIGRATION_ID,
  CHAT_POSTGRES_RETRY_EVENT_TYPE_FIX_SQL,
} from "./chat-postgres-retry-event-type-fix"
import { CHAT_POSTGRES_APP_ROLE_GRANTS_SQL } from "./chat-postgres-app-role-grants"
import {
  CHAT_POSTGRES_MIGRATION_ID,
  CHAT_POSTGRES_SCHEMA_SQL,
} from "./chat-postgres-schema"

export interface ChatMigrationClient {
  query: <T = unknown>(
    text: string,
    params?: Array<unknown>
  ) => Promise<{ rows: Array<T> }>
}

async function isMigrationApplied(
  client: ChatMigrationClient,
  migrationId: string
) {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM fleet_pi_chat_migrations WHERE id = $1",
    [migrationId]
  )
  return result.rows.length > 0
}

async function recordMigration(
  client: ChatMigrationClient,
  migrationId: string
) {
  await client.query(
    `
      INSERT INTO fleet_pi_chat_migrations (id)
      VALUES ($1)
      ON CONFLICT (id) DO UPDATE SET applied_at = now()
    `,
    [migrationId]
  )
}

async function applyMigrationIfNeeded(
  client: ChatMigrationClient,
  migrationId: string,
  sql: string,
  log: (message: string) => void
) {
  if (await isMigrationApplied(client, migrationId)) {
    log(`Skipping chat migration: ${migrationId}`)
    return
  }

  await client.query(sql)
  await recordMigration(client, migrationId)
  log(`Applied chat migration: ${migrationId}`)
}

export async function runChatMigrations(
  client: ChatMigrationClient,
  log: (message: string) => void = console.log
) {
  await client.query(CHAT_POSTGRES_SCHEMA_SQL)
  await recordMigration(client, CHAT_POSTGRES_MIGRATION_ID)
  log(`Applied chat migration: ${CHAT_POSTGRES_MIGRATION_ID}`)

  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_RLS_STRICT_MIGRATION_ID,
    CHAT_POSTGRES_RLS_STRICT_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_SESSION_OWNERSHIP_MIGRATION_ID,
    CHAT_POSTGRES_SESSION_OWNERSHIP_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_SESSION_TOMBSTONES_MIGRATION_ID,
    CHAT_POSTGRES_SESSION_TOMBSTONES_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_PROVIDER_AUTH_MIGRATION_ID,
    CHAT_POSTGRES_PROVIDER_AUTH_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_USER_SETTINGS_MIGRATION_ID,
    CHAT_POSTGRES_USER_SETTINGS_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_DATA_API_REVOKE_MIGRATION_ID,
    CHAT_POSTGRES_DATA_API_REVOKE_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_MIGRATION_ID,
    CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_RLS_INITPLAN_MIGRATION_ID,
    CHAT_POSTGRES_RLS_INITPLAN_SQL,
    log
  )
  // Intentionally do not apply `chat-postgres-data-api-auth` grants:
  // closed-beta posture keeps Neon Data API disabled; use revoke_again + FORCE RLS.
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_MIGRATION_ID,
    CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_FORCE_RLS_MIGRATION_ID,
    CHAT_POSTGRES_FORCE_RLS_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_DB_OPTIMIZATION_MIGRATION_ID,
    CHAT_POSTGRES_DB_OPTIMIZATION_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_DROP_UNUSED_INDEXES_MIGRATION_ID,
    CHAT_POSTGRES_DROP_UNUSED_INDEXES_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    MIRROR_WATERMARK_MIGRATION_ID,
    MIRROR_WATERMARK_MIGRATION_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_OPTIMIZATION_2_MIGRATION_ID,
    CHAT_POSTGRES_OPTIMIZATION_2_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_DROP_RECREATED_INDEXES_MIGRATION_ID,
    CHAT_POSTGRES_DROP_RECREATED_INDEXES_SQL,
    log
  )
  await applyMigrationIfNeeded(
    client,
    CHAT_POSTGRES_RETRY_EVENT_TYPE_FIX_MIGRATION_ID,
    CHAT_POSTGRES_RETRY_EVENT_TYPE_FIX_SQL,
    log
  )

  // Not ledger-gated: the base schema above re-creates
  // fleet_pi_check_session_owner WITHOUT the tombstone check on every run
  // (the tombstones migration that adds it is ledger-skipped after its first
  // run), so re-assert the tombstone-aware definition after all migrations.
  await client.query(CHAT_POSTGRES_SESSION_OWNER_FUNCTION_SQL)
  log("Reconciled fleet_pi_check_session_owner (tombstone-aware)")

  // Not ledger-gated: re-assert fleet_pi_app grants every run so a role
  // created after the migrations were recorded still gets its privileges.
  await client.query(CHAT_POSTGRES_APP_ROLE_GRANTS_SQL)
  log("Reconciled fleet_pi_app grants")
}
