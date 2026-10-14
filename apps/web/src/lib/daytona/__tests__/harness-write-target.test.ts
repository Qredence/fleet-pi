import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it, vi } from "vitest"
import { executeCommand, uploadFile } from "../client"
import {
  resolveHarnessWriteTarget,
  uploadAgentWorkspaceTree,
} from "../harness-write-target"
import { SANDBOX_WARMING_MESSAGE } from "../resolve-ready-sandbox"
import {
  trackDaytonaToolSession,
  untrackDaytonaToolSession,
} from "../tool-context"
import type { Sandbox } from "@daytona/sdk"
import type { UserSandboxHandle } from "../user-sandbox"

const getCachedUserSandbox = vi.hoisted(() => vi.fn())
const getInFlightUserSandbox = vi.hoisted(() => vi.fn())

vi.mock("../user-sandbox", () => ({
  getCachedUserSandbox,
  getInFlightUserSandbox,
}))

vi.mock("../client", () => ({
  executeCommand: vi.fn(),
  uploadFile: vi.fn(),
}))

const originalHosted = process.env.FLEET_PI_DEPLOYMENT

afterEach(() => {
  getCachedUserSandbox.mockReset()
  getInFlightUserSandbox.mockReset()
  if (originalHosted === undefined) delete process.env.FLEET_PI_DEPLOYMENT
  else process.env.FLEET_PI_DEPLOYMENT = originalHosted
})

describe("resolveHarnessWriteTarget", () => {
  it("preserves binary package assets on upload", async () => {
    const root = await mkdtemp(join(tmpdir(), "fleet-binary-upload-"))
    try {
      const directory = join(root, "agent-workspace/pi/packages/test")
      await mkdir(directory, { recursive: true })
      const bytes = Buffer.from("0061736dff", "hex")
      await writeFile(join(directory, "module.wasm"), bytes)
      vi.mocked(executeCommand).mockImplementation((_sandbox, command) => {
        if (String(command).includes("test -e")) {
          return Promise.resolve({ exitCode: 1, result: "" })
        }
        return Promise.resolve({ exitCode: 0, result: "" })
      })
      const sandbox = { id: "binary" } as Sandbox
      await uploadAgentWorkspaceTree(sandbox, root)
      expect(uploadFile).toHaveBeenCalledWith(
        sandbox,
        bytes,
        "/home/daytona/agent-workspace/pi/packages/test/module.wasm"
      )
      const mkdirCalls = vi
        .mocked(executeCommand)
        .mock.calls.filter((call) => String(call[1]).startsWith("mkdir -p"))
      expect(mkdirCalls.length).toBe(1)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it("leaves an existing user file untouched", async () => {
    vi.mocked(uploadFile).mockClear()
    const root = await mkdtemp(join(tmpdir(), "fleet-seed-skip-"))
    try {
      const directory = join(root, "agent-workspace/memory")
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, "notes.md"), "seed")
      vi.mocked(executeCommand).mockImplementation((_sandbox, command) => {
        if (String(command).includes("test -e")) {
          return Promise.resolve({ exitCode: 0, result: "" })
        }
        return Promise.resolve({ exitCode: 0, result: "" })
      })
      const sandbox = { id: "seed" } as Sandbox
      await uploadAgentWorkspaceTree(sandbox, root)
      expect(uploadFile).not.toHaveBeenCalled()
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it("writes the host checkout for local sessions", async () => {
    delete process.env.FLEET_PI_DEPLOYMENT
    await expect(resolveHarnessWriteTarget({ cwd: "/repo" })).resolves.toEqual({
      kind: "host",
      cwd: "/repo",
    })
  })

  it("refuses the shared checkout on deployed chat without a sandbox", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    await expect(resolveHarnessWriteTarget({ cwd: "/repo" })).resolves.toEqual({
      kind: "unavailable",
      message: expect.stringContaining("Daytona sandbox"),
    })
  })

  it("targets the cached user sandbox when one is warm", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    const sandbox = { id: "sb" }
    getCachedUserSandbox.mockReturnValue({ sandbox })
    trackDaytonaToolSession("session-1", undefined, "user-1")

    await expect(
      resolveHarnessWriteTarget({
        cwd: "/repo",
        sessionId: "session-1",
      })
    ).resolves.toEqual({ kind: "sandbox", sandbox })

    untrackDaytonaToolSession("session-1", undefined)
  })

  it("waits for a sandbox warm-up that is already in flight", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    const sandbox = { id: "warming" }
    getCachedUserSandbox.mockReturnValue(undefined)
    getInFlightUserSandbox.mockReturnValue(Promise.resolve({ sandbox }))
    trackDaytonaToolSession("session-2", undefined, "user-2")

    await expect(
      resolveHarnessWriteTarget({
        cwd: "/repo",
        sessionId: "session-2",
      })
    ).resolves.toEqual({ kind: "sandbox", sandbox })

    untrackDaytonaToolSession("session-2", undefined)
  })

  it("returns a warming error when sandbox start exceeds the timeout", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    getCachedUserSandbox.mockReturnValue(undefined)
    getInFlightUserSandbox.mockReturnValue(undefined)
    trackDaytonaToolSession("session-3", undefined, "user-3")
    const startWarmUp = vi.fn(() => new Promise<UserSandboxHandle>(() => {}))

    await expect(
      resolveHarnessWriteTarget(
        { cwd: "/repo", sessionId: "session-3" },
        {
          timeoutMs: 20,
          resolveApiKey: () => Promise.resolve("byok-key"),
          startWarmUp,
        }
      )
    ).resolves.toEqual({
      kind: "unavailable",
      message: SANDBOX_WARMING_MESSAGE,
    })
    expect(startWarmUp).toHaveBeenCalledWith({
      userId: "user-3",
      apiKey: "byok-key",
    })

    untrackDaytonaToolSession("session-3", undefined)
  })

  it("does not start a sandbox when the user has no Daytona key", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    getCachedUserSandbox.mockReturnValue(undefined)
    getInFlightUserSandbox.mockReturnValue(undefined)
    trackDaytonaToolSession("session-4", undefined, "user-4")
    const startWarmUp = vi.fn()

    await expect(
      resolveHarnessWriteTarget(
        { cwd: "/repo", sessionId: "session-4" },
        {
          resolveApiKey: () => Promise.resolve(undefined),
          startWarmUp,
        }
      )
    ).resolves.toEqual({
      kind: "unavailable",
      message: expect.stringContaining("Daytona sandbox"),
    })
    expect(startWarmUp).not.toHaveBeenCalled()

    untrackDaytonaToolSession("session-4", undefined)
  })
})
