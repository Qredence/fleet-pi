import {
  INFRA_PROVIDER_IDS,
  KNOWN_PROVIDERS,
  LLM_PROVIDER_ENV_SCRUB_IDS,
} from "@workspace/pi-protocol/provider-catalog"
import { loadDecryptedUserProviderSecrets } from "@/lib/db/user-providers"
import { isEnvVarConfigured } from "@/lib/env-manager"

const INFRA_PROVIDER_ID_SET = new Set<string>(INFRA_PROVIDER_IDS)

function readEnvLlmProviderSecrets(): Map<string, string> {
  const secrets = new Map<string, string>()
  for (const providerId of LLM_PROVIDER_ENV_SCRUB_IDS) {
    const provider = KNOWN_PROVIDERS.find((entry) => entry.id === providerId)
    if (!provider) continue
    if (isEnvVarConfigured(provider.envVarName)) {
      secrets.set(providerId, process.env[provider.envVarName]!)
    }
  }
  return secrets
}

/**
 * On Vercel: only the signed-in user's BYOK rows (never org env).
 * Local/dev: project env LLM keys.
 */
export async function loadLlmProviderSecrets(
  userId: string | undefined
): Promise<Map<string, string>> {
  if (process.env.VERCEL === "1") {
    const secrets = new Map<string, string>()
    if (userId) {
      const byok = await loadDecryptedUserProviderSecrets(userId, {
        providerFilter: (providerId) => !INFRA_PROVIDER_ID_SET.has(providerId),
      })
      for (const [providerId, apiKey] of byok) {
        secrets.set(providerId, apiKey)
      }
    }
    return secrets
  }

  return readEnvLlmProviderSecrets()
}

export async function resolveUserProviderSecret(
  userId: string | undefined,
  providerId: string
): Promise<string | undefined> {
  const provider = KNOWN_PROVIDERS.find((entry) => entry.id === providerId)
  if (!provider) {
    if (process.env.VERCEL === "1") {
      if (!userId || INFRA_PROVIDER_ID_SET.has(providerId)) return undefined
      return (
        await loadDecryptedUserProviderSecrets(userId, { providerId })
      ).get(providerId)
    }
    return undefined
  }

  if (LLM_PROVIDER_ENV_SCRUB_IDS.includes(providerId)) {
    return (await loadLlmProviderSecrets(userId)).get(providerId)
  }

  if (process.env.VERCEL === "1") {
    if (!userId) return undefined
    return (await loadDecryptedUserProviderSecrets(userId, { providerId })).get(
      providerId
    )
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

/**
 * Resolve the Daytona API key for a user sandbox/runtime.
 * On Vercel: BYOK only (`daytona` in `pi_user_providers`). Never org keys.
 * Local/dev: BYOK when present, else `DAYTONA_API_KEY`. `ORG_DAYTONA_API_KEY`
 * is never used for end-user sandboxes.
 */
export async function resolveDaytonaRuntimeApiKey(
  userId: string | undefined
): Promise<string | undefined> {
  if (userId) {
    const fromUserStore = await resolveUserDaytonaApiKey(userId)
    if (fromUserStore) return fromUserStore
  }
  if (process.env.VERCEL === "1") return undefined
  return process.env.DAYTONA_API_KEY
}
