import { posix } from "node:path"

import {
  downloadFile,
  executeCommand,
  listFiles,
  uploadFile,
} from "../../daytona/client"
import { assertPathWithinWorkspaceBound } from "../../daytona/sandbox-operations"
import { USER_VOLUME_ROOT } from "../mutation-tier"

import type { HostedSandboxPort } from "./hosted-sandbox-env"

export function resolveHostedSandboxPath(path: string): string {
  const resolved = posix.resolve(USER_VOLUME_ROOT, path.replace(/\\/g, "/"))
  assertPathWithinWorkspaceBound(resolved, USER_VOLUME_ROOT)
  return resolved
}

/** Daytona sandbox behind the same port the scripted echo uses. */
export function daytonaSandboxPort(
  sandbox: Parameters<typeof executeCommand>[0]
): HostedSandboxPort {
  return {
    async read(path) {
      const resolvedPath = resolveHostedSandboxPath(path)
      const body = await downloadFile(sandbox, resolvedPath)
      return body.toString("utf8")
    },
    async write(path, content) {
      const resolvedPath = resolveHostedSandboxPath(path)
      await uploadFile(sandbox, content, resolvedPath)
    },
    async list(dir) {
      const resolvedPath = resolveHostedSandboxPath(dir)
      const entries = await listFiles(sandbox, resolvedPath)
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDir,
      }))
    },
    async exec(command) {
      const result = await executeCommand(sandbox, command, USER_VOLUME_ROOT)
      return { exitCode: result.exitCode, output: result.result }
    },
  }
}
