import { isModelEnabled, modelPattern } from "./model-patterns"
import type {
  ChatPackageSource,
  ChatPiSettings,
  ChatPiSettingsUpdate,
  ChatResourcesResponse,
} from "../../../../../lib/pi/chat-protocol"
import type { ConfigModelInfo, ProviderSummary } from "./types"

export function modelSettings(settings: ChatPiSettings): ChatPiSettingsUpdate {
  return {
    defaultProvider: settings.defaultProvider,
    defaultModel: settings.defaultModel,
    defaultThinkingLevel: settings.defaultThinkingLevel,
    enabledModels:
      settings.enabledModels === undefined
        ? null
        : sanitizeStringList(settings.enabledModels),
  }
}

export function runtimeSettings(
  settings: ChatPiSettings
): ChatPiSettingsUpdate {
  return {
    compaction: settings.compaction,
    retry: settings.retry,
    steeringMode: settings.steeringMode,
    followUpMode: settings.followUpMode,
    transport: settings.transport,
  }
}

export function resourceSettings(
  settings: ChatPiSettings
): ChatPiSettingsUpdate {
  return {
    packages: settings.packages,
    extensions: sanitizeStringList(settings.extensions),
    skills: sanitizeStringList(settings.skills),
    prompts: sanitizeStringList(settings.prompts),
    themes: sanitizeStringList(settings.themes),
    enableSkillCommands: settings.enableSkillCommands,
  }
}

export function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function summarizeResources(resources: ChatResourcesResponse | null) {
  const catalog = resources
    ? [
        ...resources.skills,
        ...resources.prompts,
        ...resources.extensions,
        ...resources.packages,
        ...resources.themes,
        ...resources.agentsFiles,
      ]
    : []

  return {
    active: catalog.filter((item) => item.activationStatus === "active").length,
    staged: catalog.filter((item) => item.activationStatus === "staged").length,
    reloadRequired: catalog.filter(
      (item) => item.activationStatus === "reload-required"
    ).length,
    diagnostics: resources?.diagnostics ?? [],
    total: catalog.length,
  }
}

export function formatPackageSourceRows(values: Array<ChatPackageSource>) {
  return values.map((item) =>
    typeof item === "string" ? item : JSON.stringify(item)
  )
}

export function parsePackageSourceRows(
  rows: Array<string>
): Array<ChatPackageSource> {
  return rows
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (!line.startsWith("{")) return line
      const parsed = JSON.parse(line) as unknown
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Package JSON entries must be objects.")
      }
      return parsed as Record<string, unknown>
    })
}

export function addUnique(values: Array<string>, value: string) {
  return values.includes(value) ? values : [...values, value]
}

export function sanitizeStringList(values: Array<string>) {
  return values.map((item) => item.trim()).filter(Boolean)
}

export function recommendedModelPatterns(
  settings: Pick<ChatPiSettings, "defaultModel" | "defaultProvider">
) {
  return settings.defaultProvider && settings.defaultModel
    ? [modelPattern(settings.defaultProvider, settings.defaultModel)]
    : []
}

export function summarizeProviders(
  models: Array<ConfigModelInfo>,
  enabledPatterns: Array<string> | undefined
): Array<ProviderSummary> {
  const providers = new Map<string, ProviderSummary>()
  for (const model of models) {
    const current = providers.get(model.provider) ?? {
      active: 0,
      available: 0,
      provider: model.provider,
      total: 0,
    }
    current.total += 1
    if (model.available !== false) current.available += 1
    if (isModelEnabled(model, enabledPatterns)) current.active += 1
    providers.set(model.provider, current)
  }
  return [...providers.values()].sort((left, right) =>
    left.provider.localeCompare(right.provider)
  )
}
