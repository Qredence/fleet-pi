import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { ChatPiSettingsUpdateSchema } from "./chat-protocol.zod"
import { collectDiagnostics, createSessionServices } from "./server-shared"
import type {
  ChatPiSettings,
  ChatPiSettingsUpdate,
  ChatSettingsResponse,
  ChatTransport,
} from "./chat-protocol"
import type { AppRuntimeContext } from "@/lib/app-runtime"

const SETTINGS_PATH = ".pi/settings.json"
const RESOURCE_SETTING_KEYS = [
  "packages",
  "extensions",
  "skills",
  "prompts",
  "themes",
] as const

export async function loadChatSettings(
  context: AppRuntimeContext
): Promise<ChatSettingsResponse> {
  const services = await createSessionServices(context)
  const project = toEditableProjectSettings(
    readProjectSettingsFromServices(
      services.settingsManager.getProjectSettings()
    )
  )

  return {
    diagnostics: collectDiagnostics(services),
    effective: toEffectiveSettings(services.settingsManager),
    project,
    projectPath: SETTINGS_PATH,
    updateImpact: impactForSettings(project),
  }
}

export async function updateChatSettings(
  context: AppRuntimeContext,
  update: ChatPiSettingsUpdate
): Promise<ChatSettingsResponse> {
  const parsedUpdate = ChatPiSettingsUpdateSchema.parse(update)
  const settingsPath = projectSettingsPath(context.projectRoot)
  const current = await readProjectSettingsFile(context.projectRoot)
  const next = mergeProjectSettings(current, parsedUpdate)

  await mkdir(dirname(settingsPath), { recursive: true })
  await writeFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8")

  return loadChatSettings(context)
}

export async function readProjectSettingsFile(projectRoot: string) {
  try {
    const content = await readFile(projectSettingsPath(projectRoot), "utf8")
    const parsed = JSON.parse(content) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return {}
    throw error
  }
}

export function mergeProjectSettings(
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

function toEffectiveSettings(
  settingsManager: SettingsManagerLike
): ChatPiSettings {
  const compaction = settingsManager.getCompactionSettings()
  const retry = settingsManager.getRetrySettings()

  return {
    compaction: {
      enabled: compaction.enabled,
      reserveTokens: compaction.reserveTokens,
      keepRecentTokens: compaction.keepRecentTokens,
    },
    defaultModel: settingsManager.getDefaultModel(),
    defaultProvider: settingsManager.getDefaultProvider(),
    defaultThinkingLevel: settingsManager.getDefaultThinkingLevel(),
    enableSkillCommands: settingsManager.getEnableSkillCommands(),
    enabledModels: settingsManager.getEnabledModels(),
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

function impactForSettings(settings: ChatPiSettingsUpdate) {
  return {
    newSessionRecommended: Object.keys(settings).length > 0,
    resourceReloadRequired: RESOURCE_SETTING_KEYS.some(
      (key) => settings[key] !== undefined
    ),
  }
}

function readProjectSettingsFromServices(settings: unknown) {
  return isRecord(settings) ? settings : {}
}

function projectSettingsPath(projectRoot: string) {
  return join(projectRoot, SETTINGS_PATH)
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

function normalizeTransport(value: string): ChatTransport {
  return value === "sse" || value === "websocket" ? value : "auto"
}

type SettingsManagerLike = {
  getCompactionSettings: () => ChatPiSettings["compaction"]
  getDefaultModel: () => string | undefined
  getDefaultProvider: () => string | undefined
  getDefaultThinkingLevel: () => ChatPiSettings["defaultThinkingLevel"]
  getEnableSkillCommands: () => boolean
  getEnabledModels: () => Array<string> | undefined
  getExtensionPaths: () => Array<string>
  getFollowUpMode: () => ChatPiSettings["followUpMode"]
  getPackages: () => ChatPiSettings["packages"]
  getProjectSettings: () => unknown
  getPromptTemplatePaths: () => Array<string>
  getRetrySettings: () => ChatPiSettings["retry"]
  getSkillPaths: () => Array<string>
  getSteeringMode: () => ChatPiSettings["steeringMode"]
  getThemePaths: () => Array<string>
  getTransport: () => string
}
