import { dirname, isAbsolute, relative, resolve } from "node:path"
import { downloadFile, executeCommand, listFiles, uploadFile } from "./client"
import { resourceCachePathToSandbox } from "./resource-cache-path"
import type { Sandbox } from "@daytona/sdk"
import type {
  BashOperations,
  EditOperations,
  FindOperations,
  GrepOperations,
  LsOperations,
  ReadOperations,
  WriteOperations,
} from "@earendil-works/pi-coding-agent"

export type { Sandbox } from "@daytona/sdk"

export function assertPathWithinWorkspaceBound(
  absolutePath: string,
  boundRoot: string
): void {
  const resolvedPath = resolve(absolutePath)
  const resolvedRoot = resolve(boundRoot)
  const rel = relative(resolvedRoot, resolvedPath)
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(
      `Sandbox path escapes workspace bound (${boundRoot}): ${absolutePath}`
    )
  }
}

function guardPath(absolutePath: string, boundRoot?: string) {
  const path = resourceCachePathToSandbox(absolutePath)
  if (boundRoot) {
    assertPathWithinWorkspaceBound(path, boundRoot)
  }
  return path
}

export function createSandboxBashOperations(
  sandbox: Sandbox,
  boundRoot?: string
): BashOperations {
  return {
    exec: async (command, cwd, { onData, timeout }) => {
      cwd = guardPath(cwd, boundRoot)
      const result = await executeCommand(
        sandbox,
        command,
        cwd,
        undefined,
        timeout
      )
      if (result.result) {
        onData(Buffer.from(result.result))
      }
      return { exitCode: result.exitCode }
    },
  }
}

/**
 * Read and write file operations shared by the read and edit tool adapters.
 * The edit adapter uses the same three methods, so both adapters build on this.
 */
function createSandboxFileOperations(
  sandbox: Sandbox,
  boundRoot?: string
): EditOperations {
  return {
    readFile: (absolutePath) => {
      absolutePath = guardPath(absolutePath, boundRoot)
      return downloadFile(sandbox, absolutePath)
    },
    writeFile: async (absolutePath, content) => {
      absolutePath = guardPath(absolutePath, boundRoot)
      await uploadFile(sandbox, content, absolutePath)
    },
    access: async (absolutePath) => {
      absolutePath = guardPath(absolutePath, boundRoot)
      const dir = dirname(absolutePath)
      const name = absolutePath.slice(dir.length + 1)
      const entries = await listFiles(sandbox, dir)
      if (!entries.some((e) => e.name === name)) {
        throw new Error(`ENOENT: no such file: ${absolutePath}`)
      }
    },
  }
}

export function createSandboxReadOperations(
  sandbox: Sandbox,
  boundRoot?: string
): ReadOperations {
  const { readFile, access } = createSandboxFileOperations(sandbox, boundRoot)
  return { readFile, access }
}

export function createSandboxWriteOperations(
  sandbox: Sandbox,
  boundRoot?: string
): WriteOperations {
  return {
    writeFile: async (absolutePath, content) => {
      absolutePath = guardPath(absolutePath, boundRoot)
      await uploadFile(sandbox, content, absolutePath)
    },
    mkdir: async (dir) => {
      dir = guardPath(dir, boundRoot)
      const result = await executeCommand(
        sandbox,
        `mkdir -p ${shellEscape(dir)}`
      )
      if (result.exitCode !== 0) {
        throw new Error(
          `Failed to create sandbox directory ${dir}: ${result.result}`
        )
      }
    },
  }
}

export function createSandboxEditOperations(
  sandbox: Sandbox,
  boundRoot?: string
): EditOperations {
  return createSandboxFileOperations(sandbox, boundRoot)
}

export function createSandboxGrepOperations(
  sandbox: Sandbox,
  boundRoot?: string
): GrepOperations {
  return {
    isDirectory: async (absolutePath) => {
      absolutePath = guardPath(absolutePath, boundRoot)
      try {
        const entries = await listFiles(sandbox, dirname(absolutePath))
        const name = absolutePath.slice(dirname(absolutePath).length + 1)
        const entry = entries.find((e) => e.name === name)
        return entry?.isDir ?? false
      } catch {
        throw new Error(`ENOENT: ${absolutePath}`)
      }
    },
    readFile: async (absolutePath) => {
      absolutePath = guardPath(absolutePath, boundRoot)
      const buf = await downloadFile(sandbox, absolutePath)
      return buf.toString("utf-8")
    },
  }
}

export function createSandboxFindOperations(
  sandbox: Sandbox,
  boundRoot?: string
): FindOperations {
  return {
    exists: async (absolutePath) => {
      absolutePath = guardPath(absolutePath, boundRoot)
      try {
        const dir = dirname(absolutePath)
        const name = absolutePath.slice(dir.length + 1)
        if (!name) {
          await listFiles(sandbox, absolutePath)
          return true
        }
        const entries = await listFiles(sandbox, dir)
        return entries.some((e) => e.name === name)
      } catch {
        return false
      }
    },
    glob: async (pattern, cwd, { ignore, limit }) => {
      cwd = guardPath(cwd, boundRoot)
      const ignoreArgs = ignore
        .map((p) => `-not -path ${shellEscape(p)}`)
        .join(" ")
      const cmd = `find ${shellEscape(cwd)} -name ${shellEscape(pattern)} ${ignoreArgs} | head -n ${limit}`
      const result = await executeCommand(sandbox, cmd)
      if (result.exitCode !== 0) {
        throw new Error(`Sandbox find failed: ${result.result}`)
      }
      return result.result
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    },
  }
}

export function createSandboxLsOperations(
  sandbox: Sandbox,
  boundRoot?: string
): LsOperations {
  return {
    exists: async (absolutePath) => {
      absolutePath = guardPath(absolutePath, boundRoot)
      try {
        await listFiles(sandbox, absolutePath)
        return true
      } catch {
        try {
          const dir = dirname(absolutePath)
          const name = absolutePath.slice(dir.length + 1)
          const entries = await listFiles(sandbox, dir)
          return entries.some((e) => e.name === name)
        } catch {
          return false
        }
      }
    },
    stat: async (absolutePath) => {
      absolutePath = guardPath(absolutePath, boundRoot)
      const dir = dirname(absolutePath)
      const name = absolutePath.slice(dir.length + 1)
      if (!name) {
        return { isDirectory: () => true }
      }
      const entries = await listFiles(sandbox, dir)
      const entry = entries.find((e) => e.name === name)
      if (!entry) throw new Error(`ENOENT: ${absolutePath}`)
      return { isDirectory: () => entry.isDir }
    },
    readdir: async (absolutePath) => {
      absolutePath = guardPath(absolutePath, boundRoot)
      const entries = await listFiles(sandbox, absolutePath)
      return entries.map((e) => e.name)
    },
  }
}

export interface ToolOperations {
  bash: BashOperations
  read: ReadOperations
  write: WriteOperations
  edit: EditOperations
  grep: GrepOperations
  find: FindOperations
  ls: LsOperations
}

export function createSandboxOperations(
  sandbox: Sandbox,
  boundRoot: string
): ToolOperations {
  return {
    bash: createSandboxBashOperations(sandbox, boundRoot),
    read: createSandboxReadOperations(sandbox, boundRoot),
    write: createSandboxWriteOperations(sandbox, boundRoot),
    edit: createSandboxEditOperations(sandbox, boundRoot),
    grep: createSandboxGrepOperations(sandbox, boundRoot),
    find: createSandboxFindOperations(sandbox, boundRoot),
    ls: createSandboxLsOperations(sandbox, boundRoot),
  }
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}
