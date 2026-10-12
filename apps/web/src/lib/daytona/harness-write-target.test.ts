import { afterEach, describe, expect, it, vi } from "vitest"
import { resolveHarnessWriteTarget } from "./harness-write-target"
import {
  trackDaytonaToolSession,
  untrackDaytonaToolSession,
} from "./tool-context"

const getCachedUserSandbox = vi.hoisted(() => vi.fn())

vi.mock("./user-sandbox", () => ({
  getCachedUserSandbox,
}))

vi.mock("./client", () => ({
  executeCommand: vi.fn(),
  uploadFile: vi.fn(),
}))

const originalVercel = process.env.VERCEL

afterEach(() => {
  getCachedUserSandbox.mockReset()
  if (originalVercel === undefined) delete process.env.VERCEL
  else process.env.VERCEL = originalVercel
})

describe("resolveHarnessWriteTarget", () => {
  it("writes the host checkout for local sessions", () => {
    delete process.env.VERCEL
    expect(resolveHarnessWriteTarget({ cwd: "/repo" })).toEqual({
      kind: "host",
      cwd: "/repo",
    })
  })

  it("refuses the shared checkout on deployed chat without a sandbox", () => {
    process.env.VERCEL = "1"
    expect(resolveHarnessWriteTarget({ cwd: "/repo" })).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("Daytona sandbox"),
    })
  })

  it("targets the cached user sandbox when one is warm", () => {
    process.env.VERCEL = "1"
    const sandbox = { id: "sb" }
    getCachedUserSandbox.mockReturnValue({ sandbox })
    trackDaytonaToolSession("session-1", undefined, "user-1")

    expect(
      resolveHarnessWriteTarget({
        cwd: "/repo",
        sessionId: "session-1",
      })
    ).toEqual({ kind: "sandbox", sandbox })

    untrackDaytonaToolSession("session-1", undefined)
  })
})
