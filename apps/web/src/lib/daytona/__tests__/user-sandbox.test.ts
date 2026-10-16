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
} from "../user-sandbox"
import {
  fingerprintDaytonaSecretsConfig,
  syncDaytonaSecrets,
} from "../sync-daytona-secrets"
import {
  buildPlaintextSandboxCredentials,
  loadConfiguredProviderSecrets,
} from "../sandbox-provider-secrets"
import {
  createDaytonaClient,
  createSandbox,
  deleteSandbox,
  getOrCreateVolume,
  getSandboxStatus,
  startSandbox,
  stopSandbox,
} from "../client"
import type { Daytona, Sandbox } from "@daytona/sdk"
import type * as DaytonaClientModule from "../client"
import type * as SandboxProviderSecretsModule from "../sandbox-provider-secrets"

vi.mock("../sync-daytona-secrets", () => ({
  syncDaytonaSecrets: vi.fn().mockResolvedValue({
    secrets: {},
    fingerprint: "",
    mode: "plaintext-fallback",
  }),
  fingerprintDaytonaSecretsConfig: vi.fn().mockReturnValue(""),
}))

vi.mock("../sandbox-provider-secrets", async (importOriginal) => {
  const actual = await importOriginal<typeof SandboxProviderSecretsModule>()
  return {
    ...actual,
    loadConfiguredProviderSecrets: vi
      .fn()
      .mockResolvedValue(new Map<string, string>()),
    loadSandboxProviderSecrets: vi.fn().mockResolvedValue({
      envVars: {},
      authJson: {},
      fingerprint: "empty",
    }),
    buildPlaintextSandboxCredentials: vi.fn().mockReturnValue({
      envVars: {},
      authJson: {},
      fingerprint: "empty",
    }),
  }
})

vi.mock("../client", async (importOriginal) => {
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
const mockedSyncDaytonaSecrets = vi.mocked(syncDaytonaSecrets)

function makeMockClient(): Daytona {
  return {
    get: vi.fn().mockRejectedValue(new Error("not found")),
    create: vi.fn(),
    list: vi.fn(),
    volume: { get: vi.fn(), list: vi.fn(), delete: vi.fn() },
    snapshot: { get: vi.fn(), create: vi.fn(), delete: vi.fn() },
    secret: {
      list: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, nextCursor: null }),
      create: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as Daytona
}

function makeMockSandbox(overrides?: Partial<Sandbox>): Sandbox {
  return {
    id: "sandbox-abc",
    name: "fleet-pi-user-user123",
    state: "started",
    labels: { managedBy: "fleet-pi", userId: "user123" },
    volumes: [
      {
        volumeId: "vol-1",
        mountPath: "/home/daytona/agent-workspace",
      },
    ],
    process: {
      executeCommand: vi.fn().mockResolvedValue({ result: "", exitCode: 0 }),
      codeRun: vi.fn(),
    },
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
  delete process.env.ORG_DAYTONA_API_KEY
  delete process.env.FLEET_PI_DEPLOYMENT
  delete process.env.FLEET_PI_DEPLOYMENT
  vi.mocked(fingerprintDaytonaSecretsConfig).mockReturnValue("")
})

describe("isDaytonaEnabled", () => {
  it("returns false when userId is undefined", () => {
    process.env.DAYTONA_API_KEY = "test-key"
    expect(isDaytonaEnabled(undefined)).toBe(false)
  })

  it("returns true when DAYTONA_API_KEY is not set but client key is provided", () => {
    expect(isDaytonaEnabled("user123", "client-key")).toBe(true)
  })

  it("returns false when DAYTONA_API_KEY is not set", () => {
    expect(isDaytonaEnabled("user123")).toBe(false)
  })

  it("returns true when both userId and API key are present", () => {
    process.env.DAYTONA_API_KEY = "test-key"
    expect(isDaytonaEnabled("user123")).toBe(true)
  })

  it("ignores env DAYTONA_API_KEY on Cloudflare without a resolved client key", () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    process.env.DAYTONA_API_KEY = "org-key"
    expect(isDaytonaEnabled("user123")).toBe(false)
    expect(isDaytonaEnabled("user123", "byok-key")).toBe(true)
    delete process.env.FLEET_PI_DEPLOYMENT
  })

  it("does not treat ORG_DAYTONA_API_KEY as an enablement signal", () => {
    process.env.ORG_DAYTONA_API_KEY = "org-key"
    expect(isDaytonaEnabled("user123")).toBe(false)
    delete process.env.ORG_DAYTONA_API_KEY
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
    const executeCommandMock = vi
      .fn()
      .mockResolvedValue({ result: "", exitCode: 0 })
    const sandbox = makeMockSandbox({
      process: {
        executeCommand: executeCommandMock,
        codeRun: vi.fn(),
      },
    } as unknown as Partial<Sandbox>)

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
            mountPath: "/home/daytona/agent-workspace",
          }),
        ],
        autoStopInterval: 30,
      })
    )

    expect(handle.userId).toBe("user123")
    expect(handle.volumeId).toBe("vol-1")
    expect(handle.sandboxId).toBe("sandbox-abc")
    expect(executeCommandMock).toHaveBeenCalled()
    const prepCommand = executeCommandMock.mock.calls[0]?.[0] as
      string | undefined
    expect(prepCommand).toContain("git clone")
    expect(prepCommand).toContain("--sparse")
    expect(prepCommand).toContain("agent-workspace")
    expect(prepCommand).toContain("rm -rf")
    expect(prepCommand).toContain("/home/daytona/fleet-pi")
    expect(prepCommand).toContain("mountpoint -q")
    expect(prepCommand).not.toContain("npm install")
    expect(prepCommand).not.toContain("npx")
    // Sparse seed clones to a tempdir only — never into the legacy path.
    expect(prepCommand).not.toMatch(/git clone[^\n]*\/home\/daytona\/fleet-pi/)
  })

  it("recreates sandboxes that still mount the legacy fleet-pi path", async () => {
    const client = makeMockClient()
    const executeCommandMock = vi
      .fn()
      .mockResolvedValue({ result: "", exitCode: 0 })
    const legacySandbox = makeMockSandbox({
      id: "sandbox-legacy",
      volumes: [
        {
          volumeId: "vol-1",
          mountPath: "/home/daytona/fleet-pi/agent-workspace",
        },
      ],
      refreshData: vi.fn().mockResolvedValue(undefined),
    })
    const freshSandbox = makeMockSandbox({
      id: "sandbox-fresh",
      process: {
        executeCommand: executeCommandMock,
        codeRun: vi.fn(),
      },
      volumes: [
        {
          volumeId: "vol-1",
          mountPath: "/home/daytona/agent-workspace",
        },
      ],
    } as unknown as Partial<Sandbox>)

    mockedCreateClient.mockReturnValue(client)
    client.get = vi.fn().mockResolvedValue(legacySandbox)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedCreateSandbox.mockResolvedValue(freshSandbox)

    const handle = await getUserSandbox({ userId: "user123" })

    expect(mockedDeleteSandbox).toHaveBeenCalledWith(legacySandbox)
    expect(mockedCreateSandbox).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        volumes: [
          expect.objectContaining({
            mountPath: "/home/daytona/agent-workspace",
          }),
        ],
      })
    )
    expect(handle.sandboxId).toBe("sandbox-fresh")
  })

  it("recreates sandboxes stuck in error state while keeping the volume", async () => {
    const client = makeMockClient()
    const executeCommandMock = vi
      .fn()
      .mockResolvedValue({ result: "", exitCode: 0 })
    const erroredSandbox = makeMockSandbox({
      id: "sandbox-error",
      state: "error",
      volumes: [
        {
          volumeId: "vol-1",
          mountPath: "/home/daytona/agent-workspace",
        },
      ],
      refreshData: vi.fn().mockResolvedValue(undefined),
    })
    const freshSandbox = makeMockSandbox({
      id: "sandbox-fresh",
      process: {
        executeCommand: executeCommandMock,
        codeRun: vi.fn(),
      },
      volumes: [
        {
          volumeId: "vol-1",
          mountPath: "/home/daytona/agent-workspace",
        },
      ],
    } as unknown as Partial<Sandbox>)

    mockedCreateClient.mockReturnValue(client)
    client.get = vi.fn().mockResolvedValue(erroredSandbox)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedCreateSandbox.mockResolvedValue(freshSandbox)

    const handle = await getUserSandbox({ userId: "user123" })

    expect(mockedDeleteSandbox).toHaveBeenCalledWith(erroredSandbox)
    expect(mockedCreateSandbox).toHaveBeenCalled()
    expect(handle.sandboxId).toBe("sandbox-fresh")
  })

  it("recreates sandboxes that were Secrets-mounted when sync falls back to plaintext", async () => {
    const fingerprint = "f".repeat(64)
    mockedSyncDaytonaSecrets.mockResolvedValueOnce({
      secrets: {},
      fingerprint,
      mode: "plaintext-fallback",
    })

    const client = makeMockClient()
    const executeCommandMock = vi
      .fn()
      .mockResolvedValue({ result: "", exitCode: 0 })
    const secretsMountedSandbox = makeMockSandbox({
      id: "sandbox-secrets",
      labels: {
        managedBy: "fleet-pi",
        userId: "user123",
        daytonaSecretsFp: fingerprint.slice(0, 16),
      },
    })
    const freshSandbox = makeMockSandbox({
      id: "sandbox-plain",
      process: {
        executeCommand: executeCommandMock,
        codeRun: vi.fn(),
      },
    } as unknown as Partial<Sandbox>)

    mockedCreateClient.mockReturnValue(client)
    client.get = vi.fn().mockResolvedValue(secretsMountedSandbox)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedCreateSandbox.mockResolvedValue(freshSandbox)

    const handle = await getUserSandbox({ userId: "user123" })

    expect(mockedDeleteSandbox).toHaveBeenCalledWith(secretsMountedSandbox)
    const createParams = mockedCreateSandbox.mock.calls[0][1] as {
      secrets?: Record<string, string>
    }
    expect(createParams.secrets ?? {}).toEqual({})
    expect(handle.sandboxId).toBe("sandbox-plain")
  })

  it("recreates when Secrets sync returns a new map but labels are stale", async () => {
    const fingerprint = "a".repeat(64)
    mockedSyncDaytonaSecrets.mockResolvedValueOnce({
      secrets: { GEMINI_API_KEY: "fleet_pi_google" },
      fingerprint,
      mode: "mounted",
    })

    const client = makeMockClient()
    const executeCommandMock = vi
      .fn()
      .mockResolvedValue({ result: "", exitCode: 0 })
    const staleSandbox = makeMockSandbox({
      id: "sandbox-stale",
      labels: {
        managedBy: "fleet-pi",
        userId: "user123",
        daytonaSecretsFp: "bbbbbbbbbbbbbbbb",
      },
    })
    const freshSandbox = makeMockSandbox({
      id: "sandbox-fresh-secrets",
      process: {
        executeCommand: executeCommandMock,
        codeRun: vi.fn(),
      },
    } as unknown as Partial<Sandbox>)

    mockedCreateClient.mockReturnValue(client)
    client.get = vi.fn().mockResolvedValue(staleSandbox)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedCreateSandbox.mockResolvedValue(freshSandbox)

    await getUserSandbox({ userId: "user123" })

    expect(mockedDeleteSandbox).toHaveBeenCalledWith(staleSandbox)
    expect(mockedCreateSandbox).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        secrets: { GEMINI_API_KEY: "fleet_pi_google" },
      })
    )
  })

  it("throws when repository preparation fails", async () => {
    const client = makeMockClient()
    const executeCommandMock = vi
      .fn()
      .mockResolvedValue({ result: "clone failed", exitCode: 1 })
    const sandbox = makeMockSandbox({
      process: {
        executeCommand: executeCommandMock,
        codeRun: vi.fn(),
      },
    } as unknown as Partial<Sandbox>)

    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedCreateSandbox.mockResolvedValue(sandbox)

    await expect(getUserSandbox({ userId: "user123" })).rejects.toThrow(
      "Failed to prepare Daytona sandbox layout: clone failed"
    )
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

  it("rejects an existing sandbox with unexpected ownership labels", async () => {
    const client = makeMockClient()
    const unmanagedSandbox = makeMockSandbox({
      labels: { managedBy: "someone-else", userId: "user123" },
    })

    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    ;(client.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      unmanagedSandbox
    )

    await expect(getUserSandbox({ userId: "user123" })).rejects.toThrow(
      "Refusing to use unmanaged Daytona sandbox"
    )
  })

  it("coalesces concurrent provisioning for the same user", async () => {
    const client = makeMockClient()
    const sandbox = makeMockSandbox()
    let resolveCreate: (sandbox: Sandbox) => void = () => {}

    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedCreateSandbox.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve
      })
    )

    const first = getUserSandbox({ userId: "user123" })
    const second = getUserSandbox({ userId: "user123" })
    resolveCreate(sandbox)

    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    expect(mockedCreateSandbox).toHaveBeenCalledTimes(1)
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

describe("sandbox creation race recovery", () => {
  it.each(["started", "stopped", "archived"])(
    "validates and resumes a %s sandbox found after creation fails",
    async (state) => {
      const client = makeMockClient()
      const raced = makeMockSandbox({ state } as Partial<Sandbox>)
      mockedCreateClient.mockReturnValue(client)
      mockedGetOrCreateVolume.mockResolvedValue({
        id: "vol-1",
        name: "fleet-pi-ws-user123",
      })
      vi.mocked(client.get)
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce(raced)
      mockedCreateSandbox.mockRejectedValueOnce(new Error("name conflict"))

      const handle = await getUserSandbox({ userId: "user123" })

      expect(handle.sandbox).toBe(raced)
      expect(mockedDeleteSandbox).not.toHaveBeenCalled()
      if (state !== "started") {
        expect(mockedStartSandbox).toHaveBeenCalledWith(raced)
        expect(mockedStartSandbox.mock.invocationCallOrder[0]).toBeLessThan(
          vi.mocked(raced.process.executeCommand).mock.invocationCallOrder[0]
        )
      }
    }
  )

  it.each([
    {
      reason: "legacy mount",
      overrides: {
        volumes: [
          {
            volumeId: "vol-1",
            mountPath: "/home/daytona/fleet-pi/agent-workspace",
          },
        ],
      },
    },
    {
      reason: "wrong volume",
      overrides: {
        volumes: [
          {
            volumeId: "other-volume",
            mountPath: "/home/daytona/agent-workspace",
          },
        ],
      },
    },
    { reason: "error state", overrides: { state: "error" } },
    {
      reason: "stale Secrets",
      overrides: {
        labels: {
          managedBy: "fleet-pi",
          userId: "user123",
          daytonaSecretsFp: "old",
        },
      },
    },
  ])("recovers a raced sandbox with $reason", async ({ overrides }) => {
    const client = makeMockClient()
    const raced = makeMockSandbox(overrides as Partial<Sandbox>)
    const fresh = makeMockSandbox({ id: "sandbox-fresh" })
    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })
    mockedSyncDaytonaSecrets.mockResolvedValueOnce({
      secrets: { OPENAI_API_KEY: "fleet_pi_openai" },
      fingerprint: "new-fingerprint",
      mode: "mounted",
    })
    // Isolate the mount/state cases from Secrets validation.
    if (!("labels" in overrides)) {
      raced.labels = { ...raced.labels, daytonaSecretsFp: "new-fingerprint" }
    }
    vi.mocked(client.get)
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce(raced)
    mockedCreateSandbox
      .mockRejectedValueOnce(new Error("name conflict"))
      .mockResolvedValueOnce(fresh)

    const handle = await getUserSandbox({ userId: "user123" })

    expect(mockedDeleteSandbox).toHaveBeenCalledWith(raced)
    expect(mockedCreateSandbox).toHaveBeenLastCalledWith(
      client,
      expect.objectContaining({
        volumes: [expect.objectContaining({ volumeId: "vol-1" })],
        secrets: { OPENAI_API_KEY: "fleet_pi_openai" },
      })
    )
    expect(handle.sandbox).toBe(fresh)
    expect(raced.process.executeCommand).not.toHaveBeenCalled()
  })

  it.each(["ownership", "restart", "recreation"])(
    "preserves the creation error when raced sandbox %s recovery fails",
    async (failure) => {
      const client = makeMockClient()
      const originalError = new Error("original creation failure")
      const raced = makeMockSandbox(
        failure === "ownership"
          ? { labels: { managedBy: "other", userId: "user123" } }
          : { state: failure === "restart" ? "stopped" : "error" }
      )
      mockedCreateClient.mockReturnValue(client)
      mockedGetOrCreateVolume.mockResolvedValue({
        id: "vol-1",
        name: "fleet-pi-ws-user123",
      })
      vi.mocked(client.get)
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce(raced)
      mockedCreateSandbox.mockRejectedValueOnce(originalError)
      if (failure === "recreation") {
        mockedCreateSandbox.mockRejectedValueOnce(
          new Error("recreation failed")
        )
      }
      if (failure === "restart") {
        mockedStartSandbox.mockRejectedValueOnce(new Error("restart failed"))
      }

      await expect(getUserSandbox({ userId: "user123" })).rejects.toBe(
        originalError
      )
      expect(raced.process.executeCommand).not.toHaveBeenCalled()
      expect(getCachedUserSandbox("user123")).toBeUndefined()
    }
  )
})

describe("sandbox lookup and secrets mount", () => {
  it("attaches to an existing remote sandbox when the local map is empty", async () => {
    const client = makeMockClient()
    const existing = makeMockSandbox({ id: "sandbox-remote" })
    mockedCreateClient.mockReturnValue(client)
    client.get = vi.fn().mockResolvedValue(existing)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })

    clearSandboxCache()
    const first = await getUserSandbox({ userId: "user123", apiKey: "byok" })
    clearSandboxCache()
    const second = await getUserSandbox({ userId: "user123", apiKey: "byok" })

    expect(first.sandboxId).toBe("sandbox-remote")
    expect(second.sandboxId).toBe("sandbox-remote")
    expect(mockedCreateSandbox).not.toHaveBeenCalled()
    const commands = (
      existing.process.executeCommand as ReturnType<typeof vi.fn>
    ).mock.calls.map((call) => String(call[0]))
    expect(
      commands.some(
        (command) =>
          command.includes("git clone") && command.includes("manifest.json")
      )
    ).toBe(true)
  })

  it("refuses plaintext provider keys on Cloudflare when Secrets are unavailable", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    vi.mocked(fingerprintDaytonaSecretsConfig).mockImplementation(
      (configured) => (configured.size > 0 ? "eligible" : "empty")
    )
    vi.mocked(loadConfiguredProviderSecrets).mockResolvedValueOnce(
      new Map([["openai", "sk-live-secret"]])
    )
    mockedSyncDaytonaSecrets.mockResolvedValueOnce({
      secrets: {},
      fingerprint: "eligible",
      mode: "plaintext-fallback",
    })
    const client = makeMockClient()
    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-1",
      name: "fleet-pi-ws-user123",
    })

    await expect(
      getUserSandbox({ userId: "user123", apiKey: "byok" })
    ).rejects.toThrow(/Refusing to write plaintext credentials/)
    expect(mockedCreateSandbox).not.toHaveBeenCalled()
    expect(buildPlaintextSandboxCredentials).not.toHaveBeenCalled()
    delete process.env.FLEET_PI_DEPLOYMENT
  })
  it.each(["mounted", "plaintext-fallback"] as const)(
    "rejects partial provider mounts on Cloudflare in %s mode",
    async (mode) => {
      process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
      vi.mocked(loadConfiguredProviderSecrets).mockResolvedValueOnce(
        new Map([
          ["openai", "test-openai-key"],
          ["google", "test-google-key"],
        ])
      )
      mockedSyncDaytonaSecrets.mockResolvedValueOnce({
        secrets: { OPENAI_API_KEY: "fleet_pi_openai" },
        fingerprint: "partial",
        mode,
      })
      mockedCreateClient.mockReturnValue(makeMockClient())
      mockedGetOrCreateVolume.mockResolvedValue({
        id: "vol-1",
        name: "fleet-pi-ws-user123",
      })

      await expect(
        getUserSandbox({ userId: "user123", apiKey: "byok" })
      ).rejects.toThrow(/Refusing to write plaintext credentials/)
      expect(mockedCreateSandbox).not.toHaveBeenCalled()
      expect(buildPlaintextSandboxCredentials).not.toHaveBeenCalled()
    }
  )

  it.each(["mounted", "plaintext-fallback"] as const)(
    "accepts complete eligible provider mounts on Cloudflare in %s mode",
    async (mode) => {
      process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
      vi.mocked(loadConfiguredProviderSecrets).mockResolvedValueOnce(
        new Map([
          ["openai", "test-openai-key"],
          ["google", "test-google-key"],
          ["daytona", "test-daytona-key"],
        ])
      )
      mockedSyncDaytonaSecrets.mockResolvedValueOnce({
        secrets: {
          OPENAI_API_KEY: "fleet_pi_openai",
          GEMINI_API_KEY: "fleet_pi_google",
        },
        fingerprint: "complete",
        mode,
      })
      const sandbox = makeMockSandbox()
      mockedCreateClient.mockReturnValue(makeMockClient())
      mockedGetOrCreateVolume.mockResolvedValue({
        id: "vol-1",
        name: "fleet-pi-ws-user123",
      })
      mockedCreateSandbox.mockResolvedValueOnce(sandbox)

      const handle = await getUserSandbox({ userId: "user123", apiKey: "byok" })

      expect(handle.sandbox).toBe(sandbox)
      expect(buildPlaintextSandboxCredentials).toHaveBeenCalledWith(
        expect.any(Map),
        new Set(["OPENAI_API_KEY", "GEMINI_API_KEY"])
      )
    }
  )
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

describe("HYG-009: bounded in-process sandbox map", () => {
  const MAX_LOCAL_SANDBOXES = 32

  function setupPerUserSandboxes() {
    const client = makeMockClient()
    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockImplementation(async (_client, name) => ({
      id: `vol-${name}`,
      name,
    }))
    mockedCreateSandbox.mockImplementation(async (_client, input) =>
      makeMockSandbox({
        id: `sandbox-${input?.name}`,
        name: input?.name,
        labels: input?.labels,
      })
    )
    return client
  }

  it("evicts the oldest entry once the cap is exceeded", async () => {
    setupPerUserSandboxes()
    let now = 1_000_000
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now)
    try {
      const total = MAX_LOCAL_SANDBOXES + 1
      for (let index = 0; index < total; index += 1) {
        now += 1
        await getUserSandbox({ userId: `cap-user-${index}` })
      }

      const cached = Array.from({ length: total }, (_, index) =>
        getCachedUserSandbox(`cap-user-${index}`)
      ).filter(Boolean)
      expect(cached).toHaveLength(MAX_LOCAL_SANDBOXES)
      expect(getCachedUserSandbox("cap-user-0")).toBeUndefined()
      expect(getCachedUserSandbox("cap-user-1")).toBeDefined()
      expect(getCachedUserSandbox(`cap-user-${total - 1}`)).toBeDefined()
    } finally {
      nowSpy.mockRestore()
    }
  })

  it("drops idle entries when a new sandbox is remembered", async () => {
    setupPerUserSandboxes()
    let now = 1_000_000
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now)
    try {
      await getUserSandbox({ userId: "idle-user" })
      expect(getCachedUserSandbox("idle-user")).toBeDefined()

      now += 15 * 60 * 1000 + 1
      await getUserSandbox({ userId: "fresh-user" })

      expect(getCachedUserSandbox("idle-user")).toBeUndefined()
      expect(getCachedUserSandbox("fresh-user")).toBeDefined()
    } finally {
      nowSpy.mockRestore()
    }
  })

  it("hosted path reattaches an existing sandbox by name/volume label when the map is empty", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    const client = makeMockClient()
    const existing = makeMockSandbox({
      id: "sandbox-hosted",
      name: "fleet-pi-user-hosted-user",
      state: "started",
      labels: {
        managedBy: "fleet-pi",
        userId: "hosted-user",
        volumeName: "fleet-pi-ws-hosted-user",
      },
      volumes: [
        { volumeId: "vol-hosted", mountPath: "/home/daytona/agent-workspace" },
      ],
    } as unknown as Partial<Sandbox>)
    vi.mocked(client.get).mockResolvedValue(existing)
    mockedCreateClient.mockReturnValue(client)
    mockedGetOrCreateVolume.mockResolvedValue({
      id: "vol-hosted",
      name: "fleet-pi-ws-hosted-user",
    })

    clearSandboxCache()
    expect(getCachedUserSandbox("hosted-user")).toBeUndefined()

    const handle = await getUserSandbox({
      userId: "hosted-user",
      apiKey: "byok-test",
    })

    expect(client.get).toHaveBeenCalledWith("fleet-pi-user-hosted-user")
    expect(mockedGetOrCreateVolume).toHaveBeenCalledWith(
      client,
      "fleet-pi-ws-hosted-user"
    )
    expect(mockedCreateSandbox).not.toHaveBeenCalled()
    expect(mockedDeleteSandbox).not.toHaveBeenCalled()
    expect(handle.sandboxId).toBe("sandbox-hosted")
    expect(handle.volumeId).toBe("vol-hosted")
    expect(handle.volumeName).toBe("fleet-pi-ws-hosted-user")
    expect(getCachedUserSandbox("hosted-user")).toBe(handle)
  })
})
