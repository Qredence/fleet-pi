import {
  KNOWN_PROVIDERS,
  LLM_PROVIDER_ENV_SCRUB_IDS,
} from "@workspace/hax-design/lib/pi/provider-catalog"
import { loadDecryptedUserProviderSecrets } from "@/lib/db/user-providers"
import { isEnvVarConfigured } from "@/lib/env-manager"

export async function loadLlmProviderSecrets(
  userId: string | undefined
): Promise<Map<string, string>> {
  if (process.env.VERCEL === "1") {
    if (!userId) return new Map()
    return loadDecryptedUserProviderSecrets(userId, {
      providerFilter: (providerId) =>
        LLM_PROVIDER_ENV_SCRUB_IDS.includes(providerId),
    })
  }

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

export async function resolveUserProviderSecret(
  userId: string | undefined,
  providerId: string
): Promise<string | undefined> {
  const provider = KNOWN_PROVIDERS.find((entry) => entry.id === providerId)
  if (!provider) return undefined

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
