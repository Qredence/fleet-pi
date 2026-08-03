import {
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
} from "@workspace/pi-protocol/provider-catalog"
import { OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT } from "./openai-chat-completions-compat"
import {
  isLegacyFleetOccModelId,
  resolveNeonAiGatewayConfig,
} from "./neon-ai-gateway"
import { assertSafeOpenAiCompatibleBaseUrl } from "./openai-chat-completions-url"
import { resolveUserProviderSecret } from "./user-provider-secrets"
import type { NeonAiGatewayConfig } from "./neon-ai-gateway"
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

/**
 * Builds a model registration for an OpenAI Chat Completions model.
 *
 * @param modelId - The model identifier.
 * @param usesGateway - Whether the model uses the Neon AI Gateway endpoint.
 * @returns The model registration with endpoint-specific token limits and compatibility settings.
 */
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
    // Neon AI Gateway rejects max_tokens above each model's max_output_tokens
    // (25_000 for qwen35-122b-a10b / gpt-oss-120b) with a 400 ("max_new_tokens
    // … cannot be greater than max_output_tokens 25000"). Cap gateway models at
    // the gateway limit; keep 32k for BYOK OCC endpoints that allow it.
    maxTokens: usesGateway ? 25_000 : 32_000,
    ...(usesGateway
      ? { compat: { ...OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT } }
      : {}),
  }
}

/**
 * Resolves a user’s OpenAI-compatible BYOK configuration.
 *
 * Uses user-specific secrets with environment variable fallbacks for the base URL and model. Returns no configuration when required values are missing, the base URL is unsafe, or a legacy fleet model is selected alongside a Neon AI Gateway configuration.
 *
 * @param userId - The user whose provider secrets should be resolved
 * @returns The validated BYOK configuration, or `undefined` when it cannot be resolved
 */
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

/**
 * Resolves the OpenAI Chat Completions configuration for a user.
 *
 * @param userId - The user whose configuration should be resolved
 * @returns The user's BYOK configuration, the Neon AI Gateway configuration, or `undefined` when neither is available
 */
export async function resolveOpenAiChatCompletionsConfig(
  userId: string | undefined
): Promise<OpenAiChatCompletionsConfig | undefined> {
  const byok = await resolveOccByokConfig(userId)
  if (byok) return byok

  const gateway = resolveNeonAiGatewayConfig(userId)
  if (gateway) return gatewayToOccConfig(gateway)

  return undefined
}

/**
 * Registers the reserved default OCC slot (BYOK triple or Neon AI Gateway)
 * only. Named instances and general custom providers are registered through
 * {@link registerCustomProviders} (custom-provider-registry).
 *
 * @param userId - The user whose provider configurations should be registered.
 */
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
    models,
  })
}
