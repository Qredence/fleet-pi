import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "@neondatabase/serverless"
import {
  assertNeonAuthUserIdMatch,
  parseRemapFile,
  resolveOldUserId,
} from "../src/lib/db/remap-auth-user-ids"
import type { PoolClient } from "@neondatabase/serverless"

const cwd = process.cwd()
dotenv.config({ path: path.resolve(cwd, ".env") })
dotenv.config({ path: path.resolve(cwd, ".env.local"), override: true })
dotenv.config({ path: path.resolve(cwd, "../..", ".env") })
dotenv.config({
  path: path.resolve(cwd, "../..", ".env.local"),
  override: true,
})

function parseArgs(argv: Array<string>) {
  const dryRun = argv.includes("--dry-run")
  const fileArg = argv.find((arg) => arg.startsWith("--file="))
  const filePath = fileArg?.slice("--file=".length)
  return { dryRun, filePath }
}

async function publicUserTableExists(pool: Pool): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user'
      ) AS exists
    `
  )
  return result.rows[0]?.exists === true
}

async function loadLegacyUserIds(
  pool: Pool,
  emails: Array<string>
): Promise<Map<string, string>> {
  if (emails.length === 0) {
    return new Map()
  }
  if (!(await publicUserTableExists(pool))) {
    return new Map()
  }

  const result = await pool.query<{ id: string; email: string }>(
    `
      SELECT id, email
      FROM public."user"
      WHERE lower(email) = ANY($1::text[])
    `,
    [emails.map((email) => email.toLowerCase())]
  )

  return new Map(
    result.rows.map((row) => [row.email.toLowerCase(), row.id] as const)
  )
}

async function loadNeonAuthUserIds(
  pool: Pool,
  emails: Array<string>
): Promise<Map<string, string>> {
  if (emails.length === 0) {
    return new Map()
  }

  const neonAuthExists = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'neon_auth' AND table_name = 'user'
      ) AS exists
    `
  )
  if (!neonAuthExists.rows[0]?.exists) {
    return new Map()
  }

  const result = await pool.query<{ id: string; email: string }>(
    `
      SELECT id, email
      FROM neon_auth."user"
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
  const emails = remapRows.map((row) => row.email)
  const legacyIds = await loadLegacyUserIds(pool, emails)
  const neonAuthIds = await loadNeonAuthUserIds(pool, emails)

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    for (const row of remapRows) {
      assertNeonAuthUserIdMatch(row.email, row.newUserId, neonAuthIds)
      const oldUserId = resolveOldUserId(row, legacyIds)
      if (!oldUserId) {
        console.warn(
          `Skipping ${row.email}: old user id not found (provide email,oldUserId,newUserId when public."user" is dropped)`
        )
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
