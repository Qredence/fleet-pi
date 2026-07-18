import {
  KNOWN_PROVIDERS,
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
} from "@workspace/pi-protocol/provider-catalog"
import type { ChatProviderInfo } from "@workspace/pi-protocol/chat-protocol"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import { listConfiguredProviderIds } from "@/lib/db/user-providers"
import { isEnvVarConfigured } from "@/lib/env-manager"

export async function getProviderConfigStatus(options?: {
  userId?: string
  services?: AgentSessionServices
}): Promise<Array<ChatProviderInfo>> {
  if (process.env.VERCEL === "1") {
    return getVercelProviderConfigStatus(options?.userId)
  }

  return getLocalProviderConfigStatus(options?.services)
}

async function getVercelProviderConfigStatus(userId?: string) {
  if (!userId) {
    return KNOWN_PROVIDERS.map((provider) => ({
      id: provider.id,
      name: provider.name,
      envVarName: provider.envVarName,
      isConfigured: false,
    }))
  }

  const configuredProviderIds = await listConfiguredProviderIds(userId)

  return KNOWN_PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    envVarName: provider.envVarName,
    isConfigured: isProviderConfigured(provider.id, {
      configuredProviderIds,
    }),
  }))
}

function getLocalProviderConfigStatus(services?: AgentSessionServices) {
  return KNOWN_PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    envVarName: provider.envVarName,
    isConfigured: isProviderConfigured(provider.id, { services }),
  }))
}

function isProviderConfigured(
  providerId: string,
  options: {
    configuredProviderIds?: Set<string>
    services?: AgentSessionServices
  }
): boolean {
  if (providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) {
    if (options.configuredProviderIds) {
      return (
        options.configuredProviderIds.has(
          OPENAI_CHAT_COMPLETIONS_PROVIDER_ID
        ) &&
        options.configuredProviderIds.has(
          OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
        ) &&
        options.configuredProviderIds.has(
          OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID
        )
      )
    }

    const keyConfigured =
      isEnvVarConfigured("OPENAI_CHAT_COMPLETIONS_API_KEY") ||
      hasRuntimeApiKey(options.services, OPENAI_CHAT_COMPLETIONS_PROVIDER_ID)
    const baseUrlConfigured = isEnvVarConfigured(
      "OPENAI_CHAT_COMPLETIONS_BASE_URL"
    )
    const modelConfigured = isEnvVarConfigured("OPENAI_CHAT_COMPLETIONS_MODEL")
    return keyConfigured && baseUrlConfigured && modelConfigured
  }

  if (options.configuredProviderIds) {
    return options.configuredProviderIds.has(providerId)
  }

  const provider = KNOWN_PROVIDERS.find((entry) => entry.id === providerId)
  if (!provider) return false

  return (
    isEnvVarConfigured(provider.envVarName) ||
    hasRuntimeApiKey(options.services, provider.id)
  )
}

function hasRuntimeApiKey(
  services: AgentSessionServices | undefined,
  providerId: string
) {
  if (!services) return false

  const authStorage = services.authStorage as {
    getRuntimeApiKey?: (providerId: string) => string | undefined
  }
  const runtimeKey = authStorage.getRuntimeApiKey?.(providerId)
  return typeof runtimeKey === "string" && runtimeKey.length > 0
}
