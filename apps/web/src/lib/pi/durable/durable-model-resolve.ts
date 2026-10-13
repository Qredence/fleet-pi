import {
  listCustomProviderRegistrations,
  toPiApi,
} from "../runtime/custom-provider-registry"
import {
  OCC_CHAT_PROVIDER,
  isEnabledChatModelSelection,
  isOccChatProviderAlias,
  resolveOccChatModelSelection,
} from "../runtime/chat-model-rematch"
import { resolveOpenAiChatCompletionsConfig } from "../runtime/openai-chat-completions-provider"
import type { ChatModelSelection } from "@workspace/pi-protocol/chat-protocol"
import type { DurableAgentModelConfig, DurableModelApi } from "./durable-model"
import { loadUserProjectSettings } from "@/lib/db/user-settings"

export async function resolveDurableAgentModel(
  userId: string | undefined,
  model: ChatModelSelection | undefined
): Promise<DurableAgentModelConfig | undefined> {
  const selection = parseSelection(model)
  const settings = userId ? await loadUserProjectSettings(userId) : null
  const enabledPatterns = readEnabledModels(settings)

  const custom = await listCustomProviderRegistrations(userId)
  if (selection) {
    const match = custom.registrations.find(
      (item) => item.id === selection.provider
    )
    if (match) {
      const config = configFromCustom(match, selection.id)
      if (
        config &&
        !isEnabledChatModelSelection(match.id, config.modelId, enabledPatterns)
      ) {
        return undefined
      }
      return config
    }
  }

  const occ = await resolveOpenAiChatCompletionsConfig(userId)
  if (occ) {
    if (
      selection &&
      !isOccChatProviderAlias(selection.provider) &&
      selection.provider !== OCC_CHAT_PROVIDER &&
      !custom.registrations.some((item) => item.id === selection.provider)
    ) {
      return undefined
    }

    const modelId = resolveOccChatModelSelection(
      selection,
      occ.modelIds,
      userId
    )
    if (!modelId) return undefined
    if (
      selection &&
      !isEnabledChatModelSelection(OCC_CHAT_PROVIDER, modelId, enabledPatterns)
    ) {
      return undefined
    }
    return {
      provider: OCC_CHAT_PROVIDER,
      modelId,
      apiKey: occ.apiKey,
      baseUrl: occ.baseUrl,
      api: "openai-completions",
    }
  }

  if (selection) return undefined
  const first = custom.registrations.at(0)
  if (!first) return undefined
  const fallbackId = first.modelIds.at(0) ?? ""
  const config = configFromCustom(first, fallbackId)
  if (
    config &&
    !isEnabledChatModelSelection(first.id, config.modelId, enabledPatterns)
  ) {
    return undefined
  }
  return config
}

function readEnabledModels(
  settings: Record<string, unknown> | null
): ReadonlyArray<string> | undefined {
  if (!settings) return undefined
  const enabled = settings.enabledModels
  if (!Array.isArray(enabled)) return undefined
  return enabled.filter((item): item is string => typeof item === "string")
}

function configFromCustom(
  match: {
    id: string
    apiKey: string
    baseUrl: string
    api: Parameters<typeof toPiApi>[0]
    modelIds: Array<string>
  },
  requestedId: string
): DurableAgentModelConfig | undefined {
  const modelId = match.modelIds.includes(requestedId)
    ? requestedId
    : match.modelIds[0]
  if (!modelId) return undefined
  return {
    provider: match.id,
    modelId,
    apiKey: match.apiKey,
    baseUrl: match.baseUrl,
    api: toDurableApi(toPiApi(match.api)),
  }
}

function toDurableApi(api: string): DurableModelApi {
  switch (api) {
    case "openai-completions":
    case "openai-responses":
    case "anthropic-messages":
    case "google-generative-ai":
      return api
    default:
      return "openai-completions"
  }
}

function parseSelection(
  model: ChatModelSelection | undefined
): { provider: string; id: string } | undefined {
  if (!model) return undefined
  if (typeof model === "string") {
    const slash = model.indexOf("/")
    if (slash <= 0) return undefined
    return { provider: model.slice(0, slash), id: model.slice(slash + 1) }
  }
  if (!model.provider || !model.id) return undefined
  return { provider: model.provider, id: model.id }
}
