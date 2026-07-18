import { describe, expect, it, vi } from "vitest"
import { applyProjectSettingsToServices } from "../apply-project-settings"

describe("applyProjectSettingsToServices", () => {
  it("applies compaction, retry, and transport via applyOverrides", () => {
    const applyOverrides = vi.fn()
    const services = {
      settingsManager: {
        applyOverrides,
        setProjectPackages: vi.fn(),
        setEnableSkillCommands: vi.fn(),
        setSteeringMode: vi.fn(),
        setFollowUpMode: vi.fn(),
      },
    }

    applyProjectSettingsToServices(services as never, {
      compaction: {
        enabled: false,
        reserveTokens: 4096,
        keepRecentTokens: 8192,
      },
      retry: {
        enabled: false,
        maxRetries: 5,
        baseDelayMs: 1500,
      },
      transport: "sse",
    })

    expect(applyOverrides).toHaveBeenCalledWith({
      compaction: {
        enabled: false,
        reserveTokens: 4096,
        keepRecentTokens: 8192,
      },
      retry: {
        enabled: false,
        maxRetries: 5,
        baseDelayMs: 1500,
      },
      transport: "sse",
    })
  })
})
