import { readFile, readdir, stat } from "node:fs/promises"
import { basename, extname, isAbsolute, relative, resolve } from "node:path"
import type { ChatResourceInfo } from "./chat-protocol"
import type { AppRuntimeContext } from "@/lib/app-runtime"

type WorkspaceResourceCatalog = {
  extensions: Array<ChatResourceInfo>
  packages: Array<ChatResourceInfo>
  prompts: Array<ChatResourceInfo>
  skills: Array<ChatResourceInfo>
}

const WORKSPACE_PI_ROOT = "agent-workspace/pi"
const SETTINGS_PATH = ".pi/settings.json"
const WORKSPACE_EXTENSION_ROOT = `${WORKSPACE_PI_ROOT}/extensions/enabled`
const WORKSPACE_PROMPT_ROOT = `${WORKSPACE_PI_ROOT}/prompts`
const WORKSPACE_SKILL_ROOT = `${WORKSPACE_PI_ROOT}/skills`

type WorkspacePiSettings = Record<string, unknown>

export async function loadWorkspaceResourceCatalog(
  context: AppRuntimeContext
): Promise<WorkspaceResourceCatalog> {
  const settings = await readWorkspacePiSettings(context.projectRoot)
  return {
    extensions: [
      ...(await readExtensionFiles(
        context,
        settings,
        "agent-workspace/pi/extensions/enabled",
        "active"
      )),
      ...(await readExtensionFiles(
        context,
        settings,
        "agent-workspace/pi/extensions/staged",
        "staged"
      )),
    ],
    packages: await readPackages(context, settings),
    prompts: await readPromptFiles(context, settings),
    skills: await readSkillDirectories(context, settings),
  }
}

export function mergeResourceInfo(
  projectRoot: string,
  primary: Array<ChatResourceInfo>,
  secondary: Array<ChatResourceInfo>
) {
  const merged = new Map<string, ChatResourceInfo>()

  for (const item of [...primary, ...secondary]) {
    const key = resourceKey(projectRoot, item)
    const existing = merged.get(key)
    merged.set(
      key,
      existing ? mergeChatResourceInfo(projectRoot, existing, item) : item
    )
  }

  return [...merged.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

export function applyWorkspaceResourceMetadata(
  projectRoot: string,
  settings: WorkspacePiSettings,
  resource: ChatResourceInfo
): ChatResourceInfo {
  const workspacePath = normalizeProjectPath(
    projectRoot,
    resource.workspacePath ?? resource.path
  )
  if (!workspacePath || !isWorkspacePiPath(workspacePath)) {
    return resource
  }

  return {
    ...resource,
    activationStatus:
      resource.activationStatus ??
      activationStatusForWorkspacePath(settings, workspacePath),
    installedInWorkspace: true,
    path: workspacePath,
    source: "workspace",
    workspacePath,
  }
}

export async function readWorkspacePiSettings(projectRoot: string) {
  try {
    const settings = JSON.parse(
      await readFile(resolve(projectRoot, SETTINGS_PATH), "utf8")
    )
    return settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as WorkspacePiSettings)
      : {}
  } catch {
    return {}
  }
}

async function readSkillDirectories(
  context: AppRuntimeContext,
  settings: WorkspacePiSettings
) {
  const skillsRoot = resolve(context.projectRoot, WORKSPACE_PI_ROOT, "skills")
  const entries = await readDirectoryEntries(skillsRoot)
  const skills: Array<ChatResourceInfo> = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillPath = resolve(skillsRoot, entry.name, "SKILL.md")
    if (!(await pathExists(skillPath))) continue
    const workspacePath = toProjectPath(context.projectRoot, skillPath)
    skills.push(
      applyWorkspaceResourceMetadata(context.projectRoot, settings, {
        name: entry.name,
        path: workspacePath,
        workspacePath,
      })
    )
  }

  return skills
}

async function readPromptFiles(
  context: AppRuntimeContext,
  settings: WorkspacePiSettings
) {
  const promptsRoot = resolve(context.projectRoot, WORKSPACE_PI_ROOT, "prompts")
  const entries = await readDirectoryEntries(promptsRoot)

  return entries
    .filter(
      (entry) => entry.isFile() && [".md", ".txt"].includes(extname(entry.name))
    )
    .map((entry) => {
      const workspacePath = toProjectPath(
        context.projectRoot,
        resolve(promptsRoot, entry.name)
      )
      return applyWorkspaceResourceMetadata(context.projectRoot, settings, {
        name: basename(entry.name, extname(entry.name)),
        path: workspacePath,
        workspacePath,
      })
    })
}

async function readExtensionFiles(
  context: AppRuntimeContext,
  settings: WorkspacePiSettings,
  directory: string,
  activationStatus: "active" | "staged"
) {
  const root = resolve(context.projectRoot, directory)
  const entries = await readDirectoryEntries(root)

  return entries
    .filter((entry) => entry.isFile() && extname(entry.name) === ".ts")
    .map((entry) => {
      const workspacePath = toProjectPath(
        context.projectRoot,
        resolve(root, entry.name)
      )
      return applyWorkspaceResourceMetadata(context.projectRoot, settings, {
        activationStatus,
        name: basename(entry.name, ".ts"),
        path: workspacePath,
        workspacePath,
      })
    })
}

async function readPackages(
  context: AppRuntimeContext,
  settings: Record<string, unknown>
) {
  const packagesRoot = resolve(
    context.projectRoot,
    WORKSPACE_PI_ROOT,
    "packages"
  )
  const entries = await readDirectoryEntries(packagesRoot)
  const activePackages = new Set(
    Array.isArray(settings.packages)
      ? settings.packages.filter(
          (entry): entry is string => typeof entry === "string"
        )
      : []
  )

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const workspacePath = `agent-workspace/pi/packages/${entry.name}`
      return applyWorkspaceResourceMetadata(context.projectRoot, settings, {
        activationStatus: activePackages.has(`../${workspacePath}`)
          ? "active"
          : "staged",
        name: entry.name,
        path: workspacePath,
        workspacePath,
      })
    })
}

async function readDirectoryEntries(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }
}

async function pathExists(path: string) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function toProjectPath(projectRoot: string, path: string) {
  return relative(projectRoot, path)
}

function resourceKey(projectRoot: string, item: ChatResourceInfo) {
  return `${normalizeProjectPath(projectRoot, item.workspacePath ?? item.path) ?? item.path ?? ""}:${item.name}`
}

function mergeChatResourceInfo(
  projectRoot: string,
  current: ChatResourceInfo,
  next: ChatResourceInfo
): ChatResourceInfo {
  const workspacePath = [
    current.workspacePath,
    next.workspacePath,
    normalizeProjectPath(projectRoot, current.path),
    normalizeProjectPath(projectRoot, next.path),
  ].find(
    (path): path is string =>
      typeof path === "string" && isWorkspacePiPath(path)
  )

  return {
    ...current,
    ...next,
    activationStatus: next.activationStatus ?? current.activationStatus,
    argumentHint: current.argumentHint ?? next.argumentHint,
    description: current.description ?? next.description,
    installedInWorkspace:
      current.installedInWorkspace || next.installedInWorkspace,
    path: workspacePath ?? next.path ?? current.path,
    source: next.source ?? current.source,
    workspacePath: workspacePath ?? next.workspacePath ?? current.workspacePath,
  }
}

function normalizeProjectPath(projectRoot: string, path: string | undefined) {
  if (!path) return undefined
  if (!isAbsolute(path)) return path

  const relativePath = relative(projectRoot, path)
  return relativePath.startsWith("..") || isAbsolute(relativePath)
    ? path
    : relativePath
}

function isWorkspacePiPath(path: string) {
  return path === WORKSPACE_PI_ROOT || path.startsWith(`${WORKSPACE_PI_ROOT}/`)
}

function activationStatusForWorkspacePath(
  settings: WorkspacePiSettings,
  workspacePath: string
): ChatResourceInfo["activationStatus"] {
  if (workspacePath.startsWith(`${WORKSPACE_PI_ROOT}/extensions/staged/`)) {
    return "staged"
  }
  if (workspacePath.startsWith(`${WORKSPACE_PI_ROOT}/packages/`)) {
    const packageName = workspacePath
      .slice(`${WORKSPACE_PI_ROOT}/packages/`.length)
      .split("/")[0]
    return hasWorkspaceSetting(
      settings,
      "packages",
      `../${WORKSPACE_PI_ROOT}/packages/${packageName}`
    )
      ? "active"
      : "staged"
  }
  if (workspacePath.startsWith(`${WORKSPACE_PI_ROOT}/extensions/enabled/`)) {
    return hasWorkspaceSetting(
      settings,
      "extensions",
      `../${WORKSPACE_EXTENSION_ROOT}`
    )
      ? "active"
      : "reload-required"
  }
  if (workspacePath.startsWith(`${WORKSPACE_PI_ROOT}/prompts/`)) {
    return hasWorkspaceSetting(
      settings,
      "prompts",
      `../${WORKSPACE_PROMPT_ROOT}`
    )
      ? "active"
      : "reload-required"
  }
  if (workspacePath.startsWith(`${WORKSPACE_PI_ROOT}/skills/`)) {
    return hasWorkspaceSetting(settings, "skills", `../${WORKSPACE_SKILL_ROOT}`)
      ? "active"
      : "reload-required"
  }

  return undefined
}

function hasWorkspaceSetting(
  settings: WorkspacePiSettings,
  key: string,
  value: string
) {
  const current = Array.isArray(settings[key]) ? settings[key] : []
  return current.some((entry) => entry === value)
}
