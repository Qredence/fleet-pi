import {
  KNOWN_PROVIDERS,
  LLM_PROVIDER_ENV_SCRUB_IDS,
} from "@workspace/hax-design/lib/pi/provider-catalog"
import { isEnvVarConfigured } from "@/lib/env-manager"

export async function loadLlmProviderSecrets(
  userId: string | undefined
): Promise<Map<string, string>> {
  const secrets = new Map<string, string>()

  if (process.env.VERCEL === "1") {
    if (!userId) return secrets

    const { withChatPostgresTransaction } =
      await import("@/lib/db/pi-session-mirror")
    const { decryptString } = await import("@/lib/auth/crypto")

    if (!process.env.BETTER_AUTH_SECRET) {
      throw new Error(
        "BETTER_AUTH_SECRET is missing, cannot decrypt user LLM keys"
      )
    }

    await withChatPostgresTransaction(async (client: any) => {
      const res = await client.query(
        "SELECT provider_id, encrypted_key FROM pi_user_providers WHERE user_id = $1",
        [userId]
      )
      for (const row of res.rows) {
        if (!LLM_PROVIDER_ENV_SCRUB_IDS.includes(row.provider_id)) continue
        const decrypted = decryptString(
          row.encrypted_key,
          process.env.BETTER_AUTH_SECRET!
        )
        if (decrypted) {
          secrets.set(row.provider_id, decrypted)
        }
      }
    }, userId)

    return secrets
  }

  for (const providerId of LLM_PROVIDER_ENV_SCRUB_IDS) {
    const provider = KNOWN_PROVIDERS.find((entry) => entry.id === providerId)
    if (!provider) continue
    if (isEnvVarConfigured(provider.envVarName)) {
      secrets.set(providerId, process.env[provider.envVarName]!)
    }
  }

  return secrets
}

export async function resolveUserProviderSecret(
  userId: string | undefined,
  providerId: string
): Promise<string | undefined> {
  const provider = KNOWN_PROVIDERS.find((entry) => entry.id === providerId)
  if (!provider) return undefined

  if (
    LLM_PROVIDER_ENV_SCRUB_IDS.includes(
      providerId
    )
  ) {
    return (await loadLlmProviderSecrets(userId)).get(providerId)
  }

  if (process.env.VERCEL === "1") {
    if (!userId) return undefined

    const { withChatPostgresTransaction } =
      await import("@/lib/db/pi-session-mirror")
    const { decryptString } = await import("@/lib/auth/crypto")

    if (!process.env.BETTER_AUTH_SECRET) {
      throw new Error(
        "BETTER_AUTH_SECRET is missing, cannot decrypt user provider keys"
      )
    }

    let resolved: string | undefined
    await withChatPostgresTransaction(async (client: any) => {
      const res = await client.query(
        "SELECT encrypted_key FROM pi_user_providers WHERE user_id = $1 AND provider_id = $2",
        [userId, providerId]
      )
      const row = res.rows[0]
      if (!row?.encrypted_key) return

      const decrypted = decryptString(
        row.encrypted_key,
        process.env.BETTER_AUTH_SECRET!
      )
      if (decrypted) resolved = decrypted
    }, userId)
    return resolved
  }

  if (isEnvVarConfigured(provider.envVarName)) {
    return process.env[provider.envVarName]
  }

  return undefined
}

export async function resolveUserDaytonaApiKey(
  userId: string | undefined
): Promise<string | undefined> {
  return resolveUserProviderSecret(userId, "daytona")
}

export async function resolveDaytonaRuntimeApiKey(
  userId: string | undefined,
  override?: string
): Promise<string | undefined> {
  if (override) return override
  if (userId) {
    const fromUserStore = await resolveUserDaytonaApiKey(userId)
    if (fromUserStore) return fromUserStore
  }
  return process.env.DAYTONA_API_KEY
}
