import {
  KNOWN_PROVIDERS,
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
} from "@workspace/pi-protocol/provider-catalog"
import { resolveNeonAiGatewayConfig } from "./neon-ai-gateway"
import { isLocalDbBackedUser } from "./user-provider-secrets"
import type { ChatProviderInfo } from "@workspace/pi-protocol/chat-protocol"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import { listConfiguredProviderIds } from "@/lib/db/user-providers"
import { isEnvVarConfigured } from "@/lib/env-manager"
import { isVercelDeployment } from "@/lib/deployment/environment"

export async function getProviderConfigStatus(options?: {
  userId?: string
  services?: AgentSessionServices
}): Promise<Array<ChatProviderInfo>> {
  if (isVercelDeployment()) {
    return getVercelProviderConfigStatus(options?.userId)
  }

  return getLocalProviderConfigStatus(options?.userId, options?.services)
}

async function getVercelProviderConfigStatus(userId?: string) {
  // Settings lists account BYOK only. Org LLM env keys never back chat on
  // Vercel and must not appear as user credentials.
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
      userId,
    }),
  }))
}

async function getLocalProviderConfigStatus(
  userId: string | undefined,
  services?: AgentSessionServices
) {
  // Signed-in local accounts backed by the chat database see their stored
  // BYOK rows as configured, mirroring the Vercel path. Anonymous/dev
  // accounts stay env-driven.
  const configuredProviderIds =
    userId && isLocalDbBackedUser(userId)
      ? await listConfiguredProviderIds(userId)
      : undefined

  return KNOWN_PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    envVarName: provider.envVarName,
    isConfigured: isProviderConfigured(provider.id, {
      configuredProviderIds,
      services,
      userId,
    }),
  }))
}

function isProviderConfigured(
  providerId: string,
  options: {
    configuredProviderIds?: Set<string>
    services?: AgentSessionServices
    userId?: string
  }
): boolean {
  if (providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) {
    if (options.userId && resolveNeonAiGatewayConfig(options.userId)) {
      return true
    }

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
  return services.modelRuntime.hasConfiguredAuth(providerId)
}
