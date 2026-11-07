import { describe, expect, it } from "vitest"

import { nextSandboxRuntimeStatus } from "../sandbox-runtime-status"

const current = {
  keyPresent: true,
  sandboxReady: true,
  volumeName: "fleet-pi-ws-user",
}

describe("nextSandboxRuntimeStatus", () => {
  it("keeps the current volume when a refresh fails", () => {
    expect(nextSandboxRuntimeStatus(current, null)).toBe(current)
    expect(nextSandboxRuntimeStatus(current, undefined)).toBe(current)
  })

  it("replaces the current volume when a refresh returns one", () => {
    const next = { ...current, volumeName: "fleet-pi-ws-next" }

    expect(nextSandboxRuntimeStatus(current, next)).toBe(next)
    expect(nextSandboxRuntimeStatus(null, next)).toBe(next)
  })
})
