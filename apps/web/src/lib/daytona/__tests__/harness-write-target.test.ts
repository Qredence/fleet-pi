import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it, vi } from "vitest"
import { executeCommand, uploadFile } from "../client"
import {
  resolveHarnessWriteTarget,
  uploadAgentWorkspaceTree,
} from "../harness-write-target"
import {
  trackDaytonaToolSession,
  untrackDaytonaToolSession,
} from "../tool-context"
import type { Sandbox } from "@daytona/sdk"

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
})
