import { constants } from "node:fs"
import {
  access,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises"

export interface WorkspaceFSStat {
  isDirectory: () => boolean
  isFile: () => boolean
  size?: number
}

export interface WorkspaceDirEntry {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
}

export interface WorkspaceFS {
  stat: (absolutePath: string) => Promise<WorkspaceFSStat>
  access: (absolutePath: string) => Promise<void>
  mkdir: (
    absolutePath: string,
    options?: { recursive?: boolean }
  ) => Promise<void>
  writeFile: (
    absolutePath: string,
    content: string,
    options?: { flag?: string }
  ) => Promise<void>
  readFile: (absolutePath: string, encoding: BufferEncoding) => Promise<string>
  readdir: (absolutePath: string) => Promise<Array<WorkspaceDirEntry>>
}

export function createLocalWorkspaceFS(): WorkspaceFS {
  return {
    stat: async (absolutePath) => {
      const s = await stat(absolutePath)
      return {
        isDirectory: () => s.isDirectory(),
        isFile: () => s.isFile(),
        size: s.size,
      }
    },
    access: (absolutePath) => access(absolutePath, constants.R_OK),
    mkdir: (absolutePath, options) =>
      mkdir(absolutePath, options).then(() => undefined),
    writeFile: (absolutePath, content, options) =>
      writeFile(absolutePath, content, options),
    readFile: (absolutePath, encoding) => readFile(absolutePath, encoding),
    readdir: async (absolutePath) => {
      const entries = await readdir(absolutePath, { withFileTypes: true })
      return entries.map((e) => ({
        name: e.name,
        isDirectory: () => e.isDirectory(),
        isFile: () => e.isFile(),
      }))
    },
  }
}

export interface SandboxFSOperations {
  executeCommand: (
    command: string,
    cwd?: string
  ) => Promise<{ result: string; exitCode: number }>
}

export function createSandboxWorkspaceFS(
  ops: SandboxFSOperations
): WorkspaceFS {
  return {
    stat: async (absolutePath) => {
      const result = await ops.executeCommand(
        `stat -c '%F %s' ${shellEscape(absolutePath)}`
      )
      if (result.exitCode !== 0) {
        const err = new Error(
          `ENOENT: no such file or directory, stat '${absolutePath}'`
        ) as NodeJS.ErrnoException
        err.code = "ENOENT"
        throw err
      }
      const statOutput = result.result.trim()
      const sizeMatch = statOutput.match(/ (\d+)$/)
      const type =
        sizeMatch && sizeMatch.index !== undefined
          ? statOutput.substring(0, sizeMatch.index)
          : statOutput
      return {
        isDirectory: () => type === "directory",
        isFile: () => type === "regular file" || type === "regular empty file",
        size: sizeMatch ? Number(sizeMatch[1]) : undefined,
      }
    },
    access: async (absolutePath) => {
      const result = await ops.executeCommand(
        `test -r ${shellEscape(absolutePath)}`
      )
      if (result.exitCode !== 0) {
        const err = new Error(
          `ENOENT: no such file or directory, access '${absolutePath}'`
        ) as NodeJS.ErrnoException
        err.code = "ENOENT"
        throw err
      }
    },
    mkdir: async (absolutePath, options) => {
      const flag = options?.recursive ? "-p " : ""
      const result = await ops.executeCommand(
        `mkdir ${flag}${shellEscape(absolutePath)}`
      )
      if (result.exitCode !== 0) {
        throwFsError("EIO", `mkdir '${absolutePath}'`, result.result)
      }
    },
    writeFile: async (absolutePath, content, options) => {
      if (options?.flag === "wx") {
        const exists = await ops.executeCommand(
          `test -e ${shellEscape(absolutePath)}`
        )
        if (exists.exitCode === 0) {
          const err = new Error(
            `EEXIST: file already exists, open '${absolutePath}'`
          ) as NodeJS.ErrnoException
          err.code = "EEXIST"
          throw err
        }
      }
      const dir = absolutePath.substring(0, absolutePath.lastIndexOf("/"))
      if (dir) {
        const mkdirResult = await ops.executeCommand(
          `mkdir -p ${shellEscape(dir)}`
        )
        if (mkdirResult.exitCode !== 0) {
          throwFsError("EIO", `mkdir '${dir}'`, mkdirResult.result)
        }
      }
      // Write via base64 echo to avoid shell escaping issues and Daytona SDK's
      // form-data upload path (which has a CJS/ESM interop issue in Vite's module runner).
      const b64 = Buffer.from(content, "utf-8").toString("base64")
      const writeResult = await ops.executeCommand(
        `echo ${shellEscape(b64)} | base64 -d > ${shellEscape(absolutePath)}`
      )
      if (writeResult.exitCode !== 0) {
        throwFsError("EIO", `open '${absolutePath}'`, writeResult.result)
      }
    },
    readFile: async (absolutePath, _encoding) => {
      const result = await ops.executeCommand(
        `cat ${shellEscape(absolutePath)}`
      )
      if (result.exitCode !== 0) {
        const err = new Error(
          `ENOENT: no such file or directory, open '${absolutePath}'`
        ) as NodeJS.ErrnoException
        err.code = "ENOENT"
        throw err
      }
      return result.result
    },
    readdir: async (absolutePath) => {
      const result = await ops.executeCommand(
        `find ${shellEscape(absolutePath)} -maxdepth 1 -mindepth 1 -printf '%y %f\\n'`
      )
      if (result.exitCode !== 0) {
        const err = new Error(
          `ENOENT: no such file or directory, scandir '${absolutePath}'`
        ) as NodeJS.ErrnoException
        err.code = "ENOENT"
        throw err
      }
      return result.result
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const type = line[0]
          const name = line.substring(2)
          return {
            name,
            isDirectory: () => type === "d",
            isFile: () => type === "f",
          }
        })
    },
  }
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

function throwFsError(code: string, operation: string, output: string): never {
  const err = new Error(
    `${code}: sandbox filesystem operation failed, ${operation}${output ? `: ${output}` : ""}`
  ) as NodeJS.ErrnoException
  err.code = code
  throw err
}
