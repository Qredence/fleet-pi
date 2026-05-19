import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createSandboxBashOperations,
  createSandboxEditOperations,
  createSandboxFindOperations,
  createSandboxGrepOperations,
  createSandboxLsOperations,
  createSandboxReadOperations,
  createSandboxWriteOperations,
} from "./sandbox-operations"
import { downloadFile, executeCommand, listFiles, uploadFile } from "./client"
import type { Sandbox } from "@daytonaio/sdk"
import type * as DaytonaClientModule from "./client"

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof DaytonaClientModule>()
  return {
    ...actual,
    executeCommand: vi.fn(),
    downloadFile: vi.fn(),
    uploadFile: vi.fn(),
    listFiles: vi.fn(),
  }
})

const mockedExecuteCommand = vi.mocked(executeCommand)
const mockedDownloadFile = vi.mocked(downloadFile)
const mockedUploadFile = vi.mocked(uploadFile)
const mockedListFiles = vi.mocked(listFiles)

const sandbox = {} as Sandbox

afterEach(() => {
  vi.clearAllMocks()
})

describe("BashOperations", () => {
  it("executes command and streams output via onData", async () => {
    mockedExecuteCommand.mockResolvedValue({ result: "hello\n", exitCode: 0 })
    const ops = createSandboxBashOperations(sandbox)
    const chunks: Array<Buffer> = []

    const { exitCode } = await ops.exec("echo hello", "/home/daytona", {
      onData: (data) => chunks.push(data),
    })

    expect(exitCode).toBe(0)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].toString()).toBe("hello\n")
    expect(mockedExecuteCommand).toHaveBeenCalledWith(
      sandbox,
      "echo hello",
      "/home/daytona",
      undefined,
      undefined
    )
  })

  it("passes timeout through to executeCommand", async () => {
    mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 0 })
    const ops = createSandboxBashOperations(sandbox)

    await ops.exec("sleep 1", "/tmp", {
      onData: () => {},
      timeout: 5000,
    })

    expect(mockedExecuteCommand).toHaveBeenCalledWith(
      sandbox,
      "sleep 1",
      "/tmp",
      undefined,
      5000
    )
  })

  it("does not call onData when result is empty", async () => {
    mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 0 })
    const ops = createSandboxBashOperations(sandbox)
    const onData = vi.fn()

    await ops.exec("true", "/tmp", { onData })

    expect(onData).not.toHaveBeenCalled()
  })
})

describe("ReadOperations", () => {
  it("reads file via downloadFile", async () => {
    const content = Buffer.from("file content")
    mockedDownloadFile.mockResolvedValue(content)
    const ops = createSandboxReadOperations(sandbox)

    const result = await ops.readFile("/home/daytona/test.txt")

    expect(result).toBe(content)
    expect(mockedDownloadFile).toHaveBeenCalledWith(
      sandbox,
      "/home/daytona/test.txt"
    )
  })

  it("access succeeds when file exists in directory listing", async () => {
    mockedListFiles.mockResolvedValue([
      { name: "test.txt", size: 100, isDir: false },
    ])
    const ops = createSandboxReadOperations(sandbox)

    await expect(ops.access("/home/daytona/test.txt")).resolves.toBeUndefined()
  })

  it("access throws when file does not exist", async () => {
    mockedListFiles.mockResolvedValue([
      { name: "other.txt", size: 50, isDir: false },
    ])
    const ops = createSandboxReadOperations(sandbox)

    await expect(ops.access("/home/daytona/test.txt")).rejects.toThrow("ENOENT")
  })
})

describe("WriteOperations", () => {
  it("writes file via uploadFile", async () => {
    mockedUploadFile.mockResolvedValue()
    const ops = createSandboxWriteOperations(sandbox)

    await ops.writeFile("/home/daytona/out.txt", "content")

    expect(mockedUploadFile).toHaveBeenCalledWith(
      sandbox,
      "content",
      "/home/daytona/out.txt"
    )
  })

  it("creates directory via mkdir -p command", async () => {
    mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 0 })
    const ops = createSandboxWriteOperations(sandbox)

    await ops.mkdir("/home/daytona/deep/nested/dir")

    expect(mockedExecuteCommand).toHaveBeenCalledWith(
      sandbox,
      "mkdir -p '/home/daytona/deep/nested/dir'"
    )
  })

  it("throws when mkdir fails", async () => {
    mockedExecuteCommand.mockResolvedValue({
      result: "permission denied",
      exitCode: 1,
    })
    const ops = createSandboxWriteOperations(sandbox)

    await expect(ops.mkdir("/home/daytona/deep")).rejects.toThrow(
      "Failed to create sandbox directory"
    )
  })
})

describe("EditOperations", () => {
  it("reads and writes files for edit operations", async () => {
    const content = Buffer.from("original")
    mockedDownloadFile.mockResolvedValue(content)
    mockedUploadFile.mockResolvedValue()
    const ops = createSandboxEditOperations(sandbox)

    const readResult = await ops.readFile("/home/daytona/file.ts")
    expect(readResult).toBe(content)

    await ops.writeFile("/home/daytona/file.ts", "modified")
    expect(mockedUploadFile).toHaveBeenCalledWith(
      sandbox,
      "modified",
      "/home/daytona/file.ts"
    )
  })

  it("access checks file existence", async () => {
    mockedListFiles.mockResolvedValue([
      { name: "file.ts", size: 200, isDir: false },
    ])
    const ops = createSandboxEditOperations(sandbox)

    await expect(ops.access("/home/daytona/file.ts")).resolves.toBeUndefined()
  })
})

describe("GrepOperations", () => {
  it("detects directory via listFiles", async () => {
    mockedListFiles.mockResolvedValue([{ name: "src", size: 0, isDir: true }])
    const ops = createSandboxGrepOperations(sandbox)

    const result = await ops.isDirectory("/home/daytona/src")
    expect(result).toBe(true)
  })

  it("reads file as string for context lines", async () => {
    mockedDownloadFile.mockResolvedValue(Buffer.from("line1\nline2"))
    const ops = createSandboxGrepOperations(sandbox)

    const result = await ops.readFile("/home/daytona/file.ts")
    expect(result).toBe("line1\nline2")
  })
})

describe("FindOperations", () => {
  it("checks existence of files via listFiles", async () => {
    mockedListFiles.mockResolvedValue([
      { name: "index.ts", size: 300, isDir: false },
    ])
    const ops = createSandboxFindOperations(sandbox)

    const exists = await ops.exists("/home/daytona/index.ts")
    expect(exists).toBe(true)
  })

  it("returns false for non-existent files", async () => {
    mockedListFiles.mockRejectedValue(new Error("not found"))
    const ops = createSandboxFindOperations(sandbox)

    const exists = await ops.exists("/home/daytona/missing.ts")
    expect(exists).toBe(false)
  })

  it("executes find command and parses output", async () => {
    mockedExecuteCommand.mockResolvedValue({
      result: "/home/daytona/a.ts\n/home/daytona/b.ts\n",
      exitCode: 0,
    })
    const ops = createSandboxFindOperations(sandbox)

    const results = await ops.glob("*.ts", "/home/daytona", {
      ignore: ["node_modules"],
      limit: 100,
    })

    expect(results).toEqual(["/home/daytona/a.ts", "/home/daytona/b.ts"])
  })

  it("throws when find exits non-zero", async () => {
    mockedExecuteCommand.mockResolvedValue({
      result: "missing cwd",
      exitCode: 1,
    })
    const ops = createSandboxFindOperations(sandbox)

    await expect(
      ops.glob("*.ts", "/home/daytona/missing", {
        ignore: [],
        limit: 100,
      })
    ).rejects.toThrow("Sandbox find failed")
  })
})

describe("LsOperations", () => {
  it("checks directory existence", async () => {
    mockedListFiles.mockResolvedValue([])
    const ops = createSandboxLsOperations(sandbox)

    const exists = await ops.exists("/home/daytona/src")
    expect(exists).toBe(true)
  })

  it("reads directory entries", async () => {
    mockedListFiles.mockResolvedValue([
      { name: "a.ts", size: 100, isDir: false },
      { name: "b.ts", size: 200, isDir: false },
    ])
    const ops = createSandboxLsOperations(sandbox)

    const entries = await ops.readdir("/home/daytona/src")
    expect(entries).toEqual(["a.ts", "b.ts"])
  })

  it("stats a file for isDirectory check", async () => {
    mockedListFiles.mockResolvedValue([{ name: "src", size: 0, isDir: true }])
    const ops = createSandboxLsOperations(sandbox)

    const stat = await ops.stat("/home/daytona/src")
    expect(stat.isDirectory()).toBe(true)
  })
})
