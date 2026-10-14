import { createModels, createProvider } from "@earendil-works/pi-ai"
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy"
import { googleGenerativeAIApi } from "@earendil-works/pi-ai/api/google-generative-ai.lazy"
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy"
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy"
import type { ProviderStreams } from "@earendil-works/pi-ai"

export type DurableModelApi =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai"

export type DurableAgentModelConfig = {
  provider: string
  modelId: string
  apiKey: string
  baseUrl: string
  api: DurableModelApi
}

const GATEWAY_COMPAT = {
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  supportsStore: false,
  supportsStrictMode: false,
  maxTokensField: "max_tokens" as const,
}

export function createDurableModels(config: DurableAgentModelConfig) {
  const models = createModels()
  const gateway = usesGatewayCap(config.baseUrl, config.api)
  models.setProvider(
    createProvider({
      id: config.provider,
      name: config.provider,
      baseUrl: config.baseUrl,
      auth: {
        apiKey: {
          name: "API key",
          resolve: () =>
            Promise.resolve({
              auth: { apiKey: config.apiKey },
              source: "settings",
            }),
        },
      },
      models: [
        {
          id: config.modelId,
          name: config.modelId,
          api: config.api,
          provider: config.provider,
          baseUrl: config.baseUrl,
          reasoning: false,
          input: ["text"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128_000,
          maxTokens: gateway ? 25_000 : 32_000,
          ...(gateway ? { compat: { ...GATEWAY_COMPAT } } : {}),
        },
      ],
      api: streamsFor(config.api),
    })
  )
  return models
}

/**
 * True when an open harness built from `current` can serve `next`. The models
 * registry captures the API key at open time, so a rotated key must reopen it.
 */
export function sameDurableModelConfig(
  current: DurableAgentModelConfig | undefined,
  next: DurableAgentModelConfig
) {
  return (
    current !== undefined &&
    current.provider === next.provider &&
    current.modelId === next.modelId &&
    current.apiKey === next.apiKey &&
    current.baseUrl === next.baseUrl &&
    current.api === next.api
  )
}

function usesGatewayCap(baseUrl: string, api: DurableModelApi) {
  if (api !== "openai-completions" && api !== "openai-responses") return false
  try {
    const host = new URL(baseUrl).hostname.toLowerCase()
    return host === "neon.tech" || host.endsWith(".neon.tech")
  } catch {
    return false
  }
}

function streamsFor(api: DurableModelApi): ProviderStreams {
  switch (api) {
    case "openai-completions":
      return openAICompletionsApi()
    case "openai-responses":
      return openAIResponsesApi()
    case "anthropic-messages":
      return anthropicMessagesApi()
    case "google-generative-ai":
      return googleGenerativeAIApi()
    default: {
      const exhaustive: never = api
      return exhaustive
    }
  }
}
