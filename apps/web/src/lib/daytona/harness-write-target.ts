import { readFile, readdir } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import {
  registerHarnessWriteResolver,
  requireHarnessWriteResolver,
} from "../../../../../.pi/extensions/lib/harness-write"
import { isDeployedChatRuntimeSurface } from "../pi/runtime/deployed-chat-runtime"
import { persistHarnessInstallSettings } from "./harness-settings"
import { executeCommand, uploadFile } from "./client"
import { SANDBOX_WORKSPACE_ROOT } from "./sandbox-prepare"
import { resolveDaytonaToolUser } from "./tool-context"
import {
  SANDBOX_WARMING_MESSAGE,
  resolveReadySandbox,
} from "./resolve-ready-sandbox"
import type { ResolveReadySandboxDeps } from "./resolve-ready-sandbox"
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
export async function resolveHarnessWriteTarget(
  input: {
    cwd: string
    sessionId?: string
    sessionFile?: string
  },
  deps?: ResolveReadySandboxDeps
): Promise<HarnessWriteTarget> {
  const userId = resolveDaytonaToolUser(input.sessionId, input.sessionFile)
  if (userId) {
    const ready = await resolveReadySandbox(userId, deps)
    switch (ready.status) {
      case "ready":
        return { kind: "sandbox", sandbox: ready.handle.sandbox }
      case "warming":
        return { kind: "unavailable", message: SANDBOX_WARMING_MESSAGE }
      case "missing":
        break
      default:
        return assertNever(ready)
    }
  }

  if (isDeployedChatRuntimeSurface()) {
    return { kind: "unavailable", message: HOST_WRITE_REFUSED }
  }

  return { kind: "host", cwd: input.cwd }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected sandbox state: ${JSON.stringify(value)}`)
}

/**
 * Points auto-loaded `.pi` extensions at this module's Daytona writer.
 * The extension files themselves do not import the web server.
 */
export function installHarnessWriteResolver() {
  if (isDeployedChatRuntimeSurface()) requireHarnessWriteResolver()
  registerHarnessWriteResolver(async (input) => {
    const target = await resolveHarnessWriteTarget(input)
    if (target.kind !== "sandbox") return target
    const sandbox = target.sandbox
    const userId = resolveDaytonaToolUser(input.sessionId, input.sessionFile)
    return {
      kind: "sandbox" as const,
      sandbox: {
        writeFile: (workspaceRelativePath: string, content: string) =>
          writeSandboxWorkspaceFile(sandbox, workspaceRelativePath, content, {
            overwrite: true,
          }),
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
            `${JSON.stringify(merged, null, 2)}\n`,
            { overwrite: true }
          )
        },
      },
    }
  })
}

export function sandboxWorkspaceFilePath(workspaceRelativePath: string) {
  return join(SANDBOX_WORKSPACE_ROOT, workspaceRelativePath)
}

export async function writeSandboxWorkspaceFile(
  sandbox: Sandbox,
  workspaceRelativePath: string,
  content: string | Buffer,
  options?: { overwrite?: boolean; parentsReady?: boolean }
) {
  const remotePath = sandboxWorkspaceFilePath(workspaceRelativePath)
  if (!options?.overwrite) {
    const existing = await executeCommand(
      sandbox,
      `test -e ${shellQuote(remotePath)}`
    )
    if (existing.exitCode === 0) return
  }
  if (!options?.parentsReady) {
    const parent = dirname(remotePath)
    const mkdir = await executeCommand(
      sandbox,
      `mkdir -p ${shellQuote(parent)}`
    )
    if (mkdir.exitCode !== 0) {
      throw new Error(
        `Failed to create sandbox directory ${parent}: ${mkdir.result}`
      )
    }
  }
  await uploadFile(sandbox, content, remotePath)
}

const WORKSPACE_UPLOAD_CONCURRENCY = 4

export async function uploadAgentWorkspaceTree(
  sandbox: Sandbox,
  hostProjectRoot: string
) {
  const sourceRoot = join(hostProjectRoot, "agent-workspace")
  const files = await collectFiles(sourceRoot)
  const parents = new Set<string>()
  const pending: Array<{ path: string; content: Buffer }> = []
  for (const file of files) {
    const workspaceRelativePath = relative(sourceRoot, file)
    parents.add(dirname(sandboxWorkspaceFilePath(workspaceRelativePath)))
    pending.push({
      path: workspaceRelativePath,
      content: await readFile(file),
    })
  }
  if (parents.size > 0) {
    const mkdir = await executeCommand(
      sandbox,
      `mkdir -p ${[...parents].map(shellQuote).join(" ")}`
    )
    if (mkdir.exitCode !== 0) {
      throw new Error(`Failed to create sandbox directories: ${mkdir.result}`)
    }
  }
  await mapWithConcurrency(
    pending,
    WORKSPACE_UPLOAD_CONCURRENCY,
    async (file) => {
      await writeSandboxWorkspaceFile(sandbox, file.path, file.content, {
        parentsReady: true,
      })
    }
  )
}

async function mapWithConcurrency<T>(
  items: Array<T>,
  limit: number,
  run: (item: T) => Promise<void>
) {
  let index = 0
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (index < items.length) {
        const current = items[index]
        index += 1
        if (!current) return
        await run(current)
      }
    }
  )
  await Promise.all(workers)
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
