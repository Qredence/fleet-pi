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

/**
 * One-off / scheduled maintenance for the chat mirror tables.
 *
 * Compacts index bloat on tiny hot tables that never cross the autovacuum
 * default threshold (pi_user_settings: 512 kB index for 2 rows before the
 * 20260807_db_optimization_2 reloptions), and refreshes planner stats on the
 * mirror tables. VACUUM/REINDEX cannot run inside a transaction, so this runs
 * as standalone statements on the owner (direct) connection.
 *
 * Usage: pnpm --filter web chat:maintain
 * Requires FLEET_PI_CHAT_MIGRATION_DATABASE_URL (owner connection string).
 */
async function main() {
  const connectionString = process.env.FLEET_PI_CHAT_MIGRATION_DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "FLEET_PI_CHAT_MIGRATION_DATABASE_URL must contain the owner connection string."
    )
  }

  const pool = new Pool({ connectionString, max: 1 })
  const client = await pool.connect()
  try {
    const sizeBefore = await client.query<{ size: string }>(
      `SELECT pg_size_pretty(pg_total_relation_size('pi_user_settings')) AS size`
    )

    // Access-exclusive but instant on these tables (bytes of data).
    await client.query("VACUUM (FULL, ANALYZE) pi_user_settings")
    await client.query("REINDEX TABLE pi_user_settings")

    await client.query("VACUUM (ANALYZE) pi_user_providers")
    await client.query("VACUUM (ANALYZE) pi_run_events")
    await client.query("VACUUM (ANALYZE) pi_session_entries")
    await client.query("VACUUM (ANALYZE) pi_runs")

    const sizeAfter = await client.query<{ size: string }>(
      `SELECT pg_size_pretty(pg_total_relation_size('pi_user_settings')) AS size`
    )
    console.log(
      `pi_user_settings total: ${sizeBefore.rows[0]?.size} -> ${sizeAfter.rows[0]?.size}`
    )
    console.log("VACUUM/REINDEX/ANALYZE complete on chat mirror tables.")
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
