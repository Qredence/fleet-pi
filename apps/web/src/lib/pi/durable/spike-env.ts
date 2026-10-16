import { FileError, err, ok } from "@earendil-works/pi-durable/env"
import type { ExecutionEnv } from "@earendil-works/pi-durable/env"
import type { Context } from "@earendil-works/chord"

export type SpikeCommandResult = {
  exitCode: number
  output: string
}

/** Files and shell calls the spike environment can make. */
export type SpikeSandboxPort = {
  read: (path: string) => Promise<string>
  write: (path: string, content: string) => Promise<void>
  exec: (command: string) => Promise<SpikeCommandResult>
}

type ShellOptions = {
  onOutput?: (
    text: string,
    context: Context,
    info: { stream: "stdout" | "stderr" }
  ) => void
}

const unsupportedFileMethods = [
  "absolutePath",
  "joinPath",
  "openTextLineReader",
  "readTextLines",
  "readBinaryFile",
  "openBinaryReader",
  "appendFile",
  "truncateFile",
  "flushFile",
  "renameFile",
  "fileInfo",
  "listDir",
  "openDirReader",
  "watch",
  "canonicalPath",
  "exists",
  "createDir",
  "remove",
  "createTempDir",
  "createTempFile",
] as const

function unsupported(method: string) {
  return () => Promise.resolve(err(new FileError("not_supported", method)))
}

/**
 * One execution environment for every spike tool. Daytona and the scripted
 * echo both implement `SpikeSandboxPort`, so replay sees the same shell.
 */
export function createSpikeExecutionEnv(
  id: string,
  port: SpikeSandboxPort
): ExecutionEnv {
  const env: Record<string, unknown> = {
    id,
    cwd: "/home/daytona/agent-workspace",
    readTextFile: async (path: string) => ok(await port.read(path)),
    writeFile: async (path: string, content: string | Uint8Array) => {
      const text =
        typeof content === "string"
          ? content
          : new TextDecoder().decode(content)
      await port.write(path, text)
      return ok(undefined)
    },
    exec: async (
      command: string | ReadonlyArray<string>,
      options: ShellOptions | undefined,
      context: Context
    ) => {
      const line = typeof command === "string" ? command : command.join(" ")
      const result = await port.exec(line)
      options?.onOutput?.(result.output, context, { stream: "stdout" })
      return ok({ exitCode: result.exitCode })
    },
    cleanup: (_context: Context) => Promise.resolve(),
  }
  for (const method of unsupportedFileMethods) {
    env[method] = unsupported(method)
  }
  return env as unknown as ExecutionEnv
}
