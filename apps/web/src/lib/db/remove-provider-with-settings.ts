import { withChatPostgresTransaction } from "./pi-session-mirror"
import type { PostgresQueryClient } from "./pi-session-mirror"

async function deleteUserProviderCredentialsWithClient(
  client: PostgresQueryClient,
  userId: string,
  providerIds: Array<string>
) {
  const ids = [...new Set(providerIds.filter(Boolean))]
  if (ids.length === 0) return

  await client.query(
    `
    DELETE FROM pi_user_providers
    WHERE user_id = $1
      AND provider_id = ANY($2::text[])
  `,
    [userId, ids]
  )
}

async function upsertUserProjectSettingsWithClient(
  client: PostgresQueryClient,
  userId: string,
  settings: Record<string, unknown>
) {
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
}

/**
 * Atomically remove provider credentials and optionally replace Pi settings
 * overrides for the same user (Vercel / Neon path).
 */
export async function removeProviderCredentialsAndSettings(
  userId: string,
  providerIds: Array<string>,
  settings: Record<string, unknown> | undefined
) {
  await withChatPostgresTransaction(async (client) => {
    await deleteUserProviderCredentialsWithClient(client, userId, providerIds)
    if (settings !== undefined) {
      await upsertUserProjectSettingsWithClient(client, userId, settings)
    }
  }, userId)
}
