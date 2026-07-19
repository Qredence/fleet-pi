import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { ChatPiSettingsUpdateSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import {
  loadPersistedProjectSettingsOverrides,
  sanitizePortableResourcePaths,
} from "./durable-project-settings"
import { collectDiagnostics, resolveDefaultModelSelection } from "./diagnostics"
import {
  hotReloadActiveRuntimes,
  hotReloadActiveRuntimesForUser,
} from "./hot-reload"
import { prepareProjectSettingsForPersist } from "./project-settings-persist"
import {
  PROJECT_SETTINGS_PATH,
  projectSettingsPath,
} from "./project-settings-file"
import { createSessionServices } from "./session-factory"
import { normalizeChatThinkingLevel } from "./thinking-level"
import { RESOURCE_SETTING_KEYS } from "./types"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import type {
  ChatPiSettings,
  ChatPiSettingsUpdate,
  ChatSettingsResponse,
  ChatTransport,
} from "@workspace/pi-protocol/chat-protocol"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import { upsertUserProjectSettings } from "@/lib/db/user-settings"

export {
  hydrateSessionServicesSettings,
  isPortableSettingsResourcePath,
  loadPersistedProjectSettingsOverrides,
  resolveProjectSettings,
  sanitizePortableResourcePaths,
} from "./durable-project-settings"

export { readProjectSettingsFile } from "./project-settings-file"

export async function loadChatSettings(
  context: AppRuntimeContext,
  options?: { userId?: string }
): Promise<ChatSettingsResponse> {
  const services = await createSessionServices(context, undefined, {
    userId: options?.userId,
    projectRoot: context.projectRoot,
  })
  const projectOverrides = await loadPersistedProjectSettingsOverrides({
    userId: options?.userId,
    projectRoot: context.projectRoot,
  })
  const project = toEditableProjectSettings(projectOverrides)

  return {
    diagnostics: collectDiagnostics(services),
    effective: toEffectiveSettings(services.settingsManager, projectOverrides),
    project,
    projectPath: PROJECT_SETTINGS_PATH,
    updateImpact: {
      newSessionRecommended: false,
      resourceReloadRequired: false,
    },
  }
}

export async function updateChatSettings(
  context: AppRuntimeContext,
  update: ChatPiSettingsUpdate,
  options?: { userId?: string; skipHotReload?: boolean }
): Promise<ChatSettingsResponse> {
  const parsedUpdate = ChatPiSettingsUpdateSchema.parse(update)
  const settingsPath = projectSettingsPath(context.projectRoot)
  const currentOverrides = await loadPersistedProjectSettingsOverrides({
    userId: options?.userId,
    projectRoot: context.projectRoot,
  })
  const patchedOverrides = sanitizePortableResourcePaths(
    patchProjectSettingsOverrides(currentOverrides, parsedUpdate)
  )
  const toPersist = prepareProjectSettingsForPersist(patchedOverrides)

  await persistCompactProjectSettings(settingsPath, toPersist, options?.userId)

  if (!options?.skipHotReload) {
    if (options?.userId) {
      await hotReloadActiveRuntimesForUser(
        options.userId,
        parsedUpdate,
        context.projectRoot
      )
    } else if (process.env.VERCEL !== "1") {
      await hotReloadActiveRuntimes(parsedUpdate, context.projectRoot)
    }
  }

  const response = await loadChatSettings(context, { userId: options?.userId })
  return {
    ...response,
    updateImpact: impactForSettings(parsedUpdate),
  }
}

export async function saveProjectSettingsOverrides(
  context: AppRuntimeContext,
  overrides: Record<string, unknown>,
  options?: { userId?: string }
) {
  const settingsPath = projectSettingsPath(context.projectRoot)
  const toPersist = prepareProjectSettingsForPersist(overrides)
  await persistCompactProjectSettings(settingsPath, toPersist, options?.userId)
}

async function persistCompactProjectSettings(
  settingsPath: string,
  toPersist: Record<string, unknown>,
  userId?: string
) {
  if (process.env.VERCEL === "1") {
    if (!userId) {
      throw new Error(
        "Authentication is required to save Pi settings on Vercel."
      )
    }
    await upsertUserProjectSettings(userId, toPersist)
    return
  }

  await mkdir(dirname(settingsPath), { recursive: true })
  await writeFile(
    settingsPath,
    `${JSON.stringify(toPersist, null, 2)}\n`,
    "utf8"
  )
}

export function patchProjectSettingsOverrides(
  current: Record<string, unknown>,
  update: ChatPiSettingsUpdate
) {
  const next = { ...current }

  assignString(next, "defaultProvider", update.defaultProvider)
  assignString(next, "defaultModel", update.defaultModel)
  assignString(next, "defaultThinkingLevel", update.defaultThinkingLevel)
  assignOptionalArray(next, "enabledModels", update.enabledModels)
  assignArray(next, "packages", update.packages)
  assignArray(next, "extensions", update.extensions)
  assignArray(next, "skills", update.skills)
  assignArray(next, "prompts", update.prompts)
  assignArray(next, "themes", update.themes)
  assignString(next, "steeringMode", update.steeringMode)
  assignString(next, "followUpMode", update.followUpMode)
  assignString(next, "transport", update.transport)

  if (update.enableSkillCommands !== undefined) {
    next.enableSkillCommands = update.enableSkillCommands
  }
  if (update.compaction) {
    next.compaction = {
      ...(isRecord(next.compaction) ? next.compaction : {}),
      ...update.compaction,
    }
  }
  if (update.retry) {
    next.retry = {
      ...(isRecord(next.retry) ? next.retry : {}),
      ...update.retry,
    }
  }

  return next
}

export function impactForSettings(settings: ChatPiSettingsUpdate) {
  return {
    newSessionRecommended: Object.keys(settings).length > 0,
    resourceReloadRequired: RESOURCE_SETTING_KEYS.some(
      (key) => settings[key] !== undefined
    ),
  }
}

function toEffectiveSettings(
  settingsManager: AgentSessionServices["settingsManager"],
  projectOverrides: Record<string, unknown> = {}
): ChatPiSettings {
  const compaction = settingsManager.getCompactionSettings()
  const retry = settingsManager.getRetrySettings()
  const { defaultModel, defaultProvider } =
    resolveDefaultModelSelection(settingsManager)

  const enabledFromManager = settingsManager.getEnabledModels()
  const enabledFromProject = Array.isArray(projectOverrides.enabledModels)
    ? projectOverrides.enabledModels.filter(
        (item): item is string => typeof item === "string"
      )
    : undefined

  return {
    compaction: {
      enabled: compaction.enabled,
      reserveTokens: compaction.reserveTokens,
      keepRecentTokens: compaction.keepRecentTokens,
    },
    defaultModel:
      typeof projectOverrides.defaultModel === "string"
        ? projectOverrides.defaultModel
        : defaultModel,
    defaultProvider:
      typeof projectOverrides.defaultProvider === "string"
        ? projectOverrides.defaultProvider
        : defaultProvider,
    defaultThinkingLevel: normalizeChatThinkingLevel(
      typeof projectOverrides.defaultThinkingLevel === "string"
        ? projectOverrides.defaultThinkingLevel
        : settingsManager.getDefaultThinkingLevel()
    ),
    enableSkillCommands: settingsManager.getEnableSkillCommands(),
    // Neon / file overrides win when present — SettingsManager can still
    // surface a stale shipped `.pi/settings.json` project allowlist.
    enabledModels: enabledFromProject ?? enabledFromManager,
    extensions: settingsManager.getExtensionPaths(),
    followUpMode: settingsManager.getFollowUpMode(),
    packages: settingsManager.getPackages(),
    prompts: settingsManager.getPromptTemplatePaths(),
    retry: {
      enabled: retry.enabled,
      maxRetries: retry.maxRetries,
      baseDelayMs: retry.baseDelayMs,
    },
    skills: settingsManager.getSkillPaths(),
    steeringMode: settingsManager.getSteeringMode(),
    themes: settingsManager.getThemePaths(),
    transport: normalizeTransport(settingsManager.getTransport()),
  }
}

function toEditableProjectSettings(
  settings: Record<string, unknown>
): ChatPiSettingsUpdate {
  const project: ChatPiSettingsUpdate = {}

  copyString(settings, project, "defaultProvider")
  copyString(settings, project, "defaultModel")
  copyString(settings, project, "defaultThinkingLevel")
  copyStringArray(settings, project, "enabledModels")
  copyStringArray(settings, project, "extensions")
  copyStringArray(settings, project, "skills")
  copyStringArray(settings, project, "prompts")
  copyStringArray(settings, project, "themes")
  copyString(settings, project, "steeringMode")
  copyString(settings, project, "followUpMode")
  copyString(settings, project, "transport")

  if (Array.isArray(settings.packages)) {
    project.packages = settings.packages.filter(
      (item): item is ChatPiSettings["packages"][number] =>
        typeof item === "string" || isRecord(item)
    )
  }
  if (typeof settings.enableSkillCommands === "boolean") {
    project.enableSkillCommands = settings.enableSkillCommands
  }
  if (isRecord(settings.compaction)) {
    const compaction: ChatPiSettingsUpdate["compaction"] = {}
    copyBoolean(settings.compaction, compaction, "enabled")
    copyNumber(settings.compaction, compaction, "reserveTokens")
    copyNumber(settings.compaction, compaction, "keepRecentTokens")
    project.compaction = compaction
  }
  if (isRecord(settings.retry)) {
    const retry: ChatPiSettingsUpdate["retry"] = {}
    copyBoolean(settings.retry, retry, "enabled")
    copyNumber(settings.retry, retry, "maxRetries")
    copyNumber(settings.retry, retry, "baseDelayMs")
    project.retry = retry
  }

  return project
}

function assignString(
  target: Record<string, unknown>,
  key: string,
  value: string | undefined
) {
  if (value !== undefined) target[key] = value
}

function assignArray(
  target: Record<string, unknown>,
  key: string,
  value: Array<unknown> | undefined
) {
  if (value !== undefined) target[key] = [...value]
}

function assignOptionalArray(
  target: Record<string, unknown>,
  key: string,
  value: Array<unknown> | null | undefined
) {
  if (value === null) {
    delete target[key]
    return
  }
  assignArray(target, key, value)
}

function copyString<T extends Record<string, unknown>>(
  source: Record<string, unknown>,
  target: T,
  key: keyof T & string
) {
  if (typeof source[key] === "string") {
    target[key] = source[key] as T[keyof T & string]
  }
}

function copyStringArray<T extends Record<string, unknown>>(
  source: Record<string, unknown>,
  target: T,
  key: keyof T & string
) {
  if (Array.isArray(source[key])) {
    const strings = source[key].filter((item) => typeof item === "string")
    target[key] = strings as T[keyof T & string]
  }
}

function copyBoolean<T extends Record<string, unknown>>(
  source: Record<string, unknown>,
  target: T,
  key: keyof T & string
) {
  if (typeof source[key] === "boolean") {
    target[key] = source[key] as T[keyof T & string]
  }
}

function copyNumber<T extends Record<string, unknown>>(
  source: Record<string, unknown>,
  target: T,
  key: keyof T & string
) {
  if (typeof source[key] === "number") {
    target[key] = source[key] as T[keyof T & string]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeTransport(value: string): ChatTransport {
  return value === "sse" || value === "websocket" ? value : "auto"
}
