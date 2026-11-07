import { afterEach, describe, expect, it, vi } from "vitest"

import { loadSandboxRuntimeStatus } from "../sandbox-runtime-status"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("loadSandboxRuntimeStatus", () => {
  it("maps a ready sandbox response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          daytonaApiKeyConfigured: true,
          sandboxReady: false,
          volumeName: "fleet-pi-ws-user",
        }),
      })
    )

    await expect(loadSandboxRuntimeStatus()).resolves.toEqual({
      keyPresent: true,
      sandboxReady: false,
      volumeName: "fleet-pi-ws-user",
    })
  })

  it("returns null when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })
    )

    await expect(loadSandboxRuntimeStatus()).resolves.toBeNull()
  })

  it("returns null when the volume name is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          daytonaApiKeyConfigured: true,
          sandboxReady: true,
        }),
      })
    )

    await expect(loadSandboxRuntimeStatus()).resolves.toBeNull()
  })
})
