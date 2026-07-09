import { dirname } from "node:path"
import { downloadFile, executeCommand, listFiles, uploadFile } from "./client"
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

export function createSandboxBashOperations(sandbox: Sandbox): BashOperations {
  return {
    exec: async (command, cwd, { onData, timeout }) => {
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

export function createSandboxReadOperations(sandbox: Sandbox): ReadOperations {
  return {
    readFile: (absolutePath) => downloadFile(sandbox, absolutePath),
    access: async (absolutePath) => {
      const dir = dirname(absolutePath)
      const name = absolutePath.slice(dir.length + 1)
      const entries = await listFiles(sandbox, dir)
      if (!entries.some((e) => e.name === name)) {
        throw new Error(`ENOENT: no such file: ${absolutePath}`)
      }
    },
  }
}

export function createSandboxWriteOperations(
  sandbox: Sandbox
): WriteOperations {
  return {
    writeFile: async (absolutePath, content) => {
      await uploadFile(sandbox, content, absolutePath)
    },
    mkdir: async (dir) => {
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

export function createSandboxEditOperations(sandbox: Sandbox): EditOperations {
  return {
    readFile: (absolutePath) => downloadFile(sandbox, absolutePath),
    writeFile: async (absolutePath, content) => {
      await uploadFile(sandbox, content, absolutePath)
    },
    access: async (absolutePath) => {
      const dir = dirname(absolutePath)
      const name = absolutePath.slice(dir.length + 1)
      const entries = await listFiles(sandbox, dir)
      if (!entries.some((e) => e.name === name)) {
        throw new Error(`ENOENT: no such file: ${absolutePath}`)
      }
    },
  }
}

export function createSandboxGrepOperations(sandbox: Sandbox): GrepOperations {
  return {
    isDirectory: async (absolutePath) => {
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
      const buf = await downloadFile(sandbox, absolutePath)
      return buf.toString("utf-8")
    },
  }
}

export function createSandboxFindOperations(sandbox: Sandbox): FindOperations {
  return {
    exists: async (absolutePath) => {
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

export function createSandboxLsOperations(sandbox: Sandbox): LsOperations {
  return {
    exists: async (absolutePath) => {
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

export function createSandboxOperations(sandbox: Sandbox): ToolOperations {
  return {
    bash: createSandboxBashOperations(sandbox),
    read: createSandboxReadOperations(sandbox),
    write: createSandboxWriteOperations(sandbox),
    edit: createSandboxEditOperations(sandbox),
    grep: createSandboxGrepOperations(sandbox),
    find: createSandboxFindOperations(sandbox),
    ls: createSandboxLsOperations(sandbox),
  }
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}
