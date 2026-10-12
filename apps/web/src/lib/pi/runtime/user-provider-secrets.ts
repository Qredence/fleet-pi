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
import { isChatDatabaseConfigured } from "@/lib/db/chat-db-config"
import { loadDecryptedUserProviderSecrets } from "@/lib/db/user-providers"
import { isEnvVarConfigured } from "@/lib/env-manager"
import { isVercelDeployment } from "@/lib/deployment/environment"

const INFRA_PROVIDER_ID_SET = new Set<string>(INFRA_PROVIDER_IDS)

/**
 * The reserved OpenAI Chat Completions slot and its companion base-url/model
 * rows. Together they form the OCC BYOK triple saved through Settings.
 */
const OCC_TRIPLE_PROVIDER_IDS = new Set<string>([
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
])

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

/**
 * Local dev accounts backed by the chat database: a signed-in user on a
 * machine with `FLEET_PI_CHAT_DATABASE_URL`. Mirrors `useLocalProviderStore`
 * (custom provider instances) so BYOK rows the user saved through Settings
 * drive the runtime locally instead of being ignored in favor of env vars.
 */
export function isLocalDbBackedUser(userId: string | undefined): boolean {
  return (
    !isDeployedChatRuntimeSurface() &&
    Boolean(userId) &&
    isChatDatabaseConfigured()
  )
}

/**
 * True when the user saved a complete OpenAI Chat Completions BYOK triple
 * (apiKey + baseUrl + model) in `pi_user_providers`. Explicit user
 * configuration wins over the platform Neon AI Gateway default: it keeps the
 * legacy OCC settings migration from silently dropping the user's own model.
 */
export async function hasExplicitOccByok(
  userId: string | undefined
): Promise<boolean> {
  if (!userId) return false
  const [apiKey, baseUrl, model] = await Promise.all([
    loadDecryptedUserProviderSecrets(userId, {
      providerId: OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
    }),
    loadDecryptedUserProviderSecrets(userId, {
      providerId: OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
    }),
    loadDecryptedUserProviderSecrets(userId, {
      providerId: OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
    }),
  ])
  return (
    apiKey.has(OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) &&
    baseUrl.has(OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID) &&
    model.has(OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID)
  )
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

  // A complete explicit BYOK triple is deliberate user configuration (added
  // through Settings against a live OpenAI-compatible endpoint) and must
  // survive; only partial/legacy leftovers are stripped so the platform
  // Gateway default applies.
  if (
    secrets.has(OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID) &&
    secrets.has(OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID)
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

  // DB-backed local accounts: prefer the BYOK rows the user saved through
  // Settings over env fallbacks for the reserved OCC slot, so a provider added
  // in the UI drives the runtime in local dev (same source of truth as the
  // deployed surfaces). Scoped to the OCC triple only; other LLM providers
  // keep the env-first behavior locally.
  if (OCC_TRIPLE_PROVIDER_IDS.has(providerId) && isLocalDbBackedUser(userId)) {
    const saved = (
      await loadDecryptedUserProviderSecrets(userId, { providerId })
    ).get(providerId)
    if (saved) return saved
    // Nothing saved through Settings: fall back to the local env vars below
    // (`OPENAI_CHAT_COMPLETIONS_*`), as for anonymous local chat.
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
  if (isVercelDeployment()) return undefined
  return process.env.DAYTONA_API_KEY
}
