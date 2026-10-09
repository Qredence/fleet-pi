import {
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
  isOccProviderId,
} from "@workspace/pi-protocol/provider-catalog"
import { isModelPatternEnabled } from "@workspace/pi-protocol/model-patterns"
import { collectDiagnostics, resolveDefaultModelSelection } from "./diagnostics"
import {
  reconcileOpenAiChatCompletionsModel,
  reconcileRuntimeOccModel,
} from "./openai-chat-completions-compat"
import { resolveDefaultChatModel } from "./default-chat-model"
import { createSessionServices } from "./session-factory"
import { normalizeChatThinkingLevel } from "./thinking-level"
import type {
  AgentSessionRuntime,
  AgentSessionServices,
} from "@earendil-works/pi-coding-agent"
import type { Model } from "@earendil-works/pi-ai"
import type {
  ChatModelInfo,
  ChatModelSelection,
  ChatModelsResponse,
} from "@workspace/pi-protocol/chat-protocol"
import { listOccInstances } from "@/lib/db/occ-instances"
import {
  listLocalProviderInstances,
  useLocalProviderStore,
} from "@/lib/db/local-provider-instances"

export type LoadChatModelsOptions = {
  /**
   * `enabled` (default): models allowed by `enabledModels` for the chat picker.
   * `all`: full registry catalog for Settings discovery / curation (not filtered).
   */
  scope?: "enabled" | "all"
  userId?: string
}

/**
 * Loads chat model metadata, defaults, selection, and diagnostics for a session.
 *
 * @param context - Context used to create session services and discover models
 * @param options - Optional scope and user identity used to load models
 * @returns The discovered models, configured defaults, selected model key, and diagnostics
 */
export async function loadChatModels(
  context: Parameters<typeof createSessionServices>[0],
  options?: LoadChatModelsOptions
): Promise<ChatModelsResponse> {
  const scope = options?.scope ?? "enabled"
  const services = await createSessionServices(context, undefined, {
    userId: options?.userId,
    projectRoot: context.projectRoot,
  })
  const { applyRuntimeAuth } = await import("./session-factory")
  await applyRuntimeAuth(services, { userId: options?.userId })
  const available = await services.modelRuntime.getAvailable()
  const availableKeys = new Set(available.map(modelKey))
  const all = services.modelRuntime.getModels()
  const enabledPatterns = services.settingsManager.getEnabledModels()
  const sourceModels = available.length > 0 ? available : all
  const catalog = sourceModels.map((model) =>
    toChatModelInfo(
      model,
      available.length === 0 || availableKeys.has(modelKey(model)),
      services.settingsManager.getDefaultThinkingLevel()
    )
  )
  let models: Array<ChatModelInfo>
  if (scope === "all") {
    models = catalog
  } else {
    const addedModelKeys = await resolveAppAddedModelKeys(
      services,
      options?.userId
    )
    models = catalog.filter(
      (model) =>
        addedModelKeys.has(model.key) &&
        isChatModelEnabled(model, enabledPatterns)
    )
  }
  const { defaultProvider, defaultModel } = resolveDefaultModelSelection(
    services.settingsManager
  )
  const defaultThinkingLevel = normalizeChatThinkingLevel(
    services.settingsManager.getDefaultThinkingLevel()
  )
  const defaultModelExists = models.some(
    (model) => model.provider === defaultProvider && model.id === defaultModel
  )
  const hasAvailableModelWithDefaultId = models.some(
    (model) => model.id === defaultModel && model.available
  )
  if (
    !defaultModelExists &&
    defaultProvider &&
    defaultModel &&
    !hasAvailableModelWithDefaultId
  ) {
    models.unshift({
      key: modelKeyFromParts(defaultProvider, defaultModel),
      provider: defaultProvider,
      id: defaultModel,
      name: defaultModel,
      reasoning: false,
      input: ["text"],
      available: false,
      defaultThinkingLevel,
    })
  }
  const selected =
    defaultProvider && defaultModel
      ? pickSelectedChatModel(models, defaultProvider, defaultModel)
      : undefined

  return {
    models,
    selectedModelKey: selected?.key ?? "",
    defaultProvider,
    defaultModel,
    defaultThinkingLevel,
    diagnostics: collectDiagnostics(services),
  }
}

export async function applyModelSelection(
  runtime: AgentSessionRuntime,
  selection?: ChatModelSelection,
  userId?: string
) {
  const { model, thinkingLevel } = resolveModelSelection(
    runtime.services,
    selection,
    userId
  )

  if (
    model &&
    runtime.session.model &&
    modelKey(runtime.session.model) !== modelKey(model)
  ) {
    await runtime.session.setModel(model)
  } else if (model && !runtime.session.model) {
    await runtime.session.setModel(model)
  }

  reconcileRuntimeOccModel(runtime, userId)

  if (thinkingLevel) {
    runtime.session.setThinkingLevel(thinkingLevel)
  }
}

/**
 * Server-side model for a new chat session that arrived without a model
 * selection (e.g. a message sent before the client model picker loaded).
 * Uses the configured settings default when its provider has auth, otherwise
 * the first authenticated model the app registered and the user enabled, and
 * throws `NoChatModelAvailableError` instead of falling back blindly to Pi's
 * per-provider defaults.
 */
export async function resolveServerDefaultChatModel(
  services: AgentSessionServices,
  userId?: string
): Promise<Model<any>> {
  const { defaultProvider, defaultModel } = resolveDefaultModelSelection(
    services.settingsManager
  )
  const configuredDefault =
    defaultProvider && defaultModel
      ? reconcileOpenAiChatCompletionsModel(
          services,
          resolveStructuredModelSelection(
            services,
            defaultProvider,
            defaultModel
          ),
          userId
        )
      : undefined
  const enabledPatterns = services.settingsManager.getEnabledModels()
  const preferredKeys = await resolveAppAddedModelKeys(services, userId).catch(
    () => new Set<string>()
  )

  return resolveDefaultChatModel({
    modelRuntime: services.modelRuntime,
    configuredDefault,
    preferredKeys,
    isEnabled: (model) =>
      isChatModelEnabled(
        toChatModelInfo(model, true, undefined),
        enabledPatterns
      ),
  })
}

export function resolveModelSelection(
  services: AgentSessionServices,
  selection?: ChatModelSelection,
  userId?: string
) {
  if (!selection) return {}

  const thinkingLevel =
    typeof selection === "object"
      ? normalizeChatThinkingLevel(selection.thinkingLevel)
      : undefined
  const resolved =
    typeof selection === "string"
      ? resolveLegacyModelSelection(services, selection)
      : resolveStructuredModelSelection(
          services,
          selection.provider,
          selection.id
        )
  const model = reconcileOpenAiChatCompletionsModel(services, resolved, userId)

  return { model, thinkingLevel }
}

function resolveLegacyModelSelection(
  services: AgentSessionServices,
  selection: string
) {
  const [provider, ...modelParts] = selection.split("/")
  if (provider && modelParts.length > 0) {
    const model = resolveStructuredModelSelection(
      services,
      provider,
      modelParts.join("/")
    )
    if (model) return model
  }

  const withoutRegionPrefix = selection.replace(/^(us|eu|au|global)\./, "")
  const withoutSuffix = selection.replace(/\[[^\]]+\]$/, "")
  const normalized = withoutRegionPrefix.replace(/\[[^\]]+\]$/, "")
  const candidates = bedrockModelCandidates(selection, [
    withoutSuffix,
    withoutRegionPrefix,
    normalized,
  ])
  const all = services.modelRuntime.getModels()
  const available = services.modelRuntime.getAvailableSnapshot()

  return (
    candidates
      .map((candidate) =>
        all.find(
          (model) =>
            model.provider === "amazon-bedrock" && model.id === candidate
        )
      )
      .find((model): model is Model<any> => model !== undefined) ??
    candidates
      .map(
        (candidate) =>
          available.find((model) => model.id === candidate) ??
          all.find((model) => model.id === candidate)
      )
      .find((model): model is Model<any> => model !== undefined)
  )
}

/**
 * Resolves a structured provider and model identifier to a runtime model.
 *
 * OpenAI selections may resolve to a matching OpenAI-compatible provider, while
 * Amazon Bedrock selections support normalized regional model identifiers.
 *
 * @param provider - The model provider identifier
 * @param id - The model identifier
 * @returns The matching runtime model, or `undefined` when no model is found
 */
function resolveStructuredModelSelection(
  services: AgentSessionServices,
  provider: string,
  id: string
) {
  if (provider !== "amazon-bedrock") {
    const direct = services.modelRuntime.getModel(provider, id)
    const available = services.modelRuntime.getAvailableSnapshot()
    if (
      direct &&
      available.some((model) => modelKey(model) === modelKey(direct))
    ) {
      return direct
    }

    if (provider === "openai") {
      for (const candidate of available) {
        if (isOccProviderId(candidate.provider) && candidate.id === id) {
          const occ = services.modelRuntime.getModel(candidate.provider, id)
          if (occ) return occ
        }
      }
    }

    return direct
  }

  return bedrockModelCandidates(id)
    .map((candidate) => services.modelRuntime.getModel(provider, candidate))
    .find((model): model is Model<any> => model !== undefined)
}

function bedrockModelCandidates(id: string, extra: Array<string> = []) {
  const hasRegionPrefix = /^(us|eu|au|global)\./.test(id)
  const normalized = id.replace(/^(us|eu|au|global)\./, "")
  const candidates = hasRegionPrefix
    ? [id, normalized, ...extra]
    : [`us.${id}`, `global.${id}`, id, ...extra]
  return [...new Set(candidates)]
}

/**
 * Selects the chat model that best matches the configured provider and model.
 *
 * @param models - The available chat models to search
 * @param defaultProvider - The configured model provider
 * @param defaultModel - The configured model identifier
 * @returns The matching chat model, the first available model, or the first model when no match is found
 */
function pickSelectedChatModel(
  models: Array<ChatModelInfo>,
  defaultProvider: string,
  defaultModel: string
) {
  if (models.length === 0) return undefined

  const exact = models.find(
    (model) => model.provider === defaultProvider && model.id === defaultModel
  )
  if (exact?.available) return exact

  if (defaultProvider === "openai") {
    const occMatch = models.find(
      (model) =>
        isOccProviderId(model.provider) &&
        model.id === defaultModel &&
        model.available
    )
    if (occMatch) return occMatch
  }

  if (exact) return exact

  if (defaultProvider === "amazon-bedrock") {
    const bedrockMatch = findChatModelByCandidates(
      models,
      bedrockModelCandidates(defaultModel)
    )
    if (bedrockMatch) return bedrockMatch
  }

  return models.find((model) => model.available) ?? models[0]
}

function findChatModelByCandidates(
  models: Array<ChatModelInfo>,
  candidates: Array<string>
) {
  return candidates
    .map((candidate) => models.find((model) => model.id === candidate))
    .find((model): model is ChatModelInfo => model !== undefined)
}

function modelKey(model: Pick<Model<any>, "provider" | "id">) {
  return `${model.provider}/${model.id}`
}

function modelKeyFromParts(provider: string, id: string) {
  return `${provider}/${id}`
}

/**
 * The exact model keys the app registered for this user: the reserved OpenAI
 * Chat Completions slot (its BYOK model id, or the Neon AI Gateway defaults
 * when the gateway backs the slot) plus each custom provider instance's model
 * ids. The composer picker ("enabled" scope) is scoped to these keys instead
 * of the whole Pi registry catalog, which also includes models from providers
 * whose credentials live only in Pi's own auth store and were never added in
 * Fleet Pi Settings.
 */
async function resolveAppAddedModelKeys(
  services: AgentSessionServices,
  userId: string | undefined
) {
  const addedKeys = new Set<string>()
  for (const model of services.modelRuntime.getModels(
    OPENAI_CHAT_COMPLETIONS_PROVIDER_ID
  )) {
    addedKeys.add(modelKey(model))
  }
  // Mirror the custom-provider-registry store selection: DB-backed accounts
  // (and deployed surfaces) read `pi_user_providers`; anonymous/local dev
  // accounts read the gitignored file store.
  const instances = useLocalProviderStore(userId)
    ? await listLocalProviderInstances(userId)
    : await listOccInstances(userId)
  for (const instance of instances) {
    for (const model of services.modelRuntime.getModels(instance.id)) {
      addedKeys.add(modelKey(model))
    }
  }
  return addedKeys
}

function toChatModelInfo(
  model: Model<any>,
  available: boolean,
  defaultThinkingLevel: string | undefined
): ChatModelInfo {
  return {
    key: modelKey(model),
    provider: model.provider,
    id: model.id,
    name: model.name,
    reasoning: Boolean(model.reasoning),
    input: model.input,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    available,
    defaultThinkingLevel: normalizeChatThinkingLevel(defaultThinkingLevel),
  }
}

function isChatModelEnabled(
  model: ChatModelInfo,
  patterns: Array<string> | undefined
) {
  return isModelPatternEnabled(
    {
      id: model.id,
      name: model.name,
      key: model.key,
      provider: model.provider,
      modelId: model.id,
    },
    patterns
  )
}
