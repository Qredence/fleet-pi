import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clearSandboxCache,
  destroyUserSandbox,
  getCachedUserSandbox,
  getSandboxName,
  getUserSandbox,
  getVolumeName,
  isDaytonaEnabled,
  releaseUserSandbox,
} from "./user-sandbox"
import {
  createDaytonaClient,
  createSandbox,
  deleteSandbox,
  getOrCreateVolume,
  getSandboxStatus,
  startSandbox,
  stopSandbox,
} from "./client"
import type { Daytona, Sandbox } from "@daytonaio/sdk"
import type * as DaytonaClientModule from "./client"

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof DaytonaClientModule>()
  return {
    ...actual,
    createDaytonaClient: vi.fn(),
    getOrCreateVolume: vi.fn(),
    createSandbox: vi.fn(),
    getSandboxStatus: vi.fn(),
    startSandbox: vi.fn(),
    stopSandbox: vi.fn(),
    deleteSandbox: vi.fn(),
  }
})

const mockedCreateClient = vi.mocked(createDaytonaClient)
const mockedGetOrCreateVolume = vi.mocked(getOrCreateVolume)
const mockedCreateSandbox = vi.mocked(createSandbox)
const mockedGetSandboxStatus = vi.mocked(getSandboxStatus)
const mockedStartSandbox = vi.mocked(startSandbox)
const mockedStopSandbox = vi.mocked(stopSandbox)
const mockedDeleteSandbox = vi.mocked(deleteSandbox)

function makeMockClient(): Daytona {
  return {
    get: vi.fn().mockRejectedValue(new Error("not found")),
    create: vi.fn(),
    list: vi.fn(),
    volume: { get: vi.fn(), list: vi.fn(), delete: vi.fn() },
    snapshot: { get: vi.fn(), create: vi.fn(), delete: vi.fn() },
  } as unknown as Daytona
}

function makeMockSandbox(overrides?: Partial<Sandbox>): Sandbox {
  return {
    id: "sandbox-abc",
    name: "fleet-pi-user-user123",
    state: "started",
    labels: {},
    process: { executeCommand: vi.fn(), codeRun: vi.fn() },
    fs: {
      uploadFile: vi.fn(),
      downloadFile: vi.fn(),
      listFiles: vi.fn(),
    },
    start: vi.fn(),
    stop: vi.fn(),
    delete: vi.fn(),
    refreshData: vi.fn(),
    ...overrides,
  } as unknown as Sandbox
}

afterEach(() => {
  clearSandboxCache()
  vi.clearAllMocks()
  delete process.env.DAYTONA_API_KEY
})

describe("isDaytonaEnabled", () => {
  it("returns false when userId is undefined", () => {
    process.env.DAYTONA_API_KEY = "test-key"
    expect(isDaytonaEnabled(undefined)).toBe(false)
  })

  it("returns false when DAYTONA_API_KEY is not set", () => {
    expect(isDaytonaEnabled("user123")).toBe(false)
  })

  it("returns true when both userId and API key are present", () => {
    process.env.DAYTONA_API_KEY = "test-key"
    expect(isDaytonaEnabled("user123")).toBe(true)
  })
})

describe("naming conventions", () => {
  it("generates deterministic sandbox names from userId", () => {
    expect(getSandboxName("abc123")).toBe("fleet-pi-user-abc123")
  })

  it("generates deterministic volume names from userId", () => {
    expect(getVolumeName("abc123")).toBe("fleet-pi-ws-abc123")
  })
})

describe("getUserSandbox", () => {
  it("creates volume and sandbox with correct labels on first call", async () => {
    const client = makeMockClient()
    const sandbox = makeMockSandbox()

    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedCreateSandbox.mockResolvedValue(sandbox)

    const handle = await getUserSandbox({
      userId: "user123",
      userEmail: "test@example.com",
    })

    expect(mockedGetOrCreateVolume).toHaveBeenCalledWith(
      client,
      "fleet-pi-ws-user123"
    )
    expect(mockedCreateSandbox).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        name: "fleet-pi-user-user123",
        labels: expect.objectContaining({
          managedBy: "fleet-pi",
          userId: "user123",
          email: "test@example.com",
        }),
        volumes: [
          expect.objectContaining({
            volumeId: "vol-1",
            mountPath: "/home/daytona/fleet-pi/agent-workspace",
          }),
        ],
        autoStopInterval: 30,
      })
    )

    expect(handle.userId).toBe("user123")
    expect(handle.volumeId).toBe("vol-1")
    expect(handle.sandboxId).toBe("sandbox-abc")
  })

  it("returns cached handle on second call when sandbox is healthy", async () => {
    const client = makeMockClient()
    const sandbox = makeMockSandbox()

    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedCreateSandbox.mockResolvedValue(sandbox)
    mockedGetSandboxStatus.mockResolvedValue({
      id: "sandbox-abc",
      name: "fleet-pi-user-user123",
      state: "started",
    })

    await getUserSandbox({ userId: "user123" })
    const handle2 = await getUserSandbox({ userId: "user123" })

    expect(mockedCreateSandbox).toHaveBeenCalledTimes(1)
    expect(handle2.sandboxId).toBe("sandbox-abc")
  })

  it("re-provisions when cached sandbox is unhealthy", async () => {
    const client = makeMockClient()
    const sandbox1 = makeMockSandbox({ id: "sandbox-old" })
    const sandbox2 = makeMockSandbox({ id: "sandbox-new" })

    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedCreateSandbox
      .mockResolvedValueOnce(sandbox1)
      .mockResolvedValueOnce(sandbox2)
    mockedGetSandboxStatus.mockRejectedValueOnce(new Error("gone"))

    await getUserSandbox({ userId: "user123" })
    const handle2 = await getUserSandbox({ userId: "user123" })

    expect(mockedCreateSandbox).toHaveBeenCalledTimes(2)
    expect(handle2.sandboxId).toBe("sandbox-new")
  })

  it("starts a stopped existing sandbox instead of creating new", async () => {
    const client = makeMockClient()
    const stoppedSandbox = makeMockSandbox({ state: "stopped" })

    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    ;(client.get as ReturnType<typeof vi.fn>).mockResolvedValue(stoppedSandbox)

    const handle = await getUserSandbox({ userId: "user123" })

    expect(mockedCreateSandbox).not.toHaveBeenCalled()
    expect(mockedStartSandbox).toHaveBeenCalledWith(stoppedSandbox)
    expect(handle.sandboxId).toBe("sandbox-abc")
  })

  it("isolates sandboxes between different users", async () => {
    const client = makeMockClient()
    const sandboxA = makeMockSandbox({
      id: "sandbox-a",
      name: "fleet-pi-user-userA",
    })
    const sandboxB = makeMockSandbox({
      id: "sandbox-b",
      name: "fleet-pi-user-userB",
    })

    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume
      .mockResolvedValueOnce({ id: "vol-a", name: "fleet-pi-ws-userA" })
      .mockResolvedValueOnce({ id: "vol-b", name: "fleet-pi-ws-userB" })
    mockedCreateSandbox
      .mockResolvedValueOnce(sandboxA)
      .mockResolvedValueOnce(sandboxB)

    const handleA = await getUserSandbox({ userId: "userA" })
    const handleB = await getUserSandbox({ userId: "userB" })

    expect(handleA.volumeId).toBe("vol-a")
    expect(handleB.volumeId).toBe("vol-b")
    expect(handleA.sandboxId).toBe("sandbox-a")
    expect(handleB.sandboxId).toBe("sandbox-b")
  })
})

describe("releaseUserSandbox", () => {
  it("stops sandbox and clears cache", async () => {
    const client = makeMockClient()
    const sandbox = makeMockSandbox()

    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedCreateSandbox.mockResolvedValue(sandbox)

    await getUserSandbox({ userId: "user123" })
    expect(getCachedUserSandbox("user123")).toBeDefined()

    await releaseUserSandbox("user123")

    expect(mockedStopSandbox).toHaveBeenCalledWith(sandbox)
    expect(getCachedUserSandbox("user123")).toBeUndefined()
  })

  it("is a no-op when no sandbox exists for userId", async () => {
    await releaseUserSandbox("nonexistent")
    expect(mockedStopSandbox).not.toHaveBeenCalled()
  })
})

describe("destroyUserSandbox", () => {
  it("deletes sandbox and clears cache", async () => {
    const client = makeMockClient()
    const sandbox = makeMockSandbox()

    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedCreateSandbox.mockResolvedValue(sandbox)

    await getUserSandbox({ userId: "user123" })
    await destroyUserSandbox("user123")

    expect(mockedDeleteSandbox).toHaveBeenCalledWith(sandbox)
    expect(getCachedUserSandbox("user123")).toBeUndefined()
  })
})
