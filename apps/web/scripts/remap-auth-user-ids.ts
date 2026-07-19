import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "@neondatabase/serverless"
import type { PoolClient } from "@neondatabase/serverless"

const cwd = process.cwd()
dotenv.config({ path: path.resolve(cwd, ".env") })
dotenv.config({ path: path.resolve(cwd, ".env.local"), override: true })
dotenv.config({ path: path.resolve(cwd, "../..", ".env") })
dotenv.config({
  path: path.resolve(cwd, "../..", ".env.local"),
  override: true,
})

type RemapRow = {
  email: string
  newUserId: string
}

function parseArgs(argv: Array<string>) {
  const dryRun = argv.includes("--dry-run")
  const fileArg = argv.find((arg) => arg.startsWith("--file="))
  const filePath = fileArg?.slice("--file=".length)
  return { dryRun, filePath }
}

function parseRemapFile(contents: string): Array<RemapRow> {
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const [email, newUserId] = line.split(",").map((part) => part.trim())
      if (!email || !newUserId) {
        throw new Error(`Invalid remap row: ${line}`)
      }
      return { email, newUserId }
    })
}

async function loadLegacyUserIds(
  pool: Pool,
  emails: Array<string>
): Promise<Map<string, string>> {
  if (emails.length === 0) {
    return new Map()
  }

  const result = await pool.query<{ id: string; email: string }>(
    `
      SELECT id, email
      FROM "user"
      WHERE lower(email) = ANY($1::text[])
    `,
    [emails.map((email) => email.toLowerCase())]
  )

  return new Map(
    result.rows.map((row) => [row.email.toLowerCase(), row.id] as const)
  )
}

async function remapUserId(
  client: PoolClient,
  oldUserId: string,
  newUserId: string
) {
  await client.query(
    `UPDATE pi_user_providers SET user_id = $2 WHERE user_id = $1`,
    [oldUserId, newUserId]
  )
  await client.query(
    `UPDATE pi_user_settings SET user_id = $2 WHERE user_id = $1`,
    [oldUserId, newUserId]
  )
  await client.query(`UPDATE pi_sessions SET user_id = $2 WHERE user_id = $1`, [
    oldUserId,
    newUserId,
  ])
  await client.query(
    `UPDATE pi_session_tombstones SET user_id = $2 WHERE user_id = $1`,
    [oldUserId, newUserId]
  )
  // pi_runs ownership is via session_id → pi_sessions; no user_id column.
}

async function main() {
  const { dryRun, filePath } = parseArgs(process.argv.slice(2))
  if (!filePath) {
    throw new Error(
      "Usage: pnpm remap-auth-user-ids -- --file=remap.csv [--dry-run]"
    )
  }

  const connectionString = process.env.FLEET_PI_CHAT_MIGRATION_DATABASE_URL
  if (!connectionString) {
    throw new Error("FLEET_PI_CHAT_MIGRATION_DATABASE_URL is required.")
  }

  const remapRows = parseRemapFile(
    await import("node:fs/promises").then((fs) => fs.readFile(filePath, "utf8"))
  )
  const pool = new Pool({ connectionString })
  const legacyIds = await loadLegacyUserIds(
    pool,
    remapRows.map((row) => row.email)
  )

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    for (const row of remapRows) {
      const oldUserId = legacyIds.get(row.email.toLowerCase())
      if (!oldUserId) {
        console.warn(`Skipping ${row.email}: legacy user not found`)
        continue
      }
      if (oldUserId === row.newUserId) {
        console.log(`No-op ${row.email}: user id already matches`)
        continue
      }

      console.log(
        `${dryRun ? "DRY-RUN" : "REMAP"} ${row.email}: ${oldUserId} -> ${row.newUserId}`
      )
      if (!dryRun) {
        await remapUserId(client, oldUserId, row.newUserId)
      }
    }

    if (dryRun) {
      await client.query("ROLLBACK")
    } else {
      await client.query("COMMIT")
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
