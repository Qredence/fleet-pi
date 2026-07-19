import type {
  AgentSessionServices,
  CompactionSettings,
  PackageSource,
  RetrySettings,
} from "@earendil-works/pi-coding-agent"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asStringArray(value: unknown): Array<string> | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === "string")
}

function asPackageSources(value: unknown): Array<PackageSource> | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter(
    (item): item is PackageSource => typeof item === "string" || isRecord(item)
  )
}

/**
 * Apply durable project settings onto a live SettingsManager without relying
 * on a writable `.pi/settings.json` (Vercel / Neon path).
 */
export function applyProjectSettingsToServices(
  services: AgentSessionServices,
  settings: Record<string, unknown>
) {
  const manager = services.settingsManager

  const packages = asPackageSources(settings.packages)
  if (packages) manager.setProjectPackages(packages)

  const skills = asStringArray(settings.skills)
  if (skills) manager.setProjectSkillPaths(skills)

  const extensions = asStringArray(settings.extensions)
  if (extensions) manager.setProjectExtensionPaths(extensions)

  const prompts = asStringArray(settings.prompts)
  if (prompts) manager.setProjectPromptTemplatePaths(prompts)

  const themes = asStringArray(settings.themes)
  if (themes) manager.setProjectThemePaths(themes)

  if (typeof settings.enableSkillCommands === "boolean") {
    manager.setEnableSkillCommands(settings.enableSkillCommands)
  }

  if (settings.enabledModels === null) {
    manager.setEnabledModels(undefined)
  } else {
    const enabledModels = asStringArray(settings.enabledModels)
    if (enabledModels) manager.setEnabledModels(enabledModels)
  }

  if (typeof settings.defaultProvider === "string") {
    manager.setDefaultProvider(settings.defaultProvider)
  }
  if (typeof settings.defaultModel === "string") {
    manager.setDefaultModel(settings.defaultModel)
  }
  if (
    typeof settings.defaultThinkingLevel === "string" &&
    ["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(
      settings.defaultThinkingLevel
    )
  ) {
    manager.setDefaultThinkingLevel(
      settings.defaultThinkingLevel as
        "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"
    )
  }

  if (
    settings.steeringMode === "all" ||
    settings.steeringMode === "one-at-a-time"
  ) {
    manager.setSteeringMode(settings.steeringMode)
  }
  if (
    settings.followUpMode === "all" ||
    settings.followUpMode === "one-at-a-time"
  ) {
    manager.setFollowUpMode(settings.followUpMode)
  }

  const runtimeOverrides = buildRuntimeSettingsOverrides(settings)
  if (Object.keys(runtimeOverrides).length > 0) {
    manager.applyOverrides(runtimeOverrides)
  }
}

function buildRuntimeSettingsOverrides(settings: Record<string, unknown>): {
  compaction?: CompactionSettings
  retry?: RetrySettings
  transport?: "auto" | "sse" | "websocket"
} {
  const overrides: {
    compaction?: CompactionSettings
    retry?: RetrySettings
    transport?: "auto" | "sse" | "websocket"
  } = {}

  if (isRecord(settings.compaction)) {
    const compaction: CompactionSettings = {}
    if (typeof settings.compaction.enabled === "boolean") {
      compaction.enabled = settings.compaction.enabled
    }
    if (typeof settings.compaction.reserveTokens === "number") {
      compaction.reserveTokens = settings.compaction.reserveTokens
    }
    if (typeof settings.compaction.keepRecentTokens === "number") {
      compaction.keepRecentTokens = settings.compaction.keepRecentTokens
    }
    if (Object.keys(compaction).length > 0) {
      overrides.compaction = compaction
    }
  }

  if (isRecord(settings.retry)) {
    const retry: RetrySettings = {}
    if (typeof settings.retry.enabled === "boolean") {
      retry.enabled = settings.retry.enabled
    }
    if (typeof settings.retry.maxRetries === "number") {
      retry.maxRetries = settings.retry.maxRetries
    }
    if (typeof settings.retry.baseDelayMs === "number") {
      retry.baseDelayMs = settings.retry.baseDelayMs
    }
    if (Object.keys(retry).length > 0) {
      overrides.retry = retry
    }
  }

  if (
    settings.transport === "auto" ||
    settings.transport === "sse" ||
    settings.transport === "websocket"
  ) {
    overrides.transport = settings.transport
  }

  return overrides
}
