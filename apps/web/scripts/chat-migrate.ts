import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "@neondatabase/serverless"
import {
  CHAT_POSTGRES_MIGRATION_ID,
  CHAT_POSTGRES_SCHEMA_SQL,
} from "../src/lib/db/chat-postgres-schema"

// Load environment variables from process.cwd() or parent directories
const cwd = process.cwd()
dotenv.config({ path: path.resolve(cwd, ".env") })
dotenv.config({ path: path.resolve(cwd, ".env.local"), override: true })
dotenv.config({ path: path.resolve(cwd, "../..", ".env") })
dotenv.config({
  path: path.resolve(cwd, "../..", ".env.local"),
  override: true,
})

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
    await client.query(
      `
        INSERT INTO fleet_pi_chat_migrations (id)
        VALUES ($1)
        ON CONFLICT (id) DO UPDATE SET applied_at = now()
      `,
      [CHAT_POSTGRES_MIGRATION_ID]
    )
    await client.query("COMMIT")
    console.log(`Applied chat migration: ${CHAT_POSTGRES_MIGRATION_ID}`)
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
