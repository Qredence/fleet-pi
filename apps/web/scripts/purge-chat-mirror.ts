import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "@neondatabase/serverless"

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

const TTL_DAYS = 90

/**
 * 90-day TTL purge for pi_run_events (the mirror's growth vector; ~1 MB/day at
 * current usage). Pi JSONL sessions remain the source of truth, so deleting
 * aged mirror rows is safe. Served by the pi_run_events(recorded_at) index
 * added in 20260807_db_optimization_2.
 *
 * RLS: pi_run_events is FORCE ROW LEVEL SECURITY with a per-user policy. The
 * owner connection usually bypasses RLS (rolbypassrls); when it does not, the
 * delete is wrapped in DISABLE/ENABLE RLS within one transaction so the
 * cross-user purge is not silently filtered by the policy.
 *
 * Usage:
 *   pnpm --filter web chat:purge -- --dry-run   # count only
 *   pnpm --filter web chat:purge                # delete
 * Requires FLEET_PI_CHAT_MIGRATION_DATABASE_URL (owner connection string).
 * Suggested schedule: nightly (cron/launchd), or Neon pg_cron when enabled.
 */
async function main() {
  const connectionString = process.env.FLEET_PI_CHAT_MIGRATION_DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "FLEET_PI_CHAT_MIGRATION_DATABASE_URL must contain the owner connection string."
    )
  }
  const dryRun = process.argv.includes("--dry-run")

  const pool = new Pool({ connectionString, max: 1 })
  const client = await pool.connect()
  try {
    const rls = await client.query<{ rolbypassrls: boolean }>(
      `SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`
    )
    const bypassesRls = rls.rows[0]?.rolbypassrls === true
    if (!bypassesRls) {
      console.warn(
        "Owner role does not bypass RLS; wrapping purge in DISABLE/ENABLE ROW LEVEL SECURITY."
      )
    }

    await client.query("BEGIN")
    if (!bypassesRls) {
      await client.query("ALTER TABLE pi_run_events DISABLE ROW LEVEL SECURITY")
    }
    const count = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM pi_run_events
       WHERE recorded_at < now() - make_interval(days => ${TTL_DAYS})`
    )
    const eligible = Number(count.rows[0]?.n ?? 0)
    console.log(`pi_run_events older than ${TTL_DAYS} days: ${eligible}`)

    if (dryRun) {
      console.log("Dry run: no rows deleted.")
    } else if (eligible > 0) {
      const deleted = await client.query(
        `DELETE FROM pi_run_events
         WHERE recorded_at < now() - make_interval(days => ${TTL_DAYS})`
      )
      console.log(`Deleted ${deleted.rowCount} aged pi_run_events rows.`)
    }

    // Re-enable RLS and commit only after the purge succeeded. On any failure
    // above, the transaction is aborted and the outer catch ROLLBACKs — which
    // also undoes the DISABLE (transactional DDL) — so the original error
    // surfaces instead of being masked by an aborted-transaction throw.
    if (!bypassesRls) {
      await client.query("ALTER TABLE pi_run_events ENABLE ROW LEVEL SECURITY")
      await client.query("ALTER TABLE pi_run_events FORCE ROW LEVEL SECURITY")
    }
    await client.query("COMMIT")
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {}
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
