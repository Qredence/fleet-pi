import { basename, dirname, extname } from "node:path"
import { collectResourceExpectationDiagnostics } from "./resource-expectations"
import {
  DEFAULT_BEDROCK_MODEL,
  collectDiagnostics,
  createSessionServices,
} from "./server-shared"
import {
  applyWorkspaceResourceMetadata,
  loadWorkspaceResourceCatalog,
  mergeResourceInfo,
  readWorkspacePiSettings,
} from "./workspace-resource-catalog"
import type {
  AgentSessionRuntime,
  AgentSessionServices,
  PromptTemplate,
  Skill,
} from "@earendil-works/pi-coding-agent"
import type { Model } from "@earendil-works/pi-ai"
import type {
  ChatModelInfo,
  ChatModelSelection,
  ChatModelsResponse,
  ChatResourcesResponse,
  ChatThinkingLevel,
} from "./chat-protocol"
import type { AppRuntimeContext } from "@/lib/app-runtime"

const THINKING_LEVELS = new Set<ChatThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
])

export async function loadChatModels(
  context: AppRuntimeContext
): Promise<ChatModelsResponse> {
  const services = await createSessionServices(context)
  const available = services.modelRegistry.getAvailable()
  const availableKeys = new Set(available.map(modelKey))
  const all = services.modelRegistry.getAll()
  const models = (available.length > 0 ? available : all).map((model) =>
    toChatModelInfo(
      model,
      available.length === 0 || availableKeys.has(modelKey(model)),
      services.settingsManager.getDefaultThinkingLevel()
    )
  )
  const defaultProvider =
    services.settingsManager.getDefaultProvider() ?? "amazon-bedrock"
  const defaultModel =
    services.settingsManager.getDefaultModel() ?? DEFAULT_BEDROCK_MODEL
  const defaultThinkingLevel = normalizeThinkingLevel(
    services.settingsManager.getDefaultThinkingLevel()
  )
  const defaultModelExists = models.some(
    (model) => model.provider === defaultProvider && model.id === defaultModel
  )
  if (!defaultModelExists && defaultProvider && defaultModel) {
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
    models.length > 0
      ? (models.find(
          (model) =>
            model.provider === defaultProvider && model.id === defaultModel
        ) ??
        (defaultProvider === "amazon-bedrock"
          ? findChatModelByCandidates(
              models,
              bedrockModelCandidates(defaultModel)
            )
          : undefined) ??
        models[0])
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

export async function loadChatResources(
  context: AppRuntimeContext
): Promise<ChatResourcesResponse> {
  const services = await createSessionServices(context)
  const workspaceSettings = await readWorkspacePiSettings(context.projectRoot)
  const skills = services.resourceLoader.getSkills()
  const prompts = services.resourceLoader.getPrompts()
  const extensions = services.resourceLoader.getExtensions()
  const themes = services.resourceLoader.getThemes()
  const agentsFiles = services.resourceLoader.getAgentsFiles()
  const workspaceResources = await loadWorkspaceResourceCatalog(context)

  const response: ChatResourcesResponse = {
    packages: workspaceResources.packages,
    skills: mergeResourceInfo(
      context.projectRoot,
      skills.skills.map((skill) =>
        applyWorkspaceResourceMetadata(
          context.projectRoot,
          workspaceSettings,
          skillToResourceInfo(skill)
        )
      ),
      workspaceResources.skills
    ),
    prompts: mergeResourceInfo(
      context.projectRoot,
      prompts.prompts.map((prompt) =>
        applyWorkspaceResourceMetadata(
          context.projectRoot,
          workspaceSettings,
          promptToResourceInfo(prompt)
        )
      ),
      workspaceResources.prompts
    ),
    extensions: mergeResourceInfo(
      context.projectRoot,
      extensions.extensions.map((extension) =>
        applyWorkspaceResourceMetadata(context.projectRoot, workspaceSettings, {
          name: extensionNameFromPath(extension.path),
          path: extension.resolvedPath,
          source: getSource(extension),
        })
      ),
      workspaceResources.extensions
    ),
    themes: themes.themes.map((theme) => {
      const resource = theme as unknown as Record<string, unknown>
      return {
        name: stringValue(resource.name) ?? stringValue(resource.id) ?? "Theme",
        path: stringValue(resource.filePath) ?? stringValue(resource.path),
      }
    }),
    agentsFiles: agentsFiles.agentsFiles.map((file) => ({
      name: basename(file.path),
      path: file.path,
    })),
    diagnostics: collectDiagnostics(services),
  }

  return {
    ...response,
    diagnostics: [
      ...new Set([
        ...response.diagnostics,
        ...collectResourceExpectationDiagnostics(response),
      ]),
    ],
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
    const model = services.modelRegistry.find(provider, modelParts.join("/"))
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
      .map((candidate) => all.find((model) => model.id === candidate))
      .find((model): model is Model<any> => model !== undefined)
  )
}

function resolveStructuredModelSelection(
  services: AgentSessionServices,
  provider: string,
  id: string
) {
  if (provider !== "amazon-bedrock") {
    return services.modelRegistry.find(provider, id)
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

function skillToResourceInfo(skill: Skill) {
  return {
    name: skill.name,
    description: skill.description,
    path: skill.filePath,
    source: getSource(skill),
  }
}

function promptToResourceInfo(prompt: PromptTemplate) {
  return {
    name: prompt.name,
    description: prompt.description,
    path: prompt.filePath,
    source: getSource(prompt),
    argumentHint: prompt.argumentHint,
  }
}

function extensionNameFromPath(path: string | undefined) {
  if (!path) return "Resource"

  const fileName = basename(path)
  if (fileName.toLowerCase() === "index.ts") {
    return basename(dirname(path))
  }

  const extension = extname(fileName)
  return extension ? fileName.slice(0, -extension.length) : fileName
}

function getSource(resource: { sourceInfo?: unknown }) {
  const sourceInfo = resource.sourceInfo
  if (!sourceInfo || typeof sourceInfo !== "object") return undefined
  return stringValue((sourceInfo as Record<string, unknown>).source)
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}
