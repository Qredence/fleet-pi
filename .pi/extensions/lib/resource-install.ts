import { constants } from "node:fs"
import {
  access,
  cp,
  mkdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { validatePublicHttpsUrl } from "./url-security"

export type ResourceInstallKind = "skill" | "prompt" | "extension" | "package"
export type ResourceInstallSourceType = "content" | "path" | "url"
export type ResourceActivationStatus = "active" | "staged" | "reload-required"

export type ResourceInstallParams = {
  activate?: boolean
  kind: ResourceInstallKind
  name: string
  source: string
  sourceType: ResourceInstallSourceType
}

export type ResourceInstallResult = {
  activationStatus: ResourceActivationStatus
  installedPath: string
  kind: ResourceInstallKind
  name: string
  reloadRequired: boolean
  settingsUpdated: boolean
}

const WORKSPACE_PI_ROOT = "agent-workspace/pi"
const SETTINGS_PATH = ".pi/settings.json"
const MAX_URL_BYTES = 250_000
const FETCH_TIMEOUT_MS = 15_000
const GITHUB_BLOB_RE =
  /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/

const WORKSPACE_SETTINGS_PATHS = {
  extensions: "../agent-workspace/pi/extensions/enabled",
  prompts: "../agent-workspace/pi/prompts",
  skills: "../agent-workspace/pi/skills",
}

export async function ensureWorkspaceResourceDirectories(cwd: string) {
  await Promise.all(
    [
      "skills",
      "prompts",
      "extensions/staged",
      "extensions/enabled",
      "packages",
    ].map((dir) =>
      mkdir(resolve(cwd, WORKSPACE_PI_ROOT, dir), { recursive: true })
    )
  )
}

export async function installWorkspaceResource(
  cwd: string,
  params: ResourceInstallParams,
  signal?: AbortSignal
): Promise<ResourceInstallResult> {
  const name = normalizeResourceName(params.name)
  await ensureWorkspaceResourceDirectories(cwd)

  const source = await loadInstallSource(cwd, params, signal)
  let installedPath: string
  let packageSettingsPath: string | undefined

  switch (params.kind) {
    case "skill":
      installedPath = await installSkill(cwd, name, source)
      break
    case "prompt":
      installedPath = await installPrompt(cwd, name, source)
      break
    case "extension":
      installedPath = await installExtension(cwd, name, source, params.activate)
      break
    case "package":
      ;({ installedPath, packageSettingsPath } = await installPackage(
        cwd,
        name,
        source,
        params.activate
      ))
      break
    default:
      assertNever(params.kind)
  }

  const settingsUpdated = await ensureWorkspacePiSettings(
    cwd,
    params.activate ? packageSettingsPath : undefined
  )

  return {
    activationStatus: activationStatusFor(
      params.kind,
      Boolean(params.activate)
    ),
    installedPath,
    kind: params.kind,
    name,
    reloadRequired: true,
    settingsUpdated,
  }
}

async function installSkill(
  cwd: string,
  name: string,
  source: LoadedInstallSource
) {
  const content =
    source.kind === "directory"
      ? await readRequiredFile(source.absolutePath, "SKILL.md", "skill.md")
      : source.content

  if (!looksLikeSkill(content)) {
    throw new Error("Skill installs must provide SKILL.md-style Markdown.")
  }

  const targetPath = `${WORKSPACE_PI_ROOT}/skills/${name}/SKILL.md`
  await writeText(cwd, targetPath, content)
  return targetPath
}

async function installPrompt(
  cwd: string,
  name: string,
  source: LoadedInstallSource
) {
  if (source.kind === "directory") {
    throw new Error(
      "Prompt installs must provide a text file or pasted content."
    )
  }

  const targetPath = `${WORKSPACE_PI_ROOT}/prompts/${name}.md`
  await writeText(cwd, targetPath, source.content)
  return targetPath
}

async function installExtension(
  cwd: string,
  name: string,
  source: LoadedInstallSource,
  activate: boolean | undefined
) {
  if (source.kind === "directory") {
    throw new Error("Extension installs must provide a single TypeScript file.")
  }
  if (!looksLikeExtension(source.content)) {
    throw new Error("Extension installs must export a default Pi extension.")
  }

  const targetDir = activate ? "enabled" : "staged"
  const targetPath = `${WORKSPACE_PI_ROOT}/extensions/${targetDir}/${name}.ts`
  await writeText(cwd, targetPath, source.content)
  return targetPath
}

async function installPackage(
  cwd: string,
  name: string,
  source: LoadedInstallSource,
  activate: boolean | undefined
) {
  if (source.kind !== "directory") {
    throw new Error(
      "Package installs must use sourceType:path pointing at a directory."
    )
  }

  await assertPiPackage(source.absolutePath)
  const targetPath = `${WORKSPACE_PI_ROOT}/packages/${name}`
  const absoluteTarget = resolve(cwd, targetPath)
  await rm(absoluteTarget, { force: true, recursive: true })
  await mkdir(dirname(absoluteTarget), { recursive: true })
  await cp(source.absolutePath, absoluteTarget, {
    force: true,
    recursive: true,
  })

  return {
    installedPath: targetPath,
    packageSettingsPath: activate
      ? `../agent-workspace/pi/packages/${name}`
      : undefined,
  }
}

async function ensureWorkspacePiSettings(
  cwd: string,
  activePackagePath?: string
) {
  const settingsPath = resolve(cwd, SETTINGS_PATH)
  const settings = await readJsonObject(settingsPath)
  let changed = false

  for (const [key, value] of Object.entries(WORKSPACE_SETTINGS_PATHS)) {
    changed = addUniqueSetting(settings, key, value) || changed
  }

  if (activePackagePath) {
    changed =
      addUniqueSetting(settings, "packages", activePackagePath) || changed
  }

  if (changed) {
    await mkdir(dirname(settingsPath), { recursive: true })
    await writeFile(
      settingsPath,
      `${JSON.stringify(settings, null, 2)}\n`,
      "utf8"
    )
  }

  return changed
}

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  try {
    const value = JSON.parse(await readFile(path, "utf8"))
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return {}
    throw error
  }
}

function addUniqueSetting(
  settings: Record<string, unknown>,
  key: string,
  value: string
) {
  const current = Array.isArray(settings[key]) ? settings[key] : []
  const strings = current.filter(
    (item): item is string => typeof item === "string"
  )
  if (strings.includes(value)) {
    if (settings[key] !== strings) settings[key] = strings
    return false
  }
  settings[key] = [...strings, value]
  return true
}

type LoadedInstallSource =
  | { kind: "directory"; absolutePath: string }
  | { content: string; kind: "text" }

async function loadInstallSource(
  cwd: string,
  params: ResourceInstallParams,
  signal?: AbortSignal
): Promise<LoadedInstallSource> {
  if (params.sourceType === "content") {
    return { content: params.source, kind: "text" }
  }
  if (params.sourceType === "url") {
    return {
      content: await fetchTextSource(params.source, signal),
      kind: "text",
    }
  }

  const absolutePath = await resolveSafeProjectPath(cwd, params.source)
  const info = await stat(absolutePath)
  if (info.isDirectory()) return { absolutePath, kind: "directory" }
  if (!info.isFile())
    throw new Error("Install source path is not a file or directory.")
  return { content: await readFile(absolutePath, "utf8"), kind: "text" }
}

async function resolveSafeProjectPath(cwd: string, sourcePath: string) {
  if (isAbsolute(sourcePath)) {
    throw new Error("Install source path must be project-relative.")
  }
  if (sourcePath.includes("..")) {
    throw new Error("Install source path must not contain '..' segments.")
  }

  const absoluteCwd = await realpath(cwd)
  const absolutePath = resolve(cwd, sourcePath)
  await access(absolutePath, constants.R_OK)
  const realSourcePath = await realpath(absolutePath)
  if (!isPathInside(absoluteCwd, realSourcePath)) {
    throw new Error("Install source path escapes the project root.")
  }
  return realSourcePath
}

async function fetchTextSource(url: string, signal?: AbortSignal) {
  const finalUrl = rewriteGitHubBlobUrl(url)
  await validatePublicHttpsUrl(finalUrl, "Install URL", {
    allowExplicitLoopback: true,
  })

  const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal
  const response = await fetch(finalUrl, {
    headers: { "User-Agent": "fleet-pi-agent/1.0" },
    redirect: "error",
    signal: combinedSignal,
  })
  if (!response.ok) {
    throw new Error(`Install URL returned HTTP ${response.status}.`)
  }
  const contentType = response.headers.get("content-type") ?? ""
  if (!isTextContentType(contentType)) {
    throw new Error(
      `Install URL returned non-text content-type "${contentType}".`
    )
  }
  const contentLength = response.headers.get("content-length")
  if (contentLength && Number(contentLength) > MAX_URL_BYTES) {
    throw new Error(`Install URL exceeds ${MAX_URL_BYTES} bytes.`)
  }

  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_URL_BYTES) {
    throw new Error(`Install URL exceeds ${MAX_URL_BYTES} bytes.`)
  }
  return text
}

function rewriteGitHubBlobUrl(url: string) {
  const match = url.match(GITHUB_BLOB_RE)
  if (!match) return url
  const [, owner, repo, branch, path] = match
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
}

function isTextContentType(contentType: string) {
  const base = contentType.split(";")[0].trim().toLowerCase()
  return (
    base === "" ||
    base.startsWith("text/") ||
    base === "application/json" ||
    base === "application/typescript" ||
    base === "application/javascript"
  )
}

async function readRequiredFile(
  directory: string,
  primary: string,
  fallback: string
) {
  for (const candidate of [primary, fallback]) {
    try {
      return await readFile(join(directory, candidate), "utf8")
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error
    }
  }
  throw new Error(`Directory source must contain ${primary}.`)
}

async function assertPiPackage(directory: string) {
  const packageJsonPath = join(directory, "package.json")
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    keywords?: Array<string>
    pi?: unknown
  }
  if (!packageJson.pi && !packageJson.keywords?.includes("pi-package")) {
    throw new Error("Package directory must contain a Pi package manifest.")
  }
}

async function writeText(cwd: string, targetPath: string, content: string) {
  const absolutePath = resolve(cwd, targetPath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, ensureTrailingNewline(content), "utf8")
}

function normalizeResourceName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")

  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(normalized)) {
    throw new Error("Resource name must contain letters or numbers.")
  }
  return normalized
}

function looksLikeSkill(content: string) {
  return (
    /^---[\s\S]*?\bname:\s*.+?---/m.test(content) || /^#\s+.+/m.test(content)
  )
}

function looksLikeExtension(content: string) {
  return /export\s+default\s+function\s+\w*\s*\(/.test(content)
}

function activationStatusFor(kind: ResourceInstallKind, activate: boolean) {
  if (kind === "extension" || kind === "package") {
    return activate ? "reload-required" : "staged"
  }
  return "reload-required"
}

function ensureTrailingNewline(content: string) {
  return content.endsWith("\n") ? content : `${content}\n`
}

function isPathInside(parent: string, child: string) {
  const rel = relative(parent, child)
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
}

function assertNever(value: never): never {
  throw new Error(`Unsupported resource kind: ${String(value)}`)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}
