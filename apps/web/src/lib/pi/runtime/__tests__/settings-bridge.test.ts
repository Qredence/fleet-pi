import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  impactForSettings,
  loadChatSettings,
  readProjectSettingsFile,
  updateChatSettings,
} from "../settings-bridge"

const mocks = vi.hoisted(() => ({
  collectDiagnostics: vi.fn(() => ["settings diagnostic"]),
  createSessionServices: vi.fn(),
  hotReloadActiveRuntimes: vi.fn(),
  resolveDefaultModelSelection: vi.fn(() => ({
    defaultProvider: "google",
    defaultModel: "gemini-3.5-flash",
  })),
}))

vi.mock("../diagnostics", () => ({
  collectDiagnostics: mocks.collectDiagnostics,
  resolveDefaultModelSelection: mocks.resolveDefaultModelSelection,
}))

vi.mock("../session-factory", () => ({
  createSessionServices: mocks.createSessionServices,
}))

vi.mock("../hot-reload", () => ({
  hotReloadActiveRuntimes: mocks.hotReloadActiveRuntimes,
}))

const roots = new Set<string>()

function createProjectRoot() {
  const root = mkdtempSync(join(tmpdir(), "fleet-pi-settings-bridge-"))
  roots.add(root)
  return root
}

function createSettingsManager(projectSettings: Record<string, unknown> = {}) {
  return {
    getCompactionSettings: vi.fn(() => ({
      enabled: true,
      reserveTokens: 2048,
      keepRecentTokens: 512,
    })),
    getDefaultModel: vi.fn(() => "gemini-3.5-flash"),
    getDefaultProvider: vi.fn(() => "google"),
    getDefaultThinkingLevel: vi.fn(() => "medium"),
    getEnableSkillCommands: vi.fn(() => true),
    getEnabledModels: vi.fn(() => ["google/*"]),
    getExtensionPaths: vi.fn(() => ["agent-workspace/pi/extensions"]),
    getFollowUpMode: vi.fn(() => "auto"),
    getPackages: vi.fn(() => ["npm:pi-web-access"]),
    getProjectSettings: vi.fn(() => projectSettings),
    getPromptTemplatePaths: vi.fn(() => ["agent-workspace/pi/prompts"]),
    getRetrySettings: vi.fn(() => ({
      enabled: true,
      maxRetries: 2,
      baseDelayMs: 250,
    })),
    getSkillPaths: vi.fn(() => ["agent-workspace/pi/skills"]),
    getSteeringMode: vi.fn(() => "auto"),
    getThemePaths: vi.fn(() => ["agent-workspace/pi/themes"]),
    getTransport: vi.fn(() => "stdio"),
  }
}

describe("settings bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSessionServices.mockResolvedValue({
      settingsManager: createSettingsManager(),
    })
  })

  afterEach(() => {
    for (const root of roots) {
      rmSync(root, { force: true, recursive: true })
    }
    roots.clear()
  })

  it("marks enableSkillCommands changes as resource reload required", () => {
    expect(
      impactForSettings({
        enableSkillCommands: false,
      }).resourceReloadRequired
    ).toBe(true)
  })

  it("loads effective and project settings with reload impact metadata", async () => {
    mocks.createSessionServices.mockResolvedValue({
      settingsManager: createSettingsManager({
        defaultProvider: "google",
        defaultModel: "gemini-3.5-flash",
        enabledModels: ["google/*", 123],
        packages: ["npm:pi-autocontext", { source: "npm:team-pack" }],
        compaction: { enabled: false, reserveTokens: 4096 },
        retry: { maxRetries: 4, ignored: "not copied" },
        transport: "sse",
      }),
    })

    const response = await loadChatSettings({
      projectRoot: createProjectRoot(),
    } as never)

    expect(response.projectPath).toBe(".pi/settings.json")
    expect(response.project.packages).toEqual([
      "npm:pi-autocontext",
      { source: "npm:team-pack" },
    ])
    expect(response.updateImpact).toEqual({
      newSessionRecommended: false,
      resourceReloadRequired: false,
    })
  })

  it("persists validated updates and triggers hot reload", async () => {
    const projectRoot = createProjectRoot()
    mkdirSync(join(projectRoot, ".pi"), { recursive: true })
    writeFileSync(
      join(projectRoot, ".pi/settings.json"),
      JSON.stringify({ packages: ["npm:old"] }, null, 2)
    )

    await updateChatSettings({ projectRoot } as never, {
      defaultProvider: "google",
      packages: ["npm:pi-web-access"],
    })

    const persisted = JSON.parse(
      readFileSync(join(projectRoot, ".pi/settings.json"), "utf8")
    ) as unknown

    expect(persisted).toEqual({
      packages: ["npm:pi-web-access"],
      defaultProvider: "google",
    })
    expect(mocks.hotReloadActiveRuntimes).toHaveBeenCalled()
  })

  it("returns update impact from the settings delta on save", async () => {
    const projectRoot = createProjectRoot()
    mkdirSync(join(projectRoot, ".pi"), { recursive: true })
    writeFileSync(
      join(projectRoot, ".pi/settings.json"),
      JSON.stringify({}, null, 2)
    )

    const response = await updateChatSettings({ projectRoot } as never, {
      packages: ["npm:pi-web-access"],
    })

    expect(response.updateImpact).toEqual({
      newSessionRecommended: true,
      resourceReloadRequired: true,
    })
  })

  it("reads missing project settings files as empty objects", async () => {
    await expect(readProjectSettingsFile(createProjectRoot())).resolves.toEqual(
      {}
    )
  })
})
