import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "@neondatabase/serverless"
import {
  CHAT_POSTGRES_RLS_STRICT_MIGRATION_ID,
  CHAT_POSTGRES_RLS_STRICT_SQL,
} from "../src/lib/db/chat-postgres-rls-strict"
import {
  CHAT_POSTGRES_SESSION_OWNERSHIP_MIGRATION_ID,
  CHAT_POSTGRES_SESSION_OWNERSHIP_SQL,
} from "../src/lib/db/chat-postgres-session-ownership"
import {
  CHAT_POSTGRES_SESSION_TOMBSTONES_MIGRATION_ID,
  CHAT_POSTGRES_SESSION_TOMBSTONES_SQL,
} from "../src/lib/db/chat-postgres-session-tombstones"
import {
  CHAT_POSTGRES_PROVIDER_AUTH_MIGRATION_ID,
  CHAT_POSTGRES_PROVIDER_AUTH_SQL,
} from "../src/lib/db/chat-postgres-provider-auth"
import {
  CHAT_POSTGRES_MIGRATION_ID,
  CHAT_POSTGRES_SCHEMA_SQL,
} from "../src/lib/db/chat-postgres-schema"
import type { PoolClient } from "@neondatabase/serverless"

const cwd = process.cwd()
const preservedMigrationDatabaseUrl =
  process.env.FLEET_PI_CHAT_MIGRATION_DATABASE_URL
dotenv.config({ path: path.resolve(cwd, ".env") })
dotenv.config({ path: path.resolve(cwd, ".env.local"), override: true })
dotenv.config({ path: path.resolve(cwd, "../..", ".env") })
dotenv.config({
  path: path.resolve(cwd, "../..", ".env.local"),
  override: true,
})
if (preservedMigrationDatabaseUrl) {
  process.env.FLEET_PI_CHAT_MIGRATION_DATABASE_URL =
    preservedMigrationDatabaseUrl
}

async function isMigrationApplied(client: PoolClient, migrationId: string) {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM fleet_pi_chat_migrations WHERE id = $1",
    [migrationId]
  )
  return result.rows.length > 0
}

async function recordMigration(client: PoolClient, migrationId: string) {
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
  client: PoolClient,
  migrationId: string,
  sql: string
) {
  if (await isMigrationApplied(client, migrationId)) {
    console.log(`Skipping chat migration: ${migrationId}`)
    return
  }

  await client.query(sql)
  await recordMigration(client, migrationId)
  console.log(`Applied chat migration: ${migrationId}`)
}

async function main() {
  const connectionString = process.env.FLEET_PI_CHAT_MIGRATION_DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "FLEET_PI_CHAT_MIGRATION_DATABASE_URL must contain the owner connection string."
    )
  }

  const pool = new Pool({ connectionString })
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(CHAT_POSTGRES_SCHEMA_SQL)
    await recordMigration(client, CHAT_POSTGRES_MIGRATION_ID)
    console.log(`Applied chat migration: ${CHAT_POSTGRES_MIGRATION_ID}`)

    await applyMigrationIfNeeded(
      client,
      CHAT_POSTGRES_RLS_STRICT_MIGRATION_ID,
      CHAT_POSTGRES_RLS_STRICT_SQL
    )
    await applyMigrationIfNeeded(
      client,
      CHAT_POSTGRES_SESSION_OWNERSHIP_MIGRATION_ID,
      CHAT_POSTGRES_SESSION_OWNERSHIP_SQL
    )
    await applyMigrationIfNeeded(
      client,
      CHAT_POSTGRES_SESSION_TOMBSTONES_MIGRATION_ID,
      CHAT_POSTGRES_SESSION_TOMBSTONES_SQL
    )
    await applyMigrationIfNeeded(
      client,
      CHAT_POSTGRES_PROVIDER_AUTH_MIGRATION_ID,
      CHAT_POSTGRES_PROVIDER_AUTH_SQL
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
