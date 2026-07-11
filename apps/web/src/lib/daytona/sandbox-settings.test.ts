import { describe, expect, it, vi } from "vitest"
import {
  DEFAULT_SANDBOX_SETTINGS,
  ensureSandboxSettingsSeeded,
  isEmptySettingsFile,
} from "./sandbox-settings"
import { downloadFile, executeCommand, uploadFile } from "./client"
import type { Sandbox } from "@daytona/sdk"

vi.mock("./client", () => ({
  downloadFile: vi.fn(),
  executeCommand: vi.fn(),
  uploadFile: vi.fn(),
}))

describe("sandbox-settings", () => {
  it("treats empty objects as empty settings files", () => {
    expect(isEmptySettingsFile({})).toBe(true)
    expect(isEmptySettingsFile({ packages: [] })).toBe(false)
  })

  it("seeds default settings when sandbox file is missing/empty", async () => {
    vi.mocked(downloadFile).mockRejectedValueOnce(new Error("missing"))
    vi.mocked(executeCommand).mockResolvedValueOnce({
      exitCode: 0,
      result: "",
    })
    vi.mocked(uploadFile).mockResolvedValueOnce(undefined)

    const sandbox = {} as Sandbox
    const seeded = await ensureSandboxSettingsSeeded(sandbox)

    expect(seeded).toEqual(DEFAULT_SANDBOX_SETTINGS)
    expect(uploadFile).toHaveBeenCalled()
    const uploaded = vi.mocked(uploadFile).mock.calls[0]?.[0]
    expect(uploaded).toBe(sandbox)
  })

  it("does not overwrite non-empty sandbox settings", async () => {
    vi.mocked(downloadFile).mockResolvedValueOnce(
      Buffer.from(JSON.stringify({ packages: ["npm:existing"] }), "utf8")
    )
    vi.mocked(uploadFile).mockClear()

    const seeded = await ensureSandboxSettingsSeeded({} as Sandbox)

    expect(seeded).toEqual({ packages: ["npm:existing"] })
    expect(uploadFile).not.toHaveBeenCalled()
  })
})
