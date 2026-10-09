import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "@neondatabase/serverless"
import { AUTH_POSTGRES_POST_MIGRATE_SQL } from "../src/lib/db/auth-postgres-post-migrate"

const cwd = process.cwd()
const preservedMigrationDatabaseUrl =
  process.env.FLEET_PI_AUTH_MIGRATION_DATABASE_URL
dotenv.config({ path: path.resolve(cwd, ".env") })
dotenv.config({ path: path.resolve(cwd, ".env.local"), override: true })
dotenv.config({ path: path.resolve(cwd, "../..", ".env") })
dotenv.config({
  path: path.resolve(cwd, "../..", ".env.local"),
  override: true,
})
if (preservedMigrationDatabaseUrl) {
  process.env.FLEET_PI_AUTH_MIGRATION_DATABASE_URL =
    preservedMigrationDatabaseUrl
}

async function main() {
  const connectionString = process.env.FLEET_PI_AUTH_MIGRATION_DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "FLEET_PI_AUTH_MIGRATION_DATABASE_URL must contain the owner connection string."
    )
  }

  const pool = new Pool({ connectionString })
  try {
    const role = await pool.query(
      "SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app'"
    )
    if (role.rowCount === 0) {
      console.warn(
        "Warning: role fleet_pi_app does not exist on this database. Skipping its auth table policies and grants; RLS is still enabled. Create the role (see docs/runbooks.md) and re-run auth:migrate before using a fleet_pi_app connection string."
      )
    }
    await pool.query(AUTH_POSTGRES_POST_MIGRATE_SQL)
    console.log("Applied Better Auth post-migration step (RLS, policies, grants)")
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
