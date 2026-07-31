import {
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
  isOccProviderId,
} from "@workspace/pi-protocol/provider-catalog"
import { OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT } from "./openai-chat-completions-compat"
import {
  isLegacyFleetOccModelId,
  resolveNeonAiGatewayConfig,
} from "./neon-ai-gateway"
import {
  assertSafeOpenAiCompatibleBaseUrl,
  isAllowedNeonAiGatewayHostname,
} from "./openai-chat-completions-url"
import { resolveUserProviderSecret } from "./user-provider-secrets"
import type { NeonAiGatewayConfig } from "./neon-ai-gateway"
import type {
  AgentSessionServices,
  ProviderConfig,
} from "@earendil-works/pi-coding-agent"
import { listOccInstances, loadOccInstanceApiKey } from "@/lib/db/occ-instances"
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

type RegisteredInstance = {
  id: string
  displayName: string
  baseUrl: string
  apiKey: string
  modelIds: Array<string>
  usesGateway: boolean
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

/** Gateway cap applies to any OCC host on the Neon AI Gateway hostname family. */
function isGatewayHost(baseUrl: string): boolean {
  try {
    return isAllowedNeonAiGatewayHostname(new URL(baseUrl).hostname)
  } catch {
    return false
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

/**
 * Collect every OCC provider to register for a user: the reserved default
 * (BYOK triple or Neon AI Gateway) slot plus every configured named instance.
 */
async function listOccRegistrations(
  userId: string | undefined
): Promise<Array<RegisteredInstance>> {
  const registrations: Array<RegisteredInstance> = []

  const config = await resolveOpenAiChatCompletionsConfig(userId)
  if (config) {
    const gateway = resolveNeonAiGatewayConfig(userId)
    const usesGateway =
      gateway !== undefined &&
      config.baseUrl === gateway.baseUrl &&
      config.apiKey === gateway.apiKey
    registrations.push({
      id: PROVIDER_ID,
      displayName: "OpenAI Chat Completions",
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      modelIds: config.modelIds,
      usesGateway,
    })
  }

  // Named multi-instances. `listOccInstances` returns [] locally (no DB URL)
  // and on deployed accounts with no named instances, so local anonymous
  // registers only the reserved default slot.
  const instances = await listOccInstances(userId)
  for (const instance of instances) {
    const apiKey = await loadOccInstanceApiKey(userId, instance.id)
    if (!apiKey) continue
    let baseUrl: string
    try {
      baseUrl = assertSafeOpenAiCompatibleBaseUrl(instance.baseUrl)
    } catch {
      continue
    }
    registrations.push({
      id: instance.id,
      displayName: instance.displayName,
      baseUrl,
      apiKey,
      modelIds: [instance.modelId],
      usesGateway: isGatewayHost(baseUrl),
    })
  }

  return registrations
}

export async function registerOpenAiChatCompletionsProvider(
  services: AgentSessionServices,
  userId: string | undefined
) {
  const { modelRuntime } = services

  const registrations = await listOccRegistrations(userId)
  const registeredInstanceIds = registrations.map((r) => r.id)

  if (registrations.length === 0) {
    modelRuntime.unregisterProvider(PROVIDER_ID)
    // Do not delete shared process.env — other sessions may still rely on it.
    unregisterStaleOccInstances(modelRuntime, registeredInstanceIds)
    return
  }

  for (const registration of registrations) {
    const models: RegisteredModels = registration.modelIds.map((modelId) =>
      buildModelEntry(modelId, registration.usesGateway)
    )
    modelRuntime.registerProvider(registration.id, {
      name: registration.displayName,
      baseUrl: registration.baseUrl,
      apiKey: registration.apiKey,
      api: "openai-completions",
      ...(registration.usesGateway
        ? { compat: OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT }
        : {}),
      models,
    })
  }

  unregisterStaleOccInstances(modelRuntime, registeredInstanceIds)
}

/** Drop named-instance providers that no longer exist for this user. */
function unregisterStaleOccInstances(
  modelRuntime: AgentSessionServices["modelRuntime"],
  activeInstanceIds: Array<string>
) {
  const active = new Set(activeInstanceIds)
  for (const id of modelRuntime.getRegisteredProviderIds()) {
    if (isOccProviderId(id) && id !== PROVIDER_ID && !active.has(id)) {
      modelRuntime.unregisterProvider(id)
    }
  }
}
