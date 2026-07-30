import {
  INFRA_PROVIDER_IDS,
  KNOWN_PROVIDERS,
  LLM_PROVIDER_ENV_SCRUB_IDS,
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
} from "@workspace/pi-protocol/provider-catalog"
import {
  isLegacyFleetOccModelId,
  resolveNeonAiGatewayConfig,
} from "./neon-ai-gateway"
import { isDeployedChatRuntimeSurface } from "./deployed-chat-runtime"
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

function shouldLoadUserByokFromDatabase() {
  return isDeployedChatRuntimeSurface()
}

function stripLegacyOccByokWhenGatewayActive(
  userId: string | undefined,
  secrets: Map<string, string>,
  modelId: string | undefined
) {
  if (!userId || !resolveNeonAiGatewayConfig(userId)) {
    return secrets
  }

  if (
    !secrets.has(OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) ||
    !modelId ||
    !isLegacyFleetOccModelId(modelId)
  ) {
    return secrets
  }

  const next = new Map(secrets)
  next.delete(OPENAI_CHAT_COMPLETIONS_PROVIDER_ID)
  next.delete(OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID)
  next.delete(OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID)
  return next
}

/**
 * On Vercel: only the signed-in user's BYOK rows (never org env).
 * Neon Function chat runtime: same — platform Gateway + user BYOK only.
 * Local/dev: project env LLM keys.
 */
export async function loadLlmProviderSecrets(
  userId: string | undefined
): Promise<Map<string, string>> {
  if (shouldLoadUserByokFromDatabase()) {
    const secrets = new Map<string, string>()
    if (userId) {
      const byok = await loadDecryptedUserProviderSecrets(userId, {
        providerFilter: (providerId) => !INFRA_PROVIDER_ID_SET.has(providerId),
      })
      for (const [providerId, apiKey] of byok) {
        secrets.set(providerId, apiKey)
      }
    }
    return stripLegacyOccByokWhenGatewayActive(
      userId,
      secrets,
      secrets.get(OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID)
    )
  }

  return readEnvLlmProviderSecrets()
}

export async function resolveUserProviderSecret(
  userId: string | undefined,
  providerId: string
): Promise<string | undefined> {
  const provider = KNOWN_PROVIDERS.find((entry) => entry.id === providerId)
  if (!provider) {
    if (shouldLoadUserByokFromDatabase()) {
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

  if (shouldLoadUserByokFromDatabase()) {
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
