import { readFile, readdir, stat } from "node:fs/promises"
import { basename, extname, relative, resolve } from "node:path"
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

export async function loadWorkspaceResourceCatalog(
  context: AppRuntimeContext
): Promise<WorkspaceResourceCatalog> {
  const settings = await readPiSettings(context.projectRoot)
  return {
    extensions: [
      ...(await readExtensionFiles(
        context,
        "agent-workspace/pi/extensions/enabled",
        "active"
      )),
      ...(await readExtensionFiles(
        context,
        "agent-workspace/pi/extensions/staged",
        "staged"
      )),
    ],
    packages: await readPackages(context, settings),
    prompts: await readPromptFiles(context),
    skills: await readSkillDirectories(context),
  }
}

export function mergeResourceInfo(
  primary: Array<ChatResourceInfo>,
  secondary: Array<ChatResourceInfo>
) {
  const seen = new Set<string>()
  const merged: Array<ChatResourceInfo> = []

  for (const item of [...primary, ...secondary]) {
    const key = `${item.path ?? item.workspacePath ?? ""}:${item.name}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }

  return merged.sort((left, right) => left.name.localeCompare(right.name))
}

async function readSkillDirectories(context: AppRuntimeContext) {
  const skillsRoot = resolve(context.projectRoot, WORKSPACE_PI_ROOT, "skills")
  const entries = await readDirectoryEntries(skillsRoot)
  const skills: Array<ChatResourceInfo> = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillPath = resolve(skillsRoot, entry.name, "SKILL.md")
    if (!(await pathExists(skillPath))) continue
    const workspacePath = toProjectPath(context.projectRoot, skillPath)
    skills.push({
      activationStatus: "active",
      installedInWorkspace: true,
      name: entry.name,
      path: workspacePath,
      source: "workspace",
      workspacePath,
    })
  }

  return skills
}

async function readPromptFiles(context: AppRuntimeContext) {
  const promptsRoot = resolve(context.projectRoot, WORKSPACE_PI_ROOT, "prompts")
  const entries = await readDirectoryEntries(promptsRoot)

  return entries
    .filter((entry) => entry.isFile() && [".md", ".txt"].includes(extname(entry.name)))
    .map((entry) => {
      const workspacePath = toProjectPath(
        context.projectRoot,
        resolve(promptsRoot, entry.name)
      )
      return {
        activationStatus: "active" as const,
        installedInWorkspace: true,
        name: basename(entry.name, extname(entry.name)),
        path: workspacePath,
        source: "workspace",
        workspacePath,
      }
    })
}

async function readExtensionFiles(
  context: AppRuntimeContext,
  directory: string,
  activationStatus: "active" | "staged"
) {
  const root = resolve(context.projectRoot, directory)
  const entries = await readDirectoryEntries(root)

  return entries
    .filter((entry) => entry.isFile() && extname(entry.name) === ".ts")
    .map((entry) => {
      const workspacePath = toProjectPath(context.projectRoot, resolve(root, entry.name))
      return {
        activationStatus,
        installedInWorkspace: true,
        name: basename(entry.name, ".ts"),
        path: workspacePath,
        source: "workspace",
        workspacePath,
      }
    })
}

async function readPackages(
  context: AppRuntimeContext,
  settings: Record<string, unknown>
) {
  const packagesRoot = resolve(context.projectRoot, WORKSPACE_PI_ROOT, "packages")
  const entries = await readDirectoryEntries(packagesRoot)
  const activePackages = new Set(
    Array.isArray(settings.packages)
      ? settings.packages.filter((entry): entry is string => typeof entry === "string")
      : []
  )

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const workspacePath = `agent-workspace/pi/packages/${entry.name}`
      const settingsPath = `../${workspacePath}`
      return {
        activationStatus: activePackages.has(settingsPath)
          ? ("active" as const)
          : ("staged" as const),
        installedInWorkspace: true,
        name: entry.name,
        path: workspacePath,
        source: "workspace",
        workspacePath,
      }
    })
}

async function readDirectoryEntries(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }
}

async function readPiSettings(projectRoot: string) {
  try {
    const settings = JSON.parse(
      await readFile(resolve(projectRoot, SETTINGS_PATH), "utf8")
    )
    return settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {}
  } catch {
    return {}
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
