import {
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
  isCustomProviderId,
  isNamedOccInstanceId,
  normalizeCustomProviderInstance,
} from "@workspace/pi-protocol/provider-catalog"
import {
  listGoogleGenaiModels,
  listOpenAiCompatibleModels,
  modelSupportsProviderApi,
} from "./openai-models-list"
import { assertCustomProviderBaseUrl } from "./openai-chat-completions-url"
import { resolveOpenAiChatCompletionsConfig } from "./openai-chat-completions-provider"
import type {
  ChatModelInfo,
  PiCustomProviderApi,
} from "@workspace/pi-protocol/chat-protocol"
import type { RemoteOpenAiModel } from "./openai-models-list"
import {
  getOccInstanceById,
  loadOccInstanceApiKey,
} from "@/lib/db/occ-instances"
import {
  getLocalProviderInstance,
  loadLocalProviderInstanceApiKey,
  useLocalProviderStore,
} from "@/lib/db/local-provider-instances"

export type ProviderModelDiscovery =
  | { status: "skip" }
  | { status: "unknown" }
  | { status: "models"; models: Array<ChatModelInfo> }

/**
 * Lists models a configured provider can offer in Add models.
 * Custom providers, including Command Code and Google GenAI, load
 * `GET {baseUrl}/models`. The reserved OpenAI Chat Completions slot and
 * named OCC instances stay on their configured ids.
 */
export async function discoverConfiguredProviderModels(
  userId: string | undefined,
  providerId: string
): Promise<ProviderModelDiscovery> {
  if (isCustomProviderId(providerId) || isNamedOccInstanceId(providerId)) {
    return discoverInstanceModels(userId, providerId)
  }
  if (providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) {
    return discoverReservedOccModels(userId)
  }
  return { status: "skip" }
}

async function discoverInstanceModels(
  userId: string | undefined,
  providerId: string
): Promise<ProviderModelDiscovery> {
  const instance = useLocalProviderStore(userId)
    ? await getLocalProviderInstance(userId, providerId)
    : await getOccInstanceById(userId, providerId)
  if (!instance) return { status: "unknown" }

  const normalized = normalizeCustomProviderInstance(instance)
  if (isNamedOccInstanceId(providerId)) {
    return {
      status: "models",
      models: mergeDiscoveredModels(
        providerId,
        normalized.modelIds,
        [],
        normalized.api
      ),
    }
  }
  const remote = await loadRemoteModels(
    providerId,
    normalized.api,
    instance.baseUrl,
    () => loadInstanceApiKey(userId, providerId)
  )
  return {
    status: "models",
    models: mergeDiscoveredModels(
      providerId,
      normalized.modelIds,
      remote,
      normalized.api
    ),
  }
}

async function discoverReservedOccModels(
  userId: string | undefined
): Promise<ProviderModelDiscovery> {
  const config = await resolveOpenAiChatCompletionsConfig(userId)
  if (!config) return { status: "skip" }
  return {
    status: "models",
    models: mergeDiscoveredModels(
      OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
      config.modelIds,
      [],
      "openai-completions"
    ),
  }
}

async function loadInstanceApiKey(
  userId: string | undefined,
  providerId: string
): Promise<string | undefined> {
  if (useLocalProviderStore(userId)) {
    return loadLocalProviderInstanceApiKey(userId, providerId)
  }
  return loadOccInstanceApiKey(userId, providerId)
}

async function loadRemoteModels(
  providerId: string,
  api: PiCustomProviderApi,
  baseUrl: string,
  readApiKey: () => string | undefined | Promise<string | undefined>
): Promise<Array<RemoteOpenAiModel>> {
  if (!providerApiListsModels(api)) return []
  let safeBaseUrl: string
  try {
    safeBaseUrl = assertCustomProviderBaseUrl(api, baseUrl)
  } catch (error) {
    console.warn(
      `[models.discover] ${providerId} base URL rejected: ${errorMessage(error)}`
    )
    return []
  }
  let apiKey: string | undefined
  try {
    apiKey = await readApiKey()
  } catch (error) {
    console.warn(
      `[models.discover] ${providerId} API key unreadable: ${errorMessage(error)}`
    )
    return []
  }
  if (!apiKey) return []
  try {
    if (api === "google-genai") {
      return await listGoogleGenaiModels(safeBaseUrl, apiKey)
    }
    return await listOpenAiCompatibleModels(safeBaseUrl, apiKey)
  } catch (error) {
    console.warn(
      `[models.discover] ${providerId} model list failed: ${errorMessage(error)}`
    )
    return []
  }
}

function providerApiListsModels(api: PiCustomProviderApi): boolean {
  switch (api) {
    case "openai-completions":
    case "openai-responses":
    case "anthropic-messages":
    case "google-genai":
      return true
    default: {
      const exhaustive: never = api
      return exhaustive
    }
  }
}

function mergeDiscoveredModels(
  providerId: string,
  storedIds: Array<string>,
  remote: Array<RemoteOpenAiModel>,
  api: PiCustomProviderApi
): Array<ChatModelInfo> {
  const byId = new Map<string, ChatModelInfo>()
  for (const raw of storedIds) {
    const id = raw.trim()
    if (!id) continue
    byId.set(id, toDiscoveredModel(providerId, { id }))
  }
  for (const model of remote) {
    if (!modelSupportsProviderApi(model, api)) continue
    byId.set(
      model.id,
      toDiscoveredModel(providerId, {
        id: model.id,
        name: model.name,
        contextWindow: model.contextWindow,
      })
    )
  }
  return [...byId.values()]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toDiscoveredModel(
  providerId: string,
  model: { id: string; name?: string; contextWindow?: number }
): ChatModelInfo {
  return {
    key: `${providerId}/${model.id}`,
    provider: providerId,
    id: model.id,
    name: model.name?.trim() || model.id,
    reasoning: false,
    input: ["text"],
    available: true,
    ...(model.contextWindow !== undefined
      ? { contextWindow: model.contextWindow }
      : {}),
  }
}
