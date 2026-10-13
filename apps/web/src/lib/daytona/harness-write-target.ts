import { readFile, readdir } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { registerHarnessWriteResolver } from "../../../../../.pi/extensions/lib/harness-write"
import { isDeployedChatRuntimeSurface } from "../pi/runtime/deployed-chat-runtime"
import { persistHarnessInstallSettings } from "./harness-settings"
import { executeCommand, uploadFile } from "./client"
import { SANDBOX_WORKSPACE_ROOT } from "./sandbox-prepare"
import { resolveDaytonaToolUser } from "./tool-context"
import { getCachedUserSandbox, getInFlightUserSandbox } from "./user-sandbox"
import type { Sandbox } from "@daytona/sdk"

const HOST_WRITE_REFUSED =
  "Private workspace writes need your Daytona sandbox. Chat and settings still work without it."

export type HarnessWriteTarget =
  | { kind: "host"; cwd: string }
  | { kind: "sandbox"; sandbox: Sandbox }
  | { kind: "unavailable"; message: string }

/**
 * Deployed harness writes go to the signed-in user's Daytona volume.
 * The git agent-workspace tree stays the shared template. Without a sandbox,
 * deployed chat does not write that shared checkout.
 */
export async function resolveHarnessWriteTarget(input: {
  cwd: string
  sessionId?: string
  sessionFile?: string
}): Promise<HarnessWriteTarget> {
  const userId = resolveDaytonaToolUser(input.sessionId, input.sessionFile)
  if (userId) {
    const handle = await resolveReadySandbox(userId)
    if (handle) {
      return { kind: "sandbox", sandbox: handle.sandbox }
    }
  }

  if (isDeployedChatRuntimeSurface()) {
    return { kind: "unavailable", message: HOST_WRITE_REFUSED }
  }

  return { kind: "host", cwd: input.cwd }
}

/**
 * Points auto-loaded `.pi` extensions at this module's Daytona writer.
 * The extension files themselves do not import the web server.
 */
export function installHarnessWriteResolver() {
  registerHarnessWriteResolver(async (input) => {
    const target = await resolveHarnessWriteTarget(input)
    if (target.kind !== "sandbox") return target
    const sandbox = target.sandbox
    const userId = resolveDaytonaToolUser(input.sessionId, input.sessionFile)
    return {
      kind: "sandbox" as const,
      sandbox: {
        writeFile: (workspaceRelativePath: string, content: string) =>
          writeSandboxWorkspaceFile(sandbox, workspaceRelativePath, content),
        uploadWorkspace: (hostProjectRoot: string) =>
          uploadAgentWorkspaceTree(sandbox, hostProjectRoot),
        persistSettings: async (settings: Record<string, unknown>) => {
          const merged = await persistHarnessInstallSettings({
            userId,
            cwd: input.cwd,
            settings,
          })
          await writeSandboxWorkspaceFile(
            sandbox,
            ".pi/settings.json",
            `${JSON.stringify(merged, null, 2)}\n`
          )
        },
      },
    }
  })
}

async function resolveReadySandbox(userId: string) {
  const cached = getCachedUserSandbox(userId)
  if (cached) return cached
  const inFlight = getInFlightUserSandbox(userId)
  if (!inFlight) return undefined
  try {
    return await inFlight
  } catch {
    return undefined
  }
}

export function sandboxWorkspaceFilePath(workspaceRelativePath: string) {
  return join(SANDBOX_WORKSPACE_ROOT, workspaceRelativePath)
}

export async function writeSandboxWorkspaceFile(
  sandbox: Sandbox,
  workspaceRelativePath: string,
  content: string
) {
  const remotePath = sandboxWorkspaceFilePath(workspaceRelativePath)
  const parent = dirname(remotePath)
  const mkdir = await executeCommand(sandbox, `mkdir -p ${shellQuote(parent)}`)
  if (mkdir.exitCode !== 0) {
    throw new Error(
      `Failed to create sandbox directory ${parent}: ${mkdir.result}`
    )
  }
  await uploadFile(sandbox, content, remotePath)
}

export async function uploadAgentWorkspaceTree(
  sandbox: Sandbox,
  hostProjectRoot: string
) {
  const sourceRoot = join(hostProjectRoot, "agent-workspace")
  const files = await collectFiles(sourceRoot)
  for (const file of files) {
    const workspaceRelativePath = relative(sourceRoot, file)
    const content = await readFile(file)
    await writeSandboxWorkspaceFile(
      sandbox,
      workspaceRelativePath,
      content.toString("utf8")
    )
  }
}

async function collectFiles(root: string): Promise<Array<string>> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (isEnoent(error)) return []
    throw error
  }

  const files: Array<string> = []
  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)))
      continue
    }
    if (entry.isFile()) files.push(path)
  }
  return files
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

function isEnoent(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  )
}
