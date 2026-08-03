import {
  OCC_INSTANCE_ID_PREFIX,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
  isCustomProviderId,
  isNamedOccInstanceId,
} from "@workspace/pi-protocol/provider-catalog"
import { OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT } from "./openai-chat-completions-compat"
import {
  assertSafeCustomProviderBaseUrl,
  assertSafeOpenAiCompatibleBaseUrl,
  isGatewayHost,
} from "./openai-chat-completions-url"
import type { PiCustomProviderApi } from "@workspace/pi-protocol/chat-protocol"
import type {
  AgentSessionServices,
  ProviderConfig,
} from "@earendil-works/pi-coding-agent"
import type { Api } from "@earendil-works/pi-ai"
import { listOccInstances, loadOccInstanceApiKey } from "@/lib/db/occ-instances"

type RegisteredModels = NonNullable<ProviderConfig["models"]>

type RegisteredCustomProvider = {
  id: string
  displayName: string
  baseUrl: string
  apiKey: string
  api: PiCustomProviderApi
  modelIds: Array<string>
  usesGateway: boolean
}

/**
 * Reason a configured custom provider could not be registered. Surfaced as a
 * diagnostic so Settings/`/api/chat/models` don't show a misleading healthy
 * "Configured" row for a provider that never reached the model picker.
 */
export type CustomProviderSkipReason = {
  id: string
  displayName: string
  reason: "api-key-unreadable" | "invalid-base-url" | "no-models"
}

/**
 * Maps Fleet's protocol API family to Pi's native `Api` identifier. Pi spells
 * the Google family `google-generative-ai`; everything else matches.
 */
export function toPiApi(api: PiCustomProviderApi): Api {
  switch (api) {
    case "openai-completions":
    case "openai-responses":
    case "anthropic-messages":
      return api
    case "google-genai":
      return "google-generative-ai"
    default: {
      const exhaustive: never = api
      return exhaustive
    }
  }
}

/** OCC-family APIs go through OpenAI-compatible URL/path hardening. */
function isOccFamilyApi(api: PiCustomProviderApi): boolean {
  return api === "openai-completions" || api === "openai-responses"
}

/**
 * Builds a model registration for a custom provider model.
 *
 * @param modelId - The model identifier
 * @param api - The native API family of the provider
 * @param usesGateway - Whether the provider uses a Neon AI Gateway endpoint
 * @returns The model registration with endpoint-specific token limits and compatibility settings
 */
export function buildCustomModelEntry(
  modelId: string,
  api: PiCustomProviderApi,
  usesGateway: boolean
): RegisteredModels[number] {
  // Neon AI Gateway rejects max_tokens above each model's max_output_tokens
  // (25_000) with a 400. The cap + compat quirks only apply to the OCC family
  // on gateway hosts; Anthropic/Google-family endpoints keep the 32k default.
  const onGatewayOcc = usesGateway && api === "openai-completions"
  return {
    id: modelId,
    name: modelId,
    api: toPiApi(api),
    reasoning: false,
    input: ["text" as const],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: onGatewayOcc ? 25_000 : 32_000,
    ...(onGatewayOcc
      ? { compat: { ...OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT } }
      : {}),
  }
}

/**
 * Collects every custom provider to register for a user: legacy named OCC
 * instances (`openai-chat-completions+<slug>`) and general custom providers
 * (`custom+<slug>`). The reserved default slot stays with
 * `registerOpenAiChatCompletionsProvider`.
 */
async function listCustomProviderRegistrations(
  userId: string | undefined
): Promise<{
  registrations: Array<RegisteredCustomProvider>
  skipped: Array<CustomProviderSkipReason>
}> {
  const registrations: Array<RegisteredCustomProvider> = []
  const skipped: Array<CustomProviderSkipReason> = []

  // `listOccInstances` returns [] locally (no DB URL) and on deployed accounts
  // with no custom providers, so local anonymous registers nothing here.
  const instances = await listOccInstances(userId)
  for (const instance of instances) {
    const api: PiCustomProviderApi = instance.api ?? "openai-completions"
    // Legacy single-model rows carry `modelId` only; normalized rows carry
    // `modelIds`. Fall back so both shapes register.
    const modelIds = (
      instance.modelIds?.length
        ? instance.modelIds
        : instance.modelId
          ? [instance.modelId]
          : []
    ).filter((id) => id.trim())
    if (modelIds.length === 0) {
      skipped.push({
        id: instance.id,
        displayName: instance.displayName,
        reason: "no-models",
      })
      continue
    }
    const apiKey = await loadOccInstanceApiKey(userId, instance.id)
    if (!apiKey) {
      skipped.push({
        id: instance.id,
        displayName: instance.displayName,
        reason: "api-key-unreadable",
      })
      continue
    }
    let baseUrl: string
    try {
      // Named instances are https-only everywhere (unlike the default OCC
      // slot, which may use http://localhost in local dev).
      baseUrl = isOccFamilyApi(api)
        ? assertSafeOpenAiCompatibleBaseUrl(instance.baseUrl)
        : assertSafeCustomProviderBaseUrl(instance.baseUrl)
      if (new URL(baseUrl).protocol !== "https:") {
        throw new Error("Custom providers require an https base URL.")
      }
    } catch {
      skipped.push({
        id: instance.id,
        displayName: instance.displayName,
        reason: "invalid-base-url",
      })
      continue
    }
    registrations.push({
      id: instance.id,
      displayName: instance.displayName,
      baseUrl,
      apiKey,
      api,
      modelIds,
      usesGateway: isGatewayHost(baseUrl),
    })
  }

  return { registrations, skipped }
}

const SKIP_REASON_MESSAGE: Record<CustomProviderSkipReason["reason"], string> =
  {
    "api-key-unreadable":
      "stored API key could not be read (secret rotation or corruption)",
    "invalid-base-url":
      "base URL failed validation (https + allowed host required)",
    "no-models": "no models are configured for this provider",
  }

/**
 * Registers the user's named OCC instances and general custom providers
 * through Pi's native `modelRuntime.registerProvider` path, and removes stale
 * custom providers that are no longer configured.
 *
 * @param userId - The user whose provider configurations should be registered
 */
export async function registerCustomProviders(
  services: AgentSessionServices,
  userId: string | undefined
) {
  const { modelRuntime } = services

  const { registrations, skipped } =
    await listCustomProviderRegistrations(userId)
  const registeredIds = registrations.map((r) => r.id)

  for (const skip of skipped) {
    services.diagnostics.push({
      type: "warning",
      message: `[Custom provider] "${skip.displayName}" (${skip.id}) skipped: ${
        SKIP_REASON_MESSAGE[skip.reason]
      }. The models are unavailable until fixed.`,
    })
  }

  for (const registration of registrations) {
    const models: RegisteredModels = registration.modelIds.map((modelId) =>
      buildCustomModelEntry(modelId, registration.api, registration.usesGateway)
    )
    modelRuntime.registerProvider(registration.id, {
      name: registration.displayName,
      baseUrl: registration.baseUrl,
      apiKey: registration.apiKey,
      api: toPiApi(registration.api),
      models,
    })
  }

  unregisterStaleCustomProviders(modelRuntime, registeredIds)
}

/**
 * Removes registered custom providers (legacy named OCC + general custom)
 * that are absent from the active instance IDs. Never touches the reserved
 * default OCC slot.
 *
 * @param activeInstanceIds - Provider IDs for the user's currently configured custom providers
 */
export function unregisterStaleCustomProviders(
  modelRuntime: AgentSessionServices["modelRuntime"],
  activeInstanceIds: Array<string>
) {
  const active = new Set(activeInstanceIds)
  for (const id of modelRuntime.getRegisteredProviderIds()) {
    if (id === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) continue
    const isCustom =
      isNamedOccInstanceId(id) ||
      isCustomProviderId(id) ||
      id.startsWith(OCC_INSTANCE_ID_PREFIX)
    if (isCustom && !active.has(id)) {
      modelRuntime.unregisterProvider(id)
    }
  }
}
