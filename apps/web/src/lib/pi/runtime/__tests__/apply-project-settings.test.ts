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

  it("applies enabledModels via project settings so Neon overrides win over disk", () => {
    const updateProjectSettings = vi.fn(
      (_field: string, update: (settings: Record<string, unknown>) => void) => {
        const project: Record<string, unknown> = {
          enabledModels: ["openai-chat-completions/stale"],
        }
        update(project)
        expect(project.enabledModels).toEqual(["google/gemini-3.5-flash"])
      }
    )
    const setEnabledModels = vi.fn()

    applyProjectSettingsToServices(
      {
        settingsManager: {
          applyOverrides: vi.fn(),
          setProjectPackages: vi.fn(),
          setEnableSkillCommands: vi.fn(),
          setSteeringMode: vi.fn(),
          setFollowUpMode: vi.fn(),
          updateProjectSettings,
          setEnabledModels,
        },
      } as never,
      { enabledModels: ["google/gemini-3.5-flash"] }
    )

    expect(updateProjectSettings).toHaveBeenCalledWith(
      "enabledModels",
      expect.any(Function)
    )
    expect(setEnabledModels).not.toHaveBeenCalled()
  })

  it("clears project enabledModels when override is null (allow-all)", () => {
    const updateProjectSettings = vi.fn(
      (_field: string, update: (settings: Record<string, unknown>) => void) => {
        const project: Record<string, unknown> = {
          enabledModels: ["openai-chat-completions/stale"],
        }
        update(project)
        expect(project.enabledModels).toBeUndefined()
      }
    )

    applyProjectSettingsToServices(
      {
        settingsManager: {
          applyOverrides: vi.fn(),
          setProjectPackages: vi.fn(),
          setEnableSkillCommands: vi.fn(),
          setSteeringMode: vi.fn(),
          setFollowUpMode: vi.fn(),
          updateProjectSettings,
          setEnabledModels: vi.fn(),
        },
      } as never,
      { enabledModels: null }
    )

    expect(updateProjectSettings).toHaveBeenCalled()
  })
})
