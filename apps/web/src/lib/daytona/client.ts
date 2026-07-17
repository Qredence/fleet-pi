/**
 * Daytona client wrapper for Fleet Pi.
 *
 * Provides a type-safe interface to Daytona SDK operations,
 * using DAYTONA_API_KEY and DAYTONA_API_URL from environment.
 */

import { Daytona, DaytonaError } from "@daytona/sdk"
import type {
  CreateSandboxBaseParams,
  DaytonaConfig,
  Sandbox,
  VolumeMount,
} from "@daytona/sdk"

const DEFAULT_RESOURCES = {
  cpu: 1,
  memory: 1, // GiB
  disk: 3, // GiB
}

const DEFAULT_IMAGE = "node:22-bookworm"

export interface SandboxConfig {
  name?: string
  image?: string
  snapshot?: string
  language?: string
  envVars?: Record<string, string>
  /**
   * Map of sandbox env var name → Daytona organization Secret name.
   * Env receives the opaque placeholder; egress substitutes the real value.
   */
  secrets?: Record<string, string>
  labels?: Record<string, string>
  public?: boolean
  autoStopInterval?: number
  autoArchiveInterval?: number
  autoDeleteInterval?: number
  volumes?: Array<VolumeMount>
  networkBlockAll?: boolean
  networkAllowList?: string
  ephemeral?: boolean
  cpu?: number
  memory?: number
  disk?: number
}

export interface ExecuteResult {
  result: string
  exitCode: number
}

export interface FileListEntry {
  name: string
  size: number
  isDir: boolean
}

export interface VolumeInfo {
  id: string
  name: string
  state?: string
}

export interface VolumeMountConfig {
  volumeId: string
  mountPath: string
  subpath?: string
}

/**
 * Create a Daytona client using environment configuration or an explicitly provided key.
 */
export function createDaytonaClient(explicitApiKey?: string): Daytona {
  return new Daytona(resolveDaytonaConfig(process.env, explicitApiKey))
}

export function resolveDaytonaConfig(
  env: Partial<
    Pick<
      NodeJS.ProcessEnv,
      "DAYTONA_API_KEY" | "DAYTONA_API_URL" | "DAYTONA_TARGET"
    >
  >,
  explicitApiKey?: string
): DaytonaConfig {
  const apiKey = explicitApiKey || env.DAYTONA_API_KEY
  const apiUrl = env.DAYTONA_API_URL?.trim()
  const target = env.DAYTONA_TARGET?.trim()

  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY is not set")
  }

  return {
    apiKey,
    ...(apiUrl ? { apiUrl } : {}),
    ...(target ? { target } : {}),
  }
}

/**
 * Create a sandbox with the given configuration.
 */
export async function createSandbox(
  client: Daytona,
  config: SandboxConfig = {}
): Promise<Sandbox> {
  try {
    const { name, image, snapshot, cpu, memory, disk } = config
    const baseConfig = toCreateSandboxBaseParams(config)

    if (snapshot) {
      // Create from snapshot - resources not supported in snapshot mode
      return await client.create({ ...baseConfig, snapshot, name })
    }

    if (image) {
      // Create from image with resources
      return await client.create({
        ...baseConfig,
        image,
        name,
        resources: {
          cpu: cpu ?? DEFAULT_RESOURCES.cpu,
          memory: memory ?? DEFAULT_RESOURCES.memory,
          disk: disk ?? DEFAULT_RESOURCES.disk,
        },
      })
    }

    // Default: create with default image
    return await client.create({
      ...baseConfig,
      image: DEFAULT_IMAGE,
      name,
      resources: {
        cpu: cpu ?? DEFAULT_RESOURCES.cpu,
        memory: memory ?? DEFAULT_RESOURCES.memory,
        disk: disk ?? DEFAULT_RESOURCES.disk,
      },
    })
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Execute a shell command in a sandbox.
 */
export async function executeCommand(
  sandbox: Sandbox,
  command: string,
  cwd?: string,
  env?: Record<string, string>,
  timeout?: number
): Promise<ExecuteResult> {
  try {
    const response = await sandbox.process.executeCommand(
      command,
      cwd,
      env,
      timeout
    )

    return {
      result: response.result,
      exitCode: response.exitCode,
    }
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona execute error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Run code in the sandbox's language runtime.
 * Language is set at sandbox creation time via the 'language' property.
 */
export async function runCode(
  sandbox: Sandbox,
  code: string,
  timeout?: number
): Promise<ExecuteResult> {
  try {
    const response = await sandbox.process.codeRun(code, undefined, timeout)

    return {
      result: response.result,
      exitCode: response.exitCode,
    }
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona code run error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Upload a file to a sandbox.
 */
export async function uploadFile(
  sandbox: Sandbox,
  content: string | Buffer,
  path: string
): Promise<void> {
  try {
    const buffer =
      typeof content === "string" ? Buffer.from(content, "utf-8") : content
    await sandbox.fs.uploadFile(buffer, path)
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona upload error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Download a file from a sandbox.
 */
export async function downloadFile(
  sandbox: Sandbox,
  path: string
): Promise<Buffer> {
  try {
    return await sandbox.fs.downloadFile(path)
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona download error: ${error.message}`)
    }
    throw error
  }
}

/**
 * List files in a sandbox directory.
 */
export async function listFiles(
  sandbox: Sandbox,
  path: string
): Promise<Array<FileListEntry>> {
  try {
    const files = await sandbox.fs.listFiles(path)

    return files.map((f) => ({
      name: f.name,
      size: f.size,
      isDir: f.isDir,
    }))
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona list files error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Stop a sandbox.
 */
export async function stopSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.stop()
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona stop error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Start a sandbox.
 */
export async function startSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.start()
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona start error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Delete a sandbox.
 */
export async function deleteSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.delete(60)
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona delete error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Get sandbox status.
 */
export async function getSandboxStatus(
  sandbox: Sandbox
): Promise<{ id: string; name: string; state: string }> {
  try {
    await sandbox.refreshData()
    return {
      id: sandbox.id,
      name: sandbox.name,
      state: sandbox.state ?? "unknown",
    }
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona get status error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Create a snapshot from an image definition.
 */
export async function createSnapshot(
  client: Daytona,
  name: string,
  image: string
): Promise<{ name: string }> {
  try {
    const snapshot = await client.snapshot.create({ name, image })
    return { name: snapshot.name }
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona create snapshot error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Delete a snapshot.
 */
export async function deleteSnapshot(
  client: Daytona,
  name: string
): Promise<void> {
  try {
    // Get the snapshot object first, then delete it
    const snapshot = await client.snapshot.get(name)
    await client.snapshot.delete(snapshot)
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona delete snapshot error: ${error.message}`)
    }
    throw error
  }
}

export async function getOrCreateVolume(
  client: Daytona,
  name: string
): Promise<VolumeInfo> {
  try {
    return toVolumeInfo(await client.volume.get(name, true))
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona get volume error: ${error.message}`)
    }
    throw error
  }
}

export async function listVolumes(client: Daytona): Promise<Array<VolumeInfo>> {
  try {
    const volumes = await client.volume.list()
    return volumes.map(toVolumeInfo)
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona list volumes error: ${error.message}`)
    }
    throw error
  }
}

export async function deleteVolume(
  client: Daytona,
  name: string
): Promise<void> {
  try {
    const volume = await client.volume.get(name)
    await client.volume.delete(volume)
  } catch (error) {
    if (error instanceof DaytonaError) {
      throw new Error(`Daytona delete volume error: ${error.message}`)
    }
    throw error
  }
}

export function createVolumeMount(config: VolumeMountConfig): VolumeMount {
  const mountPath = config.mountPath.trim()
  const subpath = config.subpath?.trim()

  if (!isValidVolumeMountPath(mountPath)) {
    throw new Error(`Invalid Daytona volume mount path: ${config.mountPath}`)
  }

  if (subpath && !isValidVolumeSubpath(subpath)) {
    throw new Error(`Invalid Daytona volume subpath: ${config.subpath}`)
  }

  return {
    volumeId: config.volumeId,
    mountPath,
    ...(subpath ? { subpath } : {}),
  }
}

function toCreateSandboxBaseParams(
  config: SandboxConfig
): CreateSandboxBaseParams {
  return {
    ...(config.language ? { language: config.language } : {}),
    ...(config.envVars ? { envVars: config.envVars } : {}),
    ...(config.secrets && Object.keys(config.secrets).length > 0
      ? { secrets: config.secrets }
      : {}),
    ...(config.labels ? { labels: config.labels } : {}),
    ...(config.public !== undefined ? { public: config.public } : {}),
    ...(config.autoStopInterval !== undefined
      ? { autoStopInterval: config.autoStopInterval }
      : {}),
    ...(config.autoArchiveInterval !== undefined
      ? { autoArchiveInterval: config.autoArchiveInterval }
      : {}),
    ...(config.autoDeleteInterval !== undefined
      ? { autoDeleteInterval: config.autoDeleteInterval }
      : {}),
    ...(config.volumes ? { volumes: config.volumes } : {}),
    ...(config.networkBlockAll !== undefined
      ? { networkBlockAll: config.networkBlockAll }
      : {}),
    ...(config.networkAllowList
      ? { networkAllowList: config.networkAllowList }
      : {}),
    ...(config.ephemeral !== undefined ? { ephemeral: config.ephemeral } : {}),
  }
}

function toVolumeInfo(
  volume: Awaited<ReturnType<Daytona["volume"]["get"]>>
): VolumeInfo {
  return {
    id: volume.id,
    name: volume.name,
    state: volume.state,
  }
}

function isValidVolumeMountPath(path: string) {
  if (!path.startsWith("/") || path === "/" || path === "//") return false
  if (path.includes("//")) return false
  if (
    path.includes("/../") ||
    path.includes("/./") ||
    path.endsWith("/..") ||
    path.endsWith("/.")
  ) {
    return false
  }

  return ![
    "/proc",
    "/sys",
    "/dev",
    "/boot",
    "/etc",
    "/bin",
    "/sbin",
    "/lib",
    "/lib64",
  ].some(
    (systemPath) => path === systemPath || path.startsWith(`${systemPath}/`)
  )
}

function isValidVolumeSubpath(path: string) {
  if (path.startsWith("/") || path.includes("//")) return false
  return !path
    .split("/")
    .some((part) => part === "" || part === "." || part === "..")
}
