import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "@neondatabase/serverless"
import { runChatMigrations } from "../src/lib/db/chat-migrations"
import { resolveAppRole } from "../src/lib/db/app-role"

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
    const appRole = resolveAppRole()
    console.log(`Granting runtime privileges to role: ${appRole}`)
    await runChatMigrations(client, console.log, { appRole })
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
