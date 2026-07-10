import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "@neondatabase/serverless"

const cwd = process.cwd()
dotenv.config({ path: path.resolve(cwd, ".env") })
dotenv.config({ path: path.resolve(cwd, ".env.local"), override: true })
dotenv.config({ path: path.resolve(cwd, "../..", ".env") })
dotenv.config({
  path: path.resolve(cwd, "../..", ".env.local"),
  override: true,
})

type CliOptions = {
  dryRun: boolean
  purge: boolean
  quarantineTable: string
}

function parseArgs(argv: Array<string>): CliOptions {
  return {
    dryRun: argv.includes("--dry-run"),
    purge: argv.includes("--purge"),
    quarantineTable: "pi_sessions_quarantine",
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
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

    await client.query(
      `
        CREATE TABLE IF NOT EXISTS ${options.quarantineTable} (
          LIKE pi_sessions INCLUDING ALL
        )
      `
    )

    const orphans = await client.query<{
      id: string
      session_file_path: string
      updated_at: string
    }>(
      `
        SELECT id, session_file_path, updated_at
        FROM pi_sessions
        WHERE user_id IS NULL
        ORDER BY updated_at ASC
      `
    )

    console.log(`Found ${orphans.rows.length} ownerless mirrored sessions.`)

    if (orphans.rows.length === 0) {
      await client.query("COMMIT")
      return
    }

    if (options.dryRun) {
      for (const row of orphans.rows.slice(0, 10)) {
        console.log(`DRY-RUN quarantine ${row.id} (${row.session_file_path})`)
      }
      await client.query("ROLLBACK")
      return
    }

    await client.query(
      `
        INSERT INTO ${options.quarantineTable}
        SELECT *
        FROM pi_sessions
        WHERE user_id IS NULL
        ON CONFLICT (id) DO NOTHING
      `
    )

    if (options.purge) {
      await client.query("DELETE FROM pi_sessions WHERE user_id IS NULL")
      console.log(
        `Purged ${orphans.rows.length} ownerless sessions from production mirror.`
      )
    } else {
      console.log(
        `Quarantined ${orphans.rows.length} ownerless sessions into ${options.quarantineTable}. Ownerless rows remain live in pi_sessions until you re-run with --purge after operator approval (see ADR 0003).`
      )
    }

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
