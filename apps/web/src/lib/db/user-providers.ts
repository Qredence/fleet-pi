import {
  
  withChatPostgresTransaction
} from "./pi-session-mirror"
import type {PostgresQueryClient} from "./pi-session-mirror";
import { decryptString } from "@/lib/auth/crypto"

export class ChatPostgresUnavailableError extends Error {
  constructor(
    message = "FLEET_PI_CHAT_DATABASE_URL is required for encrypted provider storage on Vercel."
  ) {
    super(message)
    this.name = "ChatPostgresUnavailableError"
  }
}

function isChatDatabaseConfigured() {
  return Boolean(process.env.FLEET_PI_CHAT_DATABASE_URL?.trim())
}

function requireChatDatabaseOnVercel() {
  if (process.env.VERCEL === "1" && !isChatDatabaseConfigured()) {
    throw new ChatPostgresUnavailableError()
  }
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
  if (!userId) return
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
      INSERT INTO pi_user_providers (user_id, provider_id, encrypted_key, updated_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (user_id, provider_id)
      DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key, updated_at = EXCLUDED.updated_at
    `,
      [userId, providerId, encryptedKey]
    )
  })
}

async function loadEncryptedUserProviders(
  userId: string,
  providerId?: string
): Promise<Map<string, string>> {
  const encrypted = new Map<string, string>()
  await withUserProvidersRead(userId, async (client) => {
    const res = providerId
      ? await client.query<{ provider_id: string; encrypted_key: string }>(
          "SELECT provider_id, encrypted_key FROM pi_user_providers WHERE user_id = $1 AND provider_id = $2",
          [userId, providerId]
        )
      : await client.query<{ provider_id: string; encrypted_key: string }>(
          "SELECT provider_id, encrypted_key FROM pi_user_providers WHERE user_id = $1",
          [userId]
        )
    for (const row of res.rows) {
      encrypted.set(row.provider_id, row.encrypted_key)
    }
  })
  return encrypted
}

export async function loadDecryptedUserProviderSecrets(
  userId: string | undefined,
  options?: {
    providerId?: string
    providerFilter?: (providerId: string) => boolean
  }
): Promise<Map<string, string>> {
  const secrets = new Map<string, string>()
  if (!userId || process.env.VERCEL !== "1") {
    return secrets
  }

  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is missing, cannot decrypt user provider keys"
    )
  }

  requireChatDatabaseOnVercel()
  const encrypted = await loadEncryptedUserProviders(
    userId,
    options?.providerId
  )
  for (const [providerId, encryptedKey] of encrypted) {
    if (options?.providerFilter && !options.providerFilter(providerId)) {
      continue
    }
    const decrypted = decryptString(
      encryptedKey,
      process.env.BETTER_AUTH_SECRET
    )
    if (decrypted) {
      secrets.set(providerId, decrypted)
    }
  }
  return secrets
}
