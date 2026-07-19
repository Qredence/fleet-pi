import { decryptString, encryptString } from "../auth/crypto"
import { withChatPostgresTransaction } from "./pi-session-mirror"
import type { PostgresQueryClient } from "./pi-session-mirror"

export type ProviderAuthType = "apiKey" | "oauth"

export class ChatPostgresUnavailableError extends Error {
  constructor(
    message = "FLEET_PI_CHAT_DATABASE_URL is required for encrypted provider storage on Vercel."
  ) {
    super(message)
    this.name = "ChatPostgresUnavailableError"
  }
}

type ProviderRow = {
  provider_id: string
  encrypted_key: string
  auth_type: ProviderAuthType
  encrypted_payload: string | null
}

function isChatDatabaseConfigured() {
  return Boolean(process.env.FLEET_PI_CHAT_DATABASE_URL?.trim())
}

function requireChatDatabaseOnVercel() {
  if (process.env.VERCEL === "1" && !isChatDatabaseConfigured()) {
    throw new ChatPostgresUnavailableError()
  }
}

function requireEncryptionSecret() {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is missing, cannot encrypt user provider secrets"
    )
  }
  return process.env.BETTER_AUTH_SECRET
}

async function withUserProvidersTransaction(
  userId: string,
  operation: (client: PostgresQueryClient) => Promise<void>
) {
  requireChatDatabaseOnVercel()
  await withChatPostgresTransaction(async (client) => {
    await operation(client)
  }, userId)
}

async function withUserProvidersRead(
  userId: string | undefined,
  operation: (client: PostgresQueryClient) => Promise<void>
) {
  if (!userId || !isChatDatabaseConfigured()) return
  await withChatPostgresTransaction(operation, userId)
}

export async function listConfiguredProviderIds(
  userId: string
): Promise<Set<string>> {
  const configured = new Set<string>()
  await withUserProvidersRead(userId, async (client) => {
    const res = await client.query<{ provider_id: string }>(
      "SELECT provider_id FROM pi_user_providers WHERE user_id = $1",
      [userId]
    )
    for (const row of res.rows) {
      configured.add(row.provider_id)
    }
  })
  return configured
}

export async function upsertUserProviderEncryptedKey(
  userId: string,
  providerId: string,
  encryptedKey: string
) {
  await withUserProvidersTransaction(userId, async (client) => {
    await client.query(
      `
      INSERT INTO pi_user_providers (
        user_id,
        provider_id,
        encrypted_key,
        auth_type,
        encrypted_payload,
        updated_at
      )
      VALUES ($1, $2, $3, 'apiKey', NULL, now())
      ON CONFLICT (user_id, provider_id)
      DO UPDATE SET
        encrypted_key = EXCLUDED.encrypted_key,
        auth_type = 'apiKey',
        encrypted_payload = NULL,
        updated_at = EXCLUDED.updated_at
    `,
      [userId, providerId, encryptedKey]
    )
  })
}

export async function storeUserProviderApiKey(
  userId: string,
  providerId: string,
  apiKey: string
) {
  const secret = requireEncryptionSecret()
  await upsertUserProviderEncryptedKey(
    userId,
    providerId,
    encryptString(apiKey, secret)
  )
}

async function loadEncryptedUserProviders(
  userId: string,
  providerId?: string
): Promise<Array<ProviderRow>> {
  const rows: Array<ProviderRow> = []
  await withUserProvidersRead(userId, async (client) => {
    const res = providerId
      ? await client.query<ProviderRow>(
          `SELECT provider_id, encrypted_key, auth_type, encrypted_payload
           FROM pi_user_providers
           WHERE user_id = $1 AND provider_id = $2`,
          [userId, providerId]
        )
      : await client.query<ProviderRow>(
          `SELECT provider_id, encrypted_key, auth_type, encrypted_payload
           FROM pi_user_providers
           WHERE user_id = $1`,
          [userId]
        )
    rows.push(...res.rows)
  })
  return rows
}

export async function loadDecryptedUserProviderSecrets(
  userId: string | undefined,
  options?: {
    providerId?: string
    providerFilter?: (providerId: string) => boolean
  }
): Promise<Map<string, string>> {
  const secrets = new Map<string, string>()
  if (!userId || !isChatDatabaseConfigured()) {
    return secrets
  }

  const secret = requireEncryptionSecret()
  const rows = await loadEncryptedUserProviders(userId, options?.providerId)
  for (const row of rows) {
    if (options?.providerFilter && !options.providerFilter(row.provider_id)) {
      continue
    }

    if (row.auth_type === "oauth") {
      if (!row.encrypted_payload) continue
      const decrypted = decryptString(row.encrypted_payload, secret)
      if (decrypted) secrets.set(row.provider_id, decrypted)
      continue
    }

    const decrypted = decryptString(row.encrypted_key, secret)
    if (decrypted) secrets.set(row.provider_id, decrypted)
  }
  return secrets
}
