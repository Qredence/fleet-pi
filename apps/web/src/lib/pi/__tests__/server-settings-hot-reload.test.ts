import { describe, expect, it, vi } from "vitest"
import { hotReloadActiveRuntimes, retainPiRuntime } from "../server-runtime"
import { applyModelSelection } from "../server-catalog"

vi.mock("../server-catalog", () => ({
  applyModelSelection: vi.fn(),
  resolveModelSelection: vi.fn(() => ({
    model: { provider: "google", id: "gemini-3.5-flash-new" },
    thinkingLevel: "high",
  })),
}))

describe("settings hot-reload runtime mechanism", () => {
  it("should reload active runtimes and apply the updated model selections in place", async () => {
    const mockLoad = vi.fn()
    const mockSettingsManager = {
      load: mockLoad,
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
      },
    } as any

    // Register active runtime
    const release = retainPiRuntime(mockRuntime)

    try {
      await hotReloadActiveRuntimes({
        defaultProvider: "google",
        defaultModel: "gemini-3.5-flash-new",
        defaultThinkingLevel: "high",
      })

      // Assert that settings manager load is invoked to fetch latest settings from disk
      expect(mockLoad).toHaveBeenCalled()

      // Assert that applyModelSelection was invoked with the loaded defaults
      expect(applyModelSelection).toHaveBeenCalledWith(mockRuntime, {
        provider: "google",
        id: "gemini-3.5-flash-new",
        thinkingLevel: "high",
      })
    } finally {
      release()
    }
  })
})
