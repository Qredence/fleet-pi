import { readFile, readdir } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { isDeployedChatRuntimeSurface } from "../pi/runtime/deployed-chat-runtime"
import { executeCommand, uploadFile } from "./client"
import { SANDBOX_WORKSPACE_ROOT } from "./sandbox-prepare"
import { resolveDaytonaToolUser } from "./tool-context"
import { getCachedUserSandbox } from "./user-sandbox"
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
export function resolveHarnessWriteTarget(input: {
  cwd: string
  sessionId?: string
  sessionFile?: string
}): HarnessWriteTarget {
  const userId = resolveDaytonaToolUser(input.sessionId, input.sessionFile)
  if (userId) {
    const handle = getCachedUserSandbox(userId)
    if (handle) {
      return { kind: "sandbox", sandbox: handle.sandbox }
    }
  }

  if (isDeployedChatRuntimeSurface()) {
    return { kind: "unavailable", message: HOST_WRITE_REFUSED }
  }

  return { kind: "host", cwd: input.cwd }
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
