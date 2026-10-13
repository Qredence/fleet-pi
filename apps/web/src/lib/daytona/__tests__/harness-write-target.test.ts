import { afterEach, describe, expect, it, vi } from "vitest"
import { resolveHarnessWriteTarget } from "../harness-write-target"
import {
  trackDaytonaToolSession,
  untrackDaytonaToolSession,
} from "../tool-context"

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

const originalVercel = process.env.VERCEL

afterEach(() => {
  getCachedUserSandbox.mockReset()
  getInFlightUserSandbox.mockReset()
  if (originalVercel === undefined) delete process.env.VERCEL
  else process.env.VERCEL = originalVercel
})

describe("resolveHarnessWriteTarget", () => {
  it("writes the host checkout for local sessions", async () => {
    delete process.env.VERCEL
    await expect(resolveHarnessWriteTarget({ cwd: "/repo" })).resolves.toEqual({
      kind: "host",
      cwd: "/repo",
    })
  })

  it("refuses the shared checkout on deployed chat without a sandbox", async () => {
    process.env.VERCEL = "1"
    await expect(resolveHarnessWriteTarget({ cwd: "/repo" })).resolves.toEqual({
      kind: "unavailable",
      message: expect.stringContaining("Daytona sandbox"),
    })
  })

  it("targets the cached user sandbox when one is warm", async () => {
    process.env.VERCEL = "1"
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
    process.env.VERCEL = "1"
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
