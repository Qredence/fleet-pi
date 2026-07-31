import { afterEach, describe, expect, it, vi } from "vitest"
import { applyProjectSettingsToServices } from "../apply-project-settings"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"

const originalVercel = process.env.VERCEL

afterEach(() => {
  if (originalVercel === undefined) delete process.env.VERCEL
  else process.env.VERCEL = originalVercel
})

type SettingsStore = Record<string, unknown>

/**
 * Thin project-layer SettingsManager stub: `updateProjectSettings` mirrors Pi's
 * behavior (read-modify-write on the project layer). It never touches a global
 * layer — deployed masking must land in project scope, not the user's global
 * `~/.pi/agent/settings.json`.
 */
function createManagerStub(initialProject: SettingsStore = {}) {
  const state = { project: structuredClone(initialProject) }
  const updateProjectSettings = vi.fn(
    (_field: string, update: (settings: SettingsStore) => void) => {
      const next = structuredClone(state.project)
      update(next)
      state.project = next
    }
  )
  return {
    state,
    updateProjectSettings,
    setDefaultProvider: vi.fn(),
    setDefaultModel: vi.fn(),
    applyOverrides: vi.fn(),
    // Unused setters for the apply path.
    setProjectPackages: vi.fn(),
    setProjectSkillPaths: vi.fn(),
    setProjectExtensionPaths: vi.fn(),
    setProjectPromptTemplatePaths: vi.fn(),
    setProjectThemePaths: vi.fn(),
    setEnableSkillCommands: vi.fn(),
    setEnabledModels: vi.fn(),
    setDefaultThinkingLevel: vi.fn(),
    setSteeringMode: vi.fn(),
    setFollowUpMode: vi.fn(),
  }
}

function servicesFor(manager: ReturnType<typeof createManagerStub>) {
  return { settingsManager: manager } as unknown as AgentSessionServices
}

describe("applyProjectSettingsToServices", () => {
  it("deletes project defaultProvider/defaultModel on deployed surfaces when Fleet settings have none", () => {
    process.env.VERCEL = "1"
    const manager = createManagerStub({
      defaultProvider: "opencode",
      defaultModel: "deepseek-v4-flash-free",
    })

    applyProjectSettingsToServices(servicesFor(manager), {
      packages: ["npm:pi-autoresearch"],
    })

    // Clearing lands in the project layer (survives reload), never a global write.
    expect(manager.state.project).not.toHaveProperty("defaultProvider")
    expect(manager.state.project).not.toHaveProperty("defaultModel")
    expect(manager.setDefaultProvider).not.toHaveBeenCalled()
    expect(manager.setDefaultModel).not.toHaveBeenCalled()
  })

  it("applies a Fleet-configured default provider/model in project scope", () => {
    process.env.VERCEL = "1"
    const manager = createManagerStub()

    applyProjectSettingsToServices(servicesFor(manager), {
      defaultProvider: "openai-chat-completions",
      defaultModel: "qwen35-122b-a10b",
    })

    expect(manager.state.project.defaultProvider).toBe(
      "openai-chat-completions"
    )
    expect(manager.state.project.defaultModel).toBe("qwen35-122b-a10b")
  })

  it("leaves the project default untouched in local dev (non-deployed)", () => {
    delete process.env.VERCEL
    const manager = createManagerStub({
      defaultProvider: "opencode",
      defaultModel: "deepseek-v4-flash-free",
    })

    applyProjectSettingsToServices(servicesFor(manager), {
      packages: ["npm:pi-autoresearch"],
    })

    expect(manager.state.project.defaultProvider).toBe("opencode")
    expect(manager.state.project.defaultModel).toBe("deepseek-v4-flash-free")
    expect(manager.updateProjectSettings).not.toHaveBeenCalled()
  })
})
