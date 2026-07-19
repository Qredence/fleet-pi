import {
  KNOWN_PROVIDERS,
  LLM_PROVIDER_ENV_SCRUB_IDS,
} from "@workspace/pi-protocol/provider-catalog"
import { loadDecryptedUserProviderSecrets } from "@/lib/db/user-providers"
import { isEnvVarConfigured } from "@/lib/env-manager"

/**
 * Snapshot of org LLM provider env secrets captured before Vercel scrub.
 * BYOK always wins; this is the platform fallback when a user has no row.
 */
let vercelEnvProviderSnapshot: Map<string, string> | null = null

export function snapshotVercelProviderEnvSecrets() {
  if (process.env.VERCEL !== "1") return
  // createSessionServices can run twice per chat turn (catalog + runtime).
  // Keep the first pre-scrub snapshot; a later call would see empty env.
  if (vercelEnvProviderSnapshot) return
  vercelEnvProviderSnapshot = readEnvLlmProviderSecrets()
}

/** Test helper — clears the scrub-time snapshot. */
export function resetVercelProviderEnvSnapshotForTests() {
  vercelEnvProviderSnapshot = null
}

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

export async function loadLlmProviderSecrets(
  userId: string | undefined
): Promise<Map<string, string>> {
  if (process.env.VERCEL === "1") {
    const secrets = new Map<string, string>()
    if (userId) {
      const byok = await loadDecryptedUserProviderSecrets(userId, {
        providerFilter: (providerId) =>
          LLM_PROVIDER_ENV_SCRUB_IDS.includes(providerId),
      })
      for (const [providerId, apiKey] of byok) {
        secrets.set(providerId, apiKey)
      }
    }

    const fallback = vercelEnvProviderSnapshot ?? readEnvLlmProviderSecrets()
    for (const [providerId, apiKey] of fallback) {
      if (!secrets.has(providerId)) {
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
  // Deployed: each user must BYOK their Daytona key — no org env fallback.
  if (process.env.VERCEL === "1") return undefined
  return process.env.DAYTONA_API_KEY
}
