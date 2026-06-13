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
  loadChatSettings,
  readProjectSettingsFile,
  updateChatSettings,
} from "../server-settings"

const mocks = vi.hoisted(() => ({
  collectDiagnostics: vi.fn(() => ["settings diagnostic"]),
  createSessionServices: vi.fn(),
  resolveDefaultModelSelection: vi.fn(() => ({
    defaultProvider: "google",
    defaultModel: "gemini-3.5-flash",
  })),
}))

vi.mock("../server-shared", () => ({
  collectDiagnostics: mocks.collectDiagnostics,
  createSessionServices: mocks.createSessionServices,
  resolveDefaultModelSelection: mocks.resolveDefaultModelSelection,
}))

const roots = new Set<string>()

function createProjectRoot() {
  const root = mkdtempSync(join(tmpdir(), "fleet-pi-settings-"))
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

describe("chat settings runtime helpers", () => {
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

  it("reads missing and invalid project settings files as empty editable settings", async () => {
    const projectRoot = createProjectRoot()

    await expect(readProjectSettingsFile(projectRoot)).resolves.toEqual({})

    mkdirSync(join(projectRoot, ".pi"), { recursive: true })
    writeFileSync(join(projectRoot, ".pi/settings.json"), "[]")

    await expect(readProjectSettingsFile(projectRoot)).resolves.toEqual({})
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
    expect(response.diagnostics).toEqual(["settings diagnostic"])
    expect(response.effective).toMatchObject({
      defaultProvider: "google",
      defaultModel: "gemini-3.5-flash",
      transport: "auto",
      compaction: {
        enabled: true,
        reserveTokens: 2048,
        keepRecentTokens: 512,
      },
    })
    expect(response.project).toMatchObject({
      defaultProvider: "google",
      defaultModel: "gemini-3.5-flash",
      enabledModels: ["google/*"],
      packages: ["npm:pi-autocontext", { source: "npm:team-pack" }],
      compaction: { enabled: false, reserveTokens: 4096 },
      retry: { maxRetries: 4 },
      transport: "sse",
    })
    expect(response.updateImpact).toEqual({
      newSessionRecommended: true,
      resourceReloadRequired: true,
    })
  })

  it("persists validated updates and preserves unrelated project settings", async () => {
    const projectRoot = createProjectRoot()
    mkdirSync(join(projectRoot, ".pi"), { recursive: true })
    writeFileSync(
      join(projectRoot, ".pi/settings.json"),
      JSON.stringify(
        {
          packages: ["npm:old"],
          customProviderConfig: { keep: true },
        },
        null,
        2
      )
    )
    mocks.createSessionServices.mockResolvedValue({
      settingsManager: createSettingsManager({
        packages: ["npm:pi-web-access"],
      }),
    })

    const response = await updateChatSettings({ projectRoot } as never, {
      defaultProvider: "google",
      packages: ["npm:pi-web-access"],
      compaction: { reserveTokens: 8192 },
    })
    const persisted = JSON.parse(
      readFileSync(join(projectRoot, ".pi/settings.json"), "utf8")
    ) as unknown

    expect(persisted).toEqual({
      packages: ["npm:pi-web-access"],
      customProviderConfig: { keep: true },
      defaultProvider: "google",
      compaction: { reserveTokens: 8192 },
    })
    expect(response.project.packages).toEqual(["npm:pi-web-access"])
  })

  it("rejects invalid updates before writing settings", async () => {
    const projectRoot = createProjectRoot()

    await expect(
      updateChatSettings(
        { projectRoot } as never,
        {
          enabledModels: [123],
        } as never
      )
    ).rejects.toThrow()

    await expect(readProjectSettingsFile(projectRoot)).resolves.toEqual({})
  })
})
