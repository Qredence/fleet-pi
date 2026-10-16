import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  resolveDaytonaRuntimeApiKey: vi.fn(),
  getCachedUserSandbox: vi.fn(),
  getSandboxStatus: vi.fn(),
  createDaytonaClient: vi.fn(),
}))

vi.mock("../../runtime/user-provider-secrets", () => ({
  resolveDaytonaRuntimeApiKey: mocks.resolveDaytonaRuntimeApiKey,
}))

vi.mock("../../../daytona/user-sandbox", async () => {
  const actual = await vi.importActual("../../../daytona/user-sandbox")
  return {
    ...actual,
    getCachedUserSandbox: mocks.getCachedUserSandbox,
  }
})

vi.mock("../../../daytona/client", () => ({
  createDaytonaClient: mocks.createDaytonaClient,
  getSandboxStatus: mocks.getSandboxStatus,
}))

describe("readHostedSandboxStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveDaytonaRuntimeApiKey.mockResolvedValue("daytona-key")
    mocks.getCachedUserSandbox.mockReturnValue(undefined)
    mocks.createDaytonaClient.mockReturnValue({
      get: vi.fn().mockResolvedValue({ id: "sandbox-live", name: "fleet" }),
    })
  })

  it("returns not ready when no API key is configured", async () => {
    mocks.resolveDaytonaRuntimeApiKey.mockResolvedValue(undefined)
    const { readHostedSandboxStatus } = await import("../durable-sandbox")
    await expect(readHostedSandboxStatus("user-1")).resolves.toEqual({
      keyPresent: false,
      sandboxReady: false,
      volumeName: "fleet-pi-ws-user-1",
    })
  })

  it("revalidates cached sandboxes before reporting ready", async () => {
    mocks.getCachedUserSandbox.mockReturnValue({
      sandboxId: "cached-id",
      sandbox: { id: "cached-id" },
    })
    mocks.getSandboxStatus
      .mockResolvedValueOnce({ state: "stopped" })
      .mockResolvedValueOnce({ state: "started" })
    mocks.createDaytonaClient.mockReturnValue({
      get: vi.fn().mockResolvedValue({ id: "sandbox-live", name: "fleet" }),
    })

    const { readHostedSandboxStatus } = await import("../durable-sandbox")
    await expect(readHostedSandboxStatus("user-1")).resolves.toMatchObject({
      keyPresent: true,
      sandboxReady: true,
      sandboxId: "sandbox-live",
    })
    expect(mocks.createDaytonaClient).toHaveBeenCalled()
  })

  it("keeps sandboxReady false when cache and lookup both fail", async () => {
    mocks.getCachedUserSandbox.mockReturnValue({
      sandboxId: "cached-id",
      sandbox: { id: "cached-id" },
    })
    mocks.getSandboxStatus.mockResolvedValue({ state: "stopped" })
    mocks.createDaytonaClient.mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error("missing")),
    })

    const { readHostedSandboxStatus } = await import("../durable-sandbox")
    await expect(readHostedSandboxStatus("user-1")).resolves.toMatchObject({
      keyPresent: true,
      sandboxReady: false,
    })
  })

  it("accepts a started cached sandbox without lookup", async () => {
    mocks.getCachedUserSandbox.mockReturnValue({
      sandboxId: "cached-id",
      sandbox: { id: "cached-id" },
    })
    mocks.getSandboxStatus.mockResolvedValue({ state: "started" })

    const { readHostedSandboxStatus } = await import("../durable-sandbox")
    await expect(readHostedSandboxStatus("user-1")).resolves.toMatchObject({
      sandboxReady: true,
      sandboxId: "cached-id",
    })
    expect(mocks.createDaytonaClient).not.toHaveBeenCalled()
  })
})
