import { withChatPostgresTransaction } from "./pi-session-mirror"
import type { PostgresQueryClient } from "./pi-session-mirror"

function isChatDatabaseConfigured() {
  return Boolean(process.env.FLEET_PI_CHAT_DATABASE_URL?.trim())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isMissingRelationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "42P01"
  )
}

export async function loadUserProjectSettings(
  userId: string | undefined
): Promise<Record<string, unknown> | null> {
  if (!userId || !isChatDatabaseConfigured()) return null

  let settings: Record<string, unknown> | null = null
  try {
    await withChatPostgresTransaction(async (client: PostgresQueryClient) => {
      const result = await client.query<{ settings: unknown }>(
        "SELECT settings FROM pi_user_settings WHERE user_id = $1",
        [userId]
      )
      const settingsValue = result.rows[0]?.settings
      if (isRecord(settingsValue)) {
        settings = settingsValue
      }
    }, userId)
  } catch (error) {
    if (isMissingRelationError(error)) {
      return null
    }
    throw error
  }

  return settings
}

export async function upsertUserProjectSettings(
  userId: string,
  settings: Record<string, unknown>
) {
  if (!isChatDatabaseConfigured()) {
    throw new Error(
      "FLEET_PI_CHAT_DATABASE_URL is required to persist Pi settings on Vercel."
    )
  }

  await withChatPostgresTransaction(async (client) => {
    await client.query(
      `
      INSERT INTO pi_user_settings (user_id, settings, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = EXCLUDED.updated_at
    `,
      [userId, JSON.stringify(settings)]
    )
  }, userId)
}
