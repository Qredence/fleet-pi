import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "@neondatabase/serverless"
import {
  CHAT_POSTGRES_MIGRATION_ID,
  CHAT_POSTGRES_SCHEMA_SQL,
} from "../src/lib/db/chat-postgres-schema"
import { CHAT_POSTGRES_RLS_STRICT_MIGRATION_ID } from "../src/lib/db/chat-postgres-rls-strict"
import { CHAT_POSTGRES_SESSION_OWNERSHIP_MIGRATION_ID } from "../src/lib/db/chat-postgres-session-ownership"
import { CHAT_POSTGRES_SESSION_TOMBSTONES_MIGRATION_ID } from "../src/lib/db/chat-postgres-session-tombstones"
import { CHAT_POSTGRES_PROVIDER_AUTH_MIGRATION_ID } from "../src/lib/db/chat-postgres-provider-auth"
import { validateDeploymentReadiness } from "../src/lib/deployment/readiness"
import { resolveDeploymentTrustZone } from "../src/lib/deployment/trust-zone"
import type { DeploymentReadinessInput } from "../src/lib/deployment/readiness"

const cwd = process.cwd()
dotenv.config({ path: path.resolve(cwd, ".env") })
dotenv.config({ path: path.resolve(cwd, ".env.local"), override: true })
dotenv.config({ path: path.resolve(cwd, "../..", ".env") })
dotenv.config({
  path: path.resolve(cwd, "../..", ".env.local"),
  override: true,
})

async function queryAuthDatabaseState(connectionString: string) {
  const pool = new Pool({ connectionString })
  try {
    const rls = await pool.query<{
      table_name: string
      rls_enabled: boolean
    }>(
      `
        SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
        FROM pg_class AS c
        JOIN pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname IN ('user', 'session', 'account', 'verification')
        ORDER BY c.relname
      `
    )

    const authTablesRlsDisabled = rls.rows.every((row) => !row.rls_enabled)

    return { authTablesRlsDisabled }
  } finally {
    await pool.end()
  }
}

async function runChatRlsSmokeTest(connectionString: string) {
  const pool = new Pool({ connectionString })
  const testUserId = "__fleet_pi_rls_smoke__"
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      testUserId,
    ])
    await client.query(
      `
        INSERT INTO pi_user_providers (user_id, provider_id, encrypted_key)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, provider_id) DO NOTHING
      `,
      [testUserId, "google", "rls-smoke-test"]
    )
    await client.query("ROLLBACK")
    return {
      ok: true as const,
      message:
        "Pooled RLS smoke insert into pi_user_providers succeeded (rolled back).",
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {
      // Ignore rollback failures after a failed smoke insert.
    }
    return {
      ok: false as const,
      message:
        error instanceof Error
          ? error.message
          : "Chat RLS smoke test failed unexpectedly.",
    }
  } finally {
    client.release()
    await pool.end()
  }
}

async function queryChatDatabaseState(connectionString: string) {
  const pool = new Pool({ connectionString })
  try {
    const migrations = await pool.query<{ id: string }>(
      "SELECT id FROM fleet_pi_chat_migrations ORDER BY applied_at"
    )

    const rls = await pool.query<{ rls_enabled: boolean }>(
      `
        SELECT c.relrowsecurity AS rls_enabled
        FROM pg_class AS c
        JOIN pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname = 'pi_sessions'
        LIMIT 1
      `
    )

    const probe = await pool.query<{ proname: string }>(
      `
        SELECT proname
        FROM pg_proc
        JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
        WHERE pg_namespace.nspname = 'public'
          AND proname = 'fleet_pi_check_session_owner'
        LIMIT 1
      `
    )

    return {
      chatMigrationsApplied: migrations.rows.map((row) => row.id),
      piSessionsRlsEnabled: rls.rows[0]?.rls_enabled === true,
      ownershipProbePresent: probe.rows.length > 0,
    }
  } finally {
    await pool.end()
  }
}

async function main() {
  const trustZone = resolveDeploymentTrustZone()
  const input: DeploymentReadinessInput = { trustZone }

  const authMigrationUrl = process.env.FLEET_PI_AUTH_MIGRATION_DATABASE_URL
  if (authMigrationUrl) {
    Object.assign(input, await queryAuthDatabaseState(authMigrationUrl))
  }

  const chatMigrationUrl = process.env.FLEET_PI_CHAT_MIGRATION_DATABASE_URL
  if (chatMigrationUrl) {
    Object.assign(input, await queryChatDatabaseState(chatMigrationUrl))
  }

  const chatRuntimeUrl = process.env.FLEET_PI_CHAT_DATABASE_URL?.trim()
  if (chatRuntimeUrl && trustZone !== "local") {
    const smoke = await runChatRlsSmokeTest(chatRuntimeUrl)
    const prefix = smoke.ok ? "OK" : "FAIL"
    console.log(`${prefix} chat-rls-smoke: ${smoke.message}`)
    if (!smoke.ok) {
      process.exitCode = 1
      return
    }
  }

  const result = validateDeploymentReadiness(input)

  for (const check of result.checks) {
    const prefix = check.ok ? "OK" : "FAIL"
    console.log(`${prefix} ${check.id}: ${check.message}`)
  }

  if (!result.ok) {
    process.exitCode = 1
    return
  }

  if (!chatMigrationUrl) {
    console.log(
      "WARN migration-db: Set FLEET_PI_CHAT_MIGRATION_DATABASE_URL to verify chat migrations in CI/deploy."
    )
  }

  if (!authMigrationUrl) {
    console.log(
      "WARN migration-db: Set FLEET_PI_AUTH_MIGRATION_DATABASE_URL to verify auth grants in CI/deploy."
    )
  }

  if (!CHAT_POSTGRES_SCHEMA_SQL.includes("fleet_pi_chat_migrations")) {
    throw new Error("Chat schema SQL is missing migration ledger table.")
  }

  const expectedMigrations = [
    CHAT_POSTGRES_MIGRATION_ID,
    CHAT_POSTGRES_RLS_STRICT_MIGRATION_ID,
    CHAT_POSTGRES_SESSION_OWNERSHIP_MIGRATION_ID,
    CHAT_POSTGRES_SESSION_TOMBSTONES_MIGRATION_ID,
    CHAT_POSTGRES_PROVIDER_AUTH_MIGRATION_ID,
  ]
  console.log(
    `INFO migrations: expected chat migration ids: ${expectedMigrations.join(", ")}`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
