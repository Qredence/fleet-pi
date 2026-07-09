import { beforeEach, describe, expect, it, vi } from "vitest"
import { hotReloadActiveRuntimes, retainPiRuntime } from "../server"

const mocks = vi.hoisted(() => ({
  applyRuntimeAuth: vi.fn(),
  applyModelSelection: vi.fn(),
}))

vi.mock("../runtime/session-factory", () => ({
  applyRuntimeAuth: mocks.applyRuntimeAuth,
  createSessionServices: vi.fn(),
}))

vi.mock("../runtime/model-catalog", () => ({
  applyModelSelection: mocks.applyModelSelection,
  resolveModelSelection: vi.fn(() => ({
    model: { provider: "google", id: "gemini-3.5-flash-new" },
    thinkingLevel: "high",
  })),
}))

describe("settings hot-reload runtime mechanism", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("reloads settings, resources, model defaults, and BYOK for active runtimes", async () => {
    const mockReload = vi.fn(async () => undefined)
    const mockResourceReload = vi.fn(async () => undefined)
    const mockSettingsManager = {
      reload: mockReload,
      getDefaultProvider: () => "google",
      getDefaultModel: () => "gemini-3.5-flash-new",
      getDefaultThinkingLevel: () => "high",
    }
    const mockRuntime = {
      session: {
        sessionId: "test-session-id",
        sessionFile: "/tmp/session-file-hot-reload.jsonl",
      },
      services: {
        settingsManager: mockSettingsManager,
        resourceLoader: { reload: mockResourceReload },
      },
    } as any

    const release = retainPiRuntime(mockRuntime, "user-1")

    try {
      await hotReloadActiveRuntimes({
        packages: ["npm:pi-web-access"],
        defaultProvider: "google",
        defaultModel: "gemini-3.5-flash-new",
        defaultThinkingLevel: "high",
      })

      expect(mockResourceReload).toHaveBeenCalled()
      expect(mockReload).toHaveBeenCalled()
      expect(mockReload.mock.invocationCallOrder[0]).toBeLessThan(
        mockResourceReload.mock.invocationCallOrder[0]
      )
      expect(mocks.applyModelSelection).toHaveBeenCalledWith(mockRuntime, {
        provider: "google",
        id: "gemini-3.5-flash-new",
        thinkingLevel: "high",
      })
      expect(mocks.applyRuntimeAuth).toHaveBeenCalledWith(
        mockRuntime.services,
        {
          userId: "user-1",
        }
      )
    } finally {
      release()
    }
  })
})
