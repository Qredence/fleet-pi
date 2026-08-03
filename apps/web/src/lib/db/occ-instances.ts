import {
  CUSTOM_PROVIDER_ID_PREFIX,
  OCC_INSTANCE_ID_PREFIX,
  isCustomProviderId,
  isNamedOccInstanceId,
  toCustomProviderId,
  toInstanceSlug,
  toOccInstanceId,
} from "@workspace/pi-protocol/provider-catalog"
import { decryptString, encryptString } from "../auth/crypto"
import { withChatPostgresTransaction } from "./pi-session-mirror"
import type { PiCustomProviderApi } from "@workspace/pi-protocol/chat-protocol"
import type { PostgresQueryClient } from "./pi-session-mirror"

/**
 * A named OpenAI Chat Completions-compatible provider instance. The API key is
 * the only secret; the rest is non-secret metadata stored alongside it.
 */
export type OccInstance = {
  /** Storage key + Pi provider id (e.g. `openai-chat-completions+nebius`). */
  id: string
  /** User-facing label. */
  displayName: string
  baseUrl: string
  modelId: string
  /** Native Pi API family. Defaults to `openai-completions` for legacy rows. */
  api?: PiCustomProviderApi
  /** Model ids registered for the provider. Defaults to `[modelId]` for legacy rows. */
  modelIds?: Array<string>
}

export class ChatPostgresUnavailableError extends Error {
  constructor(
    message = "FLEET_PI_CHAT_DATABASE_URL is required for encrypted provider storage on Vercel."
  ) {
    super(message)
    this.name = "ChatPostgresUnavailableError"
  }
}

type OccInstanceMeta = {
  displayName: string
  baseUrl: string
  /** Legacy single-model payload. */
  modelId?: string
  api?: PiCustomProviderApi
  /** Generalized multi-model payload. */
  modelIds?: Array<string>
}

/** Row shape used when only instance metadata (not the secret key) is needed. */
type OccInstanceMetaRow = {
  provider_id: string
  encrypted_payload: string | null
}

/**
 * Determines whether the chat database connection is configured.
 *
 * @returns `true` if `FLEET_PI_CHAT_DATABASE_URL` contains a non-whitespace value, `false` otherwise.
 */
function isChatDatabaseConfigured() {
  return Boolean(process.env.FLEET_PI_CHAT_DATABASE_URL?.trim())
}

/**
 * Ensures the chat database is configured when running on Vercel.
 *
 * @throws `ChatPostgresUnavailableError` if running on Vercel without chat database configuration
 */
function requireChatDatabaseOnVercel() {
  if (process.env.VERCEL === "1" && !isChatDatabaseConfigured()) {
    throw new ChatPostgresUnavailableError()
  }
}

/**
 * Retrieves the secret used to encrypt user provider credentials.
 *
 * @returns The configured encryption secret
 * @throws Error if `BETTER_AUTH_SECRET` is not configured
 */
function requireEncryptionSecret() {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is missing, cannot encrypt user provider secrets"
    )
  }
  return process.env.BETTER_AUTH_SECRET
}

/**
 * Decrypts and validates serialized instance metadata.
 *
 * @param payload - The encrypted metadata payload, or `null` when unavailable
 * @param secret - The secret used to decrypt the payload
 * @returns The validated instance metadata, or `null` when the payload is missing, invalid, or cannot be decrypted
 */
function parseInstanceMeta(
  payload: string | null,
  secret: string
): OccInstanceMeta | null {
  if (!payload) return null
  const decrypted = decryptString(payload, secret)
  if (!decrypted) return null
  try {
    const parsed = JSON.parse(decrypted) as Partial<OccInstanceMeta>
    if (
      typeof parsed.displayName === "string" &&
      typeof parsed.baseUrl === "string"
    ) {
      return {
        displayName: parsed.displayName,
        baseUrl: parsed.baseUrl,
        // Legacy single-model rows store `modelId`; new rows store `modelIds`.
        modelId: parsed.modelId,
        api: parsed.api,
        modelIds: parsed.modelIds,
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Executes a read operation against the chat database when configured for a user.
 *
 * @param userId - The user whose stored instances are being read
 * @param operation - The database operation to execute
 * @param fallback - The value returned when the user or chat database is unavailable
 * @returns The operation result, or `fallback` when the read cannot be performed
 */
async function withOccInstancesRead<T>(
  userId: string | undefined,
  operation: (client: PostgresQueryClient) => Promise<T>,
  fallback: T
): Promise<T> {
  if (!userId || !isChatDatabaseConfigured()) return fallback
  let result = fallback
  await withChatPostgresTransaction(async (client) => {
    result = await operation(client)
  }, userId)
  return result
}

function rowToInstance(
  row: OccInstanceMetaRow,
  secret: string
): OccInstance | null {
  const meta = parseInstanceMeta(row.encrypted_payload, secret)
  if (!meta) return null
  const modelIds =
    meta.modelIds && meta.modelIds.length > 0
      ? meta.modelIds
      : meta.modelId
        ? [meta.modelId]
        : []
  // Rows with neither modelIds nor modelId are malformed; skip them like other
  // invalid metadata instead of surfacing a provider with an empty model id.
  const firstModelId = modelIds[0]
  if (!firstModelId) return null
  return {
    id: row.provider_id,
    displayName: meta.displayName,
    baseUrl: meta.baseUrl,
    modelId: firstModelId,
    api: meta.api ?? "openai-completions",
    modelIds,
  }
}

/**
 * Lists the named OCC instances configured for a user.
 *
 * @param userId - The user whose instances should be listed, or `undefined` when no user is authenticated
 * @returns The user's configured named OCC instances, or an empty array when no user or chat database is available
 */
export async function listOccInstances(
  userId: string | undefined
): Promise<Array<OccInstance>> {
  if (!userId || !isChatDatabaseConfigured()) return []
  const secret = requireEncryptionSecret()
  return withOccInstancesRead(
    userId,
    async (client) => {
      const res = await client.query<OccInstanceMetaRow>(
        `SELECT provider_id, encrypted_payload
         FROM pi_user_providers
         WHERE user_id = $1 AND auth_type = 'apiKey'
         AND (provider_id LIKE $2 OR provider_id LIKE $3)`,
        [userId, `${OCC_INSTANCE_ID_PREFIX}%`, `${CUSTOM_PROVIDER_ID_PREFIX}%`]
      )
      // Canonical discriminator is the id prefix; JS filter is a re-check for
      // defense-in-depth, not a second source of truth.
      return res.rows
        .map((row) => rowToInstance(row, secret))
        .filter(
          (i): i is OccInstance =>
            i !== null &&
            (isNamedOccInstanceId(i.id) || isCustomProviderId(i.id))
        )
    },
    []
  )
}

export type OccInstanceWithApiKey = OccInstance & { apiKey: string }

/**
 * Instances together with their decrypted apiKey, in one query + one decrypt
 * pass. Used by the Settings providers list so it does not re-query per
 * instance (avoids an N+1 on every GET/mutation response).
 */
export async function listOccInstancesWithApiKey(
  userId: string | undefined
): Promise<Array<OccInstanceWithApiKey>> {
  if (!userId || !isChatDatabaseConfigured()) return []
  const secret = requireEncryptionSecret()
  return withOccInstancesRead(
    userId,
    async (client) => {
      const res = await client.query<{
        provider_id: string
        encrypted_key: string
        encrypted_payload: string | null
      }>(
        `SELECT provider_id, encrypted_key, encrypted_payload
         FROM pi_user_providers
         WHERE user_id = $1 AND auth_type = 'apiKey'
         AND (provider_id LIKE $2 OR provider_id LIKE $3)`,
        [userId, `${OCC_INSTANCE_ID_PREFIX}%`, `${CUSTOM_PROVIDER_ID_PREFIX}%`]
      )
      const rows: Array<OccInstanceWithApiKey> = []
      for (const row of res.rows) {
        const instance = rowToInstance(
          {
            provider_id: row.provider_id,
            encrypted_payload: row.encrypted_payload,
          },
          secret
        )
        if (!instance) continue
        const apiKey = decryptString(row.encrypted_key, secret)
        if (!apiKey) continue
        rows.push({ ...instance, apiKey })
      }
      return rows
    },
    []
  )
}

/**
 * Retrieves a named OCC instance for a user.
 *
 * @param userId - The user whose instance should be retrieved
 * @param instanceId - The provider ID of the instance
 * @returns The matching OCC instance, or `null` when the user, database configuration, or instance is unavailable
 */
export async function getOccInstanceById(
  userId: string | undefined,
  instanceId: string
): Promise<OccInstance | null> {
  if (!userId || !isChatDatabaseConfigured()) return null
  const secret = requireEncryptionSecret()
  return withOccInstancesRead(
    userId,
    async (client) => {
      const res = await client.query<OccInstanceMetaRow>(
        `SELECT provider_id, encrypted_payload
         FROM pi_user_providers
         WHERE user_id = $1 AND provider_id = $2`,
        [userId, instanceId]
      )
      return res.rows.length > 0 ? rowToInstance(res.rows[0], secret) : null
    },
    null
  )
}

/**
 * Allocates an available instance ID for a display name.
 *
 * @param userId - The user whose existing instance IDs are checked
 * @param displayName - The display name used to derive the instance ID
 * @param toId - A function that builds the provider id from a slug
 * @returns A unique instance ID, using a numeric suffix or timestamp suffix when needed
 */
async function allocateInstanceId(
  userId: string | undefined,
  displayName: string,
  toId: (slug: string) => string
): Promise<string> {
  const baseSlug = toInstanceSlug(displayName)
  const existing = new Set((await listOccInstances(userId)).map((i) => i.id))
  for (let attempt = 1; attempt <= 50; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`
    const id = toId(slug)
    if (!existing.has(id)) return id
  }
  return toId(`${baseSlug}-${Date.now().toString(36)}`)
}

/**
 * Allocates an available OCC instance ID for a display name.
 *
 * @param userId - The user whose existing instance IDs are checked
 * @param displayName - The display name used to derive the instance ID
 * @returns A unique instance ID, using a numeric suffix or timestamp suffix when needed
 */
export async function allocateOccInstanceId(
  userId: string | undefined,
  displayName: string
): Promise<string> {
  return allocateInstanceId(userId, displayName, toOccInstanceId)
}

/**
 * Allocates an available general custom provider ID for a display name.
 *
 * @param userId - The user whose existing instance IDs are checked
 * @param displayName - The display name used to derive the provider ID
 * @returns A unique provider ID, using a numeric suffix or timestamp suffix when needed
 */
export async function allocateCustomProviderId(
  userId: string | undefined,
  displayName: string
): Promise<string> {
  return allocateInstanceId(userId, displayName, toCustomProviderId)
}

/**
 * Stores or updates a named OCC instance and its API key for a user.
 *
 * @param userId - The user who owns the instance
 * @param instance - The instance metadata to store
 * @param apiKey - The API key used to authenticate with the instance
 */
export async function upsertOccInstance(
  userId: string,
  instance: OccInstance,
  apiKey: string
) {
  const secret = requireEncryptionSecret()
  requireChatDatabaseOnVercel()
  const meta: OccInstanceMeta = {
    displayName: instance.displayName,
    baseUrl: instance.baseUrl,
    api: instance.api ?? "openai-completions",
    modelIds: instance.modelIds?.length
      ? instance.modelIds
      : [instance.modelId],
  }
  await withChatPostgresTransaction(async (client) => {
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
      VALUES ($1, $2, $3, 'apiKey', $4, now())
      ON CONFLICT (user_id, provider_id)
      DO UPDATE SET
        encrypted_key = EXCLUDED.encrypted_key,
        auth_type = 'apiKey',
        encrypted_payload = EXCLUDED.encrypted_payload,
        updated_at = EXCLUDED.updated_at
      `,
      // Instance meta (name/base URL/model) is encrypted too — it is stored in
      // the `encrypted_payload` column, whose contract is "ciphertext when set"
      // (matches the oauth path). Only the apiKey belongs in `encrypted_key`.
      [
        userId,
        instance.id,
        encryptString(apiKey, secret),
        encryptString(JSON.stringify(meta), secret),
      ]
    )
  }, userId)
}

/**
 * Removes a named OCC instance for a user.
 *
 * @param userId - The user whose instance should be removed
 * @param instanceId - The identifier of the instance to remove
 */
export async function removeOccInstance(userId: string, instanceId: string) {
  requireChatDatabaseOnVercel()
  await withChatPostgresTransaction(async (client) => {
    await client.query(
      `DELETE FROM pi_user_providers WHERE user_id = $1 AND provider_id = $2`,
      [userId, instanceId]
    )
  }, userId)
}

/**
 * Loads the decrypted API key for a stored OCC instance.
 *
 * @param userId - The user who owns the instance
 * @param instanceId - The instance identifier
 * @returns The decrypted API key, or `undefined` when the user, database configuration, or stored key is unavailable
 */
export async function loadOccInstanceApiKey(
  userId: string | undefined,
  instanceId: string
): Promise<string | undefined> {
  if (!userId || !isChatDatabaseConfigured()) return undefined
  const secret = requireEncryptionSecret()
  return withOccInstancesRead(
    userId,
    async (client) => {
      const res = await client.query<{ encrypted_key: string }>(
        `SELECT encrypted_key FROM pi_user_providers
         WHERE user_id = $1 AND provider_id = $2`,
        [userId, instanceId]
      )
      if (res.rows.length === 0) return undefined
      return decryptString(res.rows[0].encrypted_key, secret) ?? undefined
    },
    undefined
  )
}
