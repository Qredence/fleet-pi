import {
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
} from "@workspace/pi-protocol/provider-catalog"
import { OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT } from "./openai-chat-completions-compat"
import {
  
  isLegacyFleetOccModelId,
  resolveNeonAiGatewayConfig
} from "./neon-ai-gateway"
import {
  assertSafeOpenAiCompatibleBaseUrl,
  normalizeOpenAiCompatibleBaseUrl,
} from "./openai-chat-completions-url"
import { resolveUserProviderSecret } from "./user-provider-secrets"
import type {NeonAiGatewayConfig} from "./neon-ai-gateway";
import type {
  AgentSessionServices,
  ProviderConfig,
} from "@earendil-works/pi-coding-agent"
import { isEnvVarConfigured } from "@/lib/env-manager"

export {
  assertSafeOpenAiCompatibleBaseUrl,
  normalizeOpenAiCompatibleBaseUrl,
} from "./openai-chat-completions-url"

const PROVIDER_ID = OPENAI_CHAT_COMPLETIONS_PROVIDER_ID
const BASE_URL_ENV_VAR = "OPENAI_CHAT_COMPLETIONS_BASE_URL"
const MODEL_ENV_VAR = "OPENAI_CHAT_COMPLETIONS_MODEL"

type OpenAiChatCompletionsConfig = {
  apiKey: string
  baseUrl: string
  modelIds: Array<string>
}

type RegisteredModels = NonNullable<ProviderConfig["models"]>

function buildModelEntry(
  modelId: string,
  usesGateway: boolean
): RegisteredModels[number] {
  return {
    id: modelId,
    name: modelId,
    api: "openai-completions" as const,
    reasoning: false,
    input: ["text" as const],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 32_000,
    ...(usesGateway
      ? { compat: { ...OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT } }
      : {}),
  }
}

export async function discoverOpenAiChatCompletionsModels(
  userId: string | undefined
): Promise<Array<{ id: string; name: string }>> {
  const config = await resolveOpenAiChatCompletionsConfig(userId)
  if (!config) return []

  // OpenCode Zen (and similar gateways) may advertise many models on /models.
  // Fleet Pi only exposes explicitly configured model ids for this provider.
  return config.modelIds.map((id) => ({ id, name: id }))
}

async function resolveOccByokConfig(
  userId: string | undefined
): Promise<OpenAiChatCompletionsConfig | undefined> {
  const apiKey = await resolveUserProviderSecret(userId, PROVIDER_ID)
  if (!apiKey) return undefined

  const fromUserStore = await resolveUserProviderSecret(
    userId,
    OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
  )
  const baseUrl =
    fromUserStore ??
    (isEnvVarConfigured(BASE_URL_ENV_VAR)
      ? process.env[BASE_URL_ENV_VAR]
      : undefined)

  if (!baseUrl?.trim()) return undefined

  const modelFromStore = await resolveUserProviderSecret(
    userId,
    OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID
  )
  const modelId =
    modelFromStore ??
    (isEnvVarConfigured(MODEL_ENV_VAR) ? process.env[MODEL_ENV_VAR] : undefined)

  if (!modelId?.trim()) return undefined

  let safeBaseUrl: string
  try {
    safeBaseUrl = assertSafeOpenAiCompatibleBaseUrl(baseUrl)
  } catch {
    return undefined
  }

  const trimmedModelId = modelId.trim()
  const gateway = resolveNeonAiGatewayConfig(userId)
  if (gateway && isLegacyFleetOccModelId(trimmedModelId)) {
    return undefined
  }

  return {
    apiKey,
    baseUrl: safeBaseUrl,
    modelIds: [trimmedModelId],
  }
}

function gatewayToOccConfig(
  gateway: NeonAiGatewayConfig
): OpenAiChatCompletionsConfig {
  return {
    apiKey: gateway.apiKey,
    baseUrl: gateway.baseUrl,
    modelIds: [...gateway.modelIds],
  }
}

export async function resolveOpenAiChatCompletionsConfig(
  userId: string | undefined
): Promise<OpenAiChatCompletionsConfig | undefined> {
  const byok = await resolveOccByokConfig(userId)
  if (byok) return byok

  const gateway = resolveNeonAiGatewayConfig(userId)
  if (gateway) return gatewayToOccConfig(gateway)

  return undefined
}

export async function registerOpenAiChatCompletionsProvider(
  services: AgentSessionServices,
  userId: string | undefined
) {
  const { modelRuntime } = services

  const config = await resolveOpenAiChatCompletionsConfig(userId)
  if (!config) {
    modelRuntime.unregisterProvider(PROVIDER_ID)
    // Do not delete shared process.env — other sessions may still rely on it.
    return
  }

  const gateway = resolveNeonAiGatewayConfig(userId)
  const usesGateway =
    gateway !== undefined &&
    config.baseUrl === gateway.baseUrl &&
    config.apiKey === gateway.apiKey

  const models: RegisteredModels = config.modelIds.map((modelId) =>
    buildModelEntry(modelId, usesGateway)
  )

  modelRuntime.registerProvider(PROVIDER_ID, {
    name: "OpenAI Chat Completions",
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    api: "openai-completions",
    ...(usesGateway ? { compat: OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT } : {}),
    models,
  })
}
