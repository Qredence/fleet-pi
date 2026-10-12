import path from "node:path"
import dotenv from "dotenv"

/**
 * Apply the self-hosted (legacy) Better Auth schema to Postgres.
 *
 * Replaces `npx @better-auth/cli migrate`: that package is deprecated and could
 * not load our config (no default `auth` export). This uses Better Auth's
 * supported programmatic API (`better-auth/db/migration`) with the repo's own
 * pinned `better-auth` version and the same options the app runs with.
 */
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
  const migrationUrl = process.env.FLEET_PI_AUTH_MIGRATION_DATABASE_URL?.trim()
  if (!migrationUrl) {
    throw new Error(
      "FLEET_PI_AUTH_MIGRATION_DATABASE_URL must contain the owner connection string."
    )
  }

  // The auth module opens its database at import time from
  // FLEET_PI_AUTH_DATABASE_URL, so point it at the owner URL before importing.
  process.env.FLEET_PI_AUTH_DATABASE_URL = migrationUrl

  const { createLegacyBetterAuth } =
    await import("../src/lib/auth/legacy-better-auth-server")
  const { getMigrations } = await import("better-auth/db/migration")

  const auth = createLegacyBetterAuth()
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(
    auth.options
  )

  if (toBeCreated.length === 0 && toBeAdded.length === 0) {
    console.log("Better Auth schema is up to date")
    return
  }

  for (const table of toBeCreated) {
    console.log(`Creating table ${table.table}`)
  }
  for (const table of toBeAdded) {
    console.log(
      `Adding columns to ${table.table}: ${Object.keys(table.fields).join(", ")}`
    )
  }
  await runMigrations()
  console.log("Better Auth migrations applied")
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
