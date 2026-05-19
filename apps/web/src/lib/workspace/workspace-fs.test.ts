import { afterEach, describe, expect, it, vi } from "vitest"
import { createSandboxWorkspaceFS } from "./workspace-fs"

const mockedExecuteCommand = vi.fn()

const ops = { executeCommand: mockedExecuteCommand }

afterEach(() => {
  vi.clearAllMocks()
})

describe("SandboxWorkspaceFS", () => {
  describe("stat", () => {
    it("detects directories", async () => {
      mockedExecuteCommand.mockResolvedValue({
        result: "directory\n",
        exitCode: 0,
      })
      const fs = createSandboxWorkspaceFS(ops)

      const s = await fs.stat("/home/daytona/fleet-pi/agent-workspace")
      expect(s.isDirectory()).toBe(true)
      expect(s.isFile()).toBe(false)
    })

    it("detects regular files", async () => {
      mockedExecuteCommand.mockResolvedValue({
        result: "regular file\n",
        exitCode: 0,
      })
      const fs = createSandboxWorkspaceFS(ops)

      const s = await fs.stat(
        "/home/daytona/fleet-pi/agent-workspace/manifest.json"
      )
      expect(s.isDirectory()).toBe(false)
      expect(s.isFile()).toBe(true)
    })

    it("detects regular empty files", async () => {
      mockedExecuteCommand.mockResolvedValue({
        result: "regular empty file\n",
        exitCode: 0,
      })
      const fs = createSandboxWorkspaceFS(ops)

      const s = await fs.stat("/home/daytona/fleet-pi/agent-workspace/.gitkeep")
      expect(s.isFile()).toBe(true)
    })

    it("throws ENOENT when path does not exist", async () => {
      mockedExecuteCommand.mockResolvedValue({
        result: "stat: cannot statx '/nonexistent': No such file\n",
        exitCode: 1,
      })
      const fs = createSandboxWorkspaceFS(ops)

      await expect(fs.stat("/nonexistent")).rejects.toMatchObject({
        code: "ENOENT",
      })
    })
  })

  describe("access", () => {
    it("succeeds when file is readable", async () => {
      mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 0 })
      const fs = createSandboxWorkspaceFS(ops)

      await expect(
        fs.access("/home/daytona/fleet-pi/agent-workspace")
      ).resolves.toBeUndefined()
    })

    it("throws ENOENT when file does not exist", async () => {
      mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 1 })
      const fs = createSandboxWorkspaceFS(ops)

      await expect(
        fs.access("/home/daytona/nonexistent")
      ).rejects.toMatchObject({ code: "ENOENT" })
    })
  })

  describe("mkdir", () => {
    it("creates directory with recursive flag", async () => {
      mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 0 })
      const fs = createSandboxWorkspaceFS(ops)

      await fs.mkdir("/home/daytona/fleet-pi/agent-workspace/deep/nested", {
        recursive: true,
      })

      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        "mkdir -p '/home/daytona/fleet-pi/agent-workspace/deep/nested'"
      )
    })

    it("creates directory without recursive flag", async () => {
      mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 0 })
      const fs = createSandboxWorkspaceFS(ops)

      await fs.mkdir("/home/daytona/fleet-pi/agent-workspace/new")

      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        "mkdir '/home/daytona/fleet-pi/agent-workspace/new'"
      )
    })
  })

  describe("writeFile", () => {
    it("writes content via base64 echo", async () => {
      mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 0 })
      const fs = createSandboxWorkspaceFS(ops)

      await fs.writeFile(
        "/home/daytona/fleet-pi/agent-workspace/test.md",
        "hello world"
      )

      const calls = mockedExecuteCommand.mock.calls
      const writeCall = calls.find((c: Array<string>) =>
        c[0].includes("base64 -d")
      )
      expect(writeCall).toBeDefined()
      // Verify the base64 decodes back to the original content
      const b64Match = writeCall![0].match(/echo '([^']+)' \| base64 -d >/)
      expect(b64Match).toBeTruthy()
      expect(Buffer.from(b64Match![1], "base64").toString("utf-8")).toBe(
        "hello world"
      )
    })

    it("throws EEXIST when flag is wx and file exists", async () => {
      mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 0 }) // test -e succeeds = file exists
      const fs = createSandboxWorkspaceFS(ops)

      await expect(
        fs.writeFile(
          "/home/daytona/fleet-pi/agent-workspace/existing.md",
          "content",
          { flag: "wx" }
        )
      ).rejects.toMatchObject({ code: "EEXIST" })
    })

    it("writes when flag is wx and file does not exist", async () => {
      mockedExecuteCommand
        .mockResolvedValueOnce({ result: "", exitCode: 1 }) // test -e fails = file doesn't exist
        .mockResolvedValue({ result: "", exitCode: 0 }) // mkdir + write succeed

      const fs = createSandboxWorkspaceFS(ops)

      await fs.writeFile(
        "/home/daytona/fleet-pi/agent-workspace/new.md",
        "content",
        { flag: "wx" }
      )

      const calls = mockedExecuteCommand.mock.calls
      const writeCall = calls.find((c: Array<string>) =>
        c[0].includes("base64 -d")
      )
      expect(writeCall).toBeDefined()
    })
  })

  describe("readFile", () => {
    it("reads file content via cat", async () => {
      mockedExecuteCommand.mockResolvedValue({
        result: '{"version":1}',
        exitCode: 0,
      })
      const fs = createSandboxWorkspaceFS(ops)

      const content = await fs.readFile(
        "/home/daytona/fleet-pi/agent-workspace/manifest.json",
        "utf8"
      )

      expect(content).toBe('{"version":1}')
      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        "cat '/home/daytona/fleet-pi/agent-workspace/manifest.json'"
      )
    })

    it("throws ENOENT when file does not exist", async () => {
      mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 1 })
      const fs = createSandboxWorkspaceFS(ops)

      await expect(fs.readFile("/missing.json", "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      })
    })
  })

  describe("readdir", () => {
    it("lists directory entries with types", async () => {
      mockedExecuteCommand.mockResolvedValue({
        result: "d instructions\nf manifest.json\nd memory\nf README.md\n",
        exitCode: 0,
      })
      const fs = createSandboxWorkspaceFS(ops)

      const entries = await fs.readdir("/home/daytona/fleet-pi/agent-workspace")

      expect(entries).toHaveLength(4)
      expect(entries[0]).toMatchObject({ name: "instructions" })
      expect(entries[0].isDirectory()).toBe(true)
      expect(entries[0].isFile()).toBe(false)
      expect(entries[1]).toMatchObject({ name: "manifest.json" })
      expect(entries[1].isDirectory()).toBe(false)
      expect(entries[1].isFile()).toBe(true)
    })

    it("throws ENOENT when directory does not exist", async () => {
      mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 1 })
      const fs = createSandboxWorkspaceFS(ops)

      await expect(fs.readdir("/nonexistent")).rejects.toMatchObject({
        code: "ENOENT",
      })
    })

    it("returns empty array for empty directory", async () => {
      mockedExecuteCommand.mockResolvedValue({ result: "", exitCode: 0 })
      const fs = createSandboxWorkspaceFS(ops)

      const entries = await fs.readdir(
        "/home/daytona/fleet-pi/agent-workspace/empty"
      )
      expect(entries).toHaveLength(0)
    })
  })
})
