import { isModelPatternEnabled } from "@workspace/pi-protocol/model-patterns"
import { collectDiagnostics, resolveDefaultModelSelection } from "./diagnostics"
import { createSessionServices } from "./session-factory"
import type {
  AgentSessionRuntime,
  AgentSessionServices,
} from "@earendil-works/pi-coding-agent"
import type { Model } from "@earendil-works/pi-ai"
import type {
  ChatModelInfo,
  ChatModelSelection,
  ChatModelsResponse,
  ChatThinkingLevel,
} from "@workspace/pi-protocol/chat-protocol"

const THINKING_LEVELS = new Set<ChatThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
])

export type LoadChatModelsOptions = {
  /**
   * `enabled` (default): models allowed by `enabledModels` for the chat picker.
   * `all`: full registry catalog for Settings discovery / curation (not filtered).
   */
  scope?: "enabled" | "all"
  userId?: string
}

export async function loadChatModels(
  context: Parameters<typeof createSessionServices>[0],
  options?: LoadChatModelsOptions
): Promise<ChatModelsResponse> {
  const scope = options?.scope ?? "enabled"
  const services = await createSessionServices(context, undefined, {
    userId: options?.userId,
    projectRoot: context.projectRoot,
  })
  const available = services.modelRegistry.getAvailable()
  const availableKeys = new Set(available.map(modelKey))
  const all = services.modelRegistry.getAll()
  const enabledPatterns = services.settingsManager.getEnabledModels()
  const sourceModels = available.length > 0 ? available : all
  const catalog = sourceModels.map((model) =>
    toChatModelInfo(
      model,
      available.length === 0 || availableKeys.has(modelKey(model)),
      services.settingsManager.getDefaultThinkingLevel()
    )
  )
  const models =
    scope === "all"
      ? catalog
      : catalog.filter((model) => isChatModelEnabled(model, enabledPatterns))
  const { defaultProvider, defaultModel } = resolveDefaultModelSelection(
    services.settingsManager
  )
  const defaultThinkingLevel = normalizeThinkingLevel(
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
  const selected = pickSelectedChatModel(models, defaultProvider, defaultModel)

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
  selection?: ChatModelSelection
) {
  const { model, thinkingLevel } = resolveModelSelection(
    runtime.services,
    selection
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

  if (thinkingLevel) {
    runtime.session.setThinkingLevel(thinkingLevel)
  }
}

export function resolveModelSelection(
  services: AgentSessionServices,
  selection?: ChatModelSelection
) {
  if (!selection) return {}

  const thinkingLevel =
    typeof selection === "object"
      ? normalizeThinkingLevel(selection.thinkingLevel)
      : undefined
  const model =
    typeof selection === "string"
      ? resolveLegacyModelSelection(services, selection)
      : resolveStructuredModelSelection(
          services,
          selection.provider,
          selection.id
        )

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
  const all = services.modelRegistry.getAll()
  const available = services.modelRegistry.getAvailable()

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

function resolveStructuredModelSelection(
  services: AgentSessionServices,
  provider: string,
  id: string
) {
  if (provider !== "amazon-bedrock") {
    const direct = services.modelRegistry.find(provider, id)
    const available = services.modelRegistry.getAvailable()
    if (
      direct &&
      available.some((model) => modelKey(model) === modelKey(direct))
    ) {
      return direct
    }

    const sameIdAvailable = available.find((model) => model.id === id)
    if (sameIdAvailable) return sameIdAvailable

    return direct
  }

  return bedrockModelCandidates(id)
    .map((candidate) => services.modelRegistry.find(provider, candidate))
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

  const sameIdAvailable = models.find(
    (model) => model.id === defaultModel && model.available
  )
  if (sameIdAvailable) return sameIdAvailable

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

function normalizeThinkingLevel(value: unknown): ChatThinkingLevel | undefined {
  return typeof value === "string" &&
    THINKING_LEVELS.has(value as ChatThinkingLevel)
    ? (value as ChatThinkingLevel)
    : undefined
}

function modelKey(model: Pick<Model<any>, "provider" | "id">) {
  return `${model.provider}/${model.id}`
}

function modelKeyFromParts(provider: string, id: string) {
  return `${provider}/${id}`
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
    defaultThinkingLevel: normalizeThinkingLevel(defaultThinkingLevel),
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
