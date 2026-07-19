import { beforeEach, describe, expect, it, vi } from "vitest"
import { hotReloadActiveRuntimes, retainPiRuntime } from "../server"
import { createMockSettingsManager } from "../runtime/__tests__/mock-settings-manager"

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
    const mockSettingsManager = createMockSettingsManager()
    mockSettingsManager.reload = mockReload
    mockSettingsManager.getDefaultProvider = vi.fn(() => "google")
    mockSettingsManager.getDefaultModel = vi.fn(() => "gemini-3.5-flash-new")
    mockSettingsManager.getDefaultThinkingLevel = vi.fn(() => "high")
    const mockRuntime = {
      session: {
        sessionId: "test-session-id",
        sessionFile: "/tmp/session-file-hot-reload.jsonl",
      },
      services: {
        settingsManager: mockSettingsManager,
        resourceLoader: { reload: mockResourceReload },
      },
    } as never

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
        (mockRuntime as { services: unknown }).services,
        {
          userId: "user-1",
        }
      )
    } finally {
      release()
    }
  })
})
