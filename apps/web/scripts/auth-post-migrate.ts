import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "@neondatabase/serverless"
import { AUTH_POSTGRES_POST_MIGRATE_SQL } from "../src/lib/db/auth-postgres-post-migrate"

const cwd = process.cwd()
dotenv.config({ path: path.resolve(cwd, ".env") })
dotenv.config({ path: path.resolve(cwd, ".env.local"), override: true })
dotenv.config({ path: path.resolve(cwd, "../..", ".env") })
dotenv.config({
  path: path.resolve(cwd, "../..", ".env.local"),
  override: true,
})

async function main() {
  const connectionString = process.env.FLEET_PI_AUTH_MIGRATION_DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "FLEET_PI_AUTH_MIGRATION_DATABASE_URL must contain the owner connection string."
    )
  }

  const pool = new Pool({ connectionString })
  try {
    await pool.query(AUTH_POSTGRES_POST_MIGRATE_SQL)
    console.log("Applied Better Auth post-migration grants and disabled RLS")
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
