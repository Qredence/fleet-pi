import {
  isNamedOccInstanceId,
  toOccInstanceId,
  toOccInstanceSlug,
} from "@workspace/pi-protocol/provider-catalog"
import { decryptString, encryptString } from "../auth/crypto"
import { withChatPostgresTransaction } from "./pi-session-mirror"
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
  modelId: string
}

/** Row shape used when only instance metadata (not the secret key) is needed. */
type OccInstanceMetaRow = {
  provider_id: string
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
      typeof parsed.baseUrl === "string" &&
      typeof parsed.modelId === "string"
    ) {
      return {
        displayName: parsed.displayName,
        baseUrl: parsed.baseUrl,
        modelId: parsed.modelId,
      }
    }
    return null
  } catch {
    return null
  }
}

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
  return { id: row.provider_id, ...meta }
}

/**
 * List configured OCC instances for a user (named instances with metadata).
 * The reserved default OCC slot (no payload meta) is excluded — it is managed
 * by the legacy OCC path / Neon AI Gateway, not the named-instance UI.
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
         WHERE user_id = $1 AND encrypted_payload IS NOT NULL
         AND auth_type = 'apiKey'`,
        [userId]
      )
      return res.rows
        .map((row) => rowToInstance(row, secret))
        .filter(
          (i): i is OccInstance => i !== null && isNamedOccInstanceId(i.id)
        )
    },
    []
  )
}

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
 * Resolve a unique instance id for a display name within the user's existing
 * instance ids. Collisions get a numeric suffix (e.g. `-2`).
 */
export async function allocateOccInstanceId(
  userId: string | undefined,
  displayName: string
): Promise<string> {
  const baseSlug = toOccInstanceSlug(displayName)
  const existing = new Set((await listOccInstances(userId)).map((i) => i.id))
  for (let attempt = 1; attempt <= 50; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`
    const id = toOccInstanceId(slug)
    if (!existing.has(id)) return id
  }
  return toOccInstanceId(`${baseSlug}-${Date.now().toString(36)}`)
}

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
    modelId: instance.modelId,
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

export async function removeOccInstance(userId: string, instanceId: string) {
  requireChatDatabaseOnVercel()
  await withChatPostgresTransaction(async (client) => {
    await client.query(
      `DELETE FROM pi_user_providers WHERE user_id = $1 AND provider_id = $2`,
      [userId, instanceId]
    )
  }, userId)
}

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
