/**
 * Daytona client wrapper for Fleet Pi.
 *
 * Provides a type-safe interface to Daytona SDK operations,
 * using DAYTONA_API_KEY and DAYTONA_API_URL from environment.
 */

import { Daytona, DaytonaError } from "@daytonaio/sdk"
import type { Sandbox } from "@daytonaio/sdk"

const DEFAULT_RESOURCES = {
  cpu: 1,
  memory: 1, // GiB
  disk: 3, // GiB
}

const DEFAULT_IMAGE = "debian:12.9"

export interface SandboxConfig {
  name?: string
  image?: string
  snapshot?: string
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

/**
 * Create a Daytona client using environment configuration.
 */
export function createDaytonaClient(): Daytona {
  const apiKey = process.env.DAYTONA_API_KEY
  const apiUrl = process.env.DAYTONA_API_URL

  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY is not set")
  }

  if (!apiUrl) {
    throw new Error("DAYTONA_API_URL is not set")
  }

  return new Daytona({
    apiKey,
    apiUrl,
  })
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

    if (snapshot) {
      // Create from snapshot - resources not supported in snapshot mode
      return await client.create({ snapshot, name })
    }

    if (image) {
      // Create from image with resources
      return await client.create({
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
      image: DEFAULT_IMAGE,
      name,
      resources: DEFAULT_RESOURCES,
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
  command: string
): Promise<ExecuteResult> {
  try {
    const response = await sandbox.process.executeCommand(command)

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
  code: string
): Promise<ExecuteResult> {
  try {
    const response = await sandbox.process.codeRun(code)

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
