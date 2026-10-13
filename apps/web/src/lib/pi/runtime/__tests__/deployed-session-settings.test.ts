import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SettingsManager } from "@earendil-works/pi-coding-agent"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runWithChatAuthSurface } from "../../../auth/chat-auth-surface"
import { createSessionServices } from "../session-factory"
import { hydrateSessionServicesSettings } from "../durable-project-settings"
import { hotReloadActiveRuntimesForUser } from "../hot-reload"
import {
  deleteActiveSessionRecord,
  setActiveSessionRecord,
} from "../active-sessions"
import {
  createIsolatedProjectSettings,
  replaceIsolatedProjectSettings,
} from "../isolated-project-settings"
import type {
  AgentSessionRuntime,
  AgentSessionServices,
} from "@earendil-works/pi-coding-agent"
import type { AppRuntimeContext } from "../../../app-runtime"

const mocks = vi.hoisted(() => ({
  loadUserProjectSettings: vi.fn(),
}))

vi.mock("../../../db/user-settings", () => ({
  loadUserProjectSettings: mocks.loadUserProjectSettings,
}))
vi.mock("../../../workspace/bootstrap-agent-workspace", () => ({
  bootstrapAgentWorkspace: vi.fn(() =>
    Promise.resolve({
      status: "ok",
      workspace: { available: true },
      warnings: [],
      diagnostics: [],
    })
  ),
  createWorkspaceHealthFailure: vi.fn(),
}))
vi.mock("../gateway-settings-migration", () => ({
  migrateLegacyGatewayProjectOverrides: vi.fn((settings) =>
    Promise.resolve(settings)
  ),
}))
vi.mock("../user-provider-secrets", () => ({
  loadLlmProviderSecrets: vi.fn(() => Promise.resolve(new Map())),
  resolveUserProviderSecret: vi.fn(() => Promise.resolve(undefined)),
  hasExplicitOccByok: vi.fn(() => Promise.resolve(false)),
}))

const settingsByUser = new Map<string, Record<string, unknown>>()
const sessionIds = new Set<string>()
const bridgeKey = Symbol.for("fleet-pi.harness-write")
const bridgeGlobal = globalThis as typeof globalThis & {
  [bridgeKey]?: unknown
}
let root: string
let sharedFile: string
let originalBridge: unknown
const sharedSource =
  '{ "enabledModels": ["shared/poison"], "themes": ["themes/shared"] }\n'

beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubEnv("VERCEL", "")
  vi.stubEnv("FLEET_PI_CHAT_DATABASE_URL", "")
  vi.stubEnv("DATABASE_URL", "")
  settingsByUser.clear()
  originalBridge = bridgeGlobal[bridgeKey]
  delete bridgeGlobal[bridgeKey]
  root = await mkdtemp(join(tmpdir(), "fleet-pi-private-settings-"))
  await mkdir(join(root, ".pi"))
  sharedFile = join(root, ".pi/settings.json")
  await writeFile(sharedFile, sharedSource)
  mocks.loadUserProjectSettings.mockImplementation((userId: string) =>
    Promise.resolve(structuredClone(settingsByUser.get(userId) ?? null))
  )
})

afterEach(async () => {
  for (const id of sessionIds) deleteActiveSessionRecord(id)
  sessionIds.clear()
  if (originalBridge === undefined) delete bridgeGlobal[bridgeKey]
  else bridgeGlobal[bridgeKey] = originalBridge
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

function createServices(userId: string, callerManager?: SettingsManager) {
  return createSessionServices(
    { projectRoot: root } as AppRuntimeContext,
    {
      cwd: root,
      agentDir: join(root, "agent"),
      settingsManager: callerManager,
      modelRuntime: {
        refresh: vi.fn(() => Promise.resolve()),
        unregisterProvider: vi.fn(),
        getRegisteredProviderIds: vi.fn(() => []),
      } as unknown as AgentSessionServices["modelRuntime"],
      resourceLoaderOptions: { noExtensions: true },
    },
    { userId }
  )
}

function retainServices(
  id: string,
  userId: string,
  services: AgentSessionServices
) {
  sessionIds.add(id)
  setActiveSessionRecord(id, {
    sessionId: id,
    userId,
    lastUsedAt: Date.now(),
    runtime: { services } as AgentSessionRuntime,
  })
}

describe("deployed session settings", () => {
  it("seeds the real resource loader privately before its first reload", async () => {
    await mkdir(join(root, "private-skills", "a"), { recursive: true })
    await writeFile(
      join(root, "private-skills", "a", "SKILL.md"),
      "---\nname: private-a\ndescription: User A's skill\n---\n# Private\n"
    )
    settingsByUser.set("a", {
      skills: ["../private-skills"],
      enabledModels: ["custom+a/model-a"],
      defaultProvider: "custom+a",
      defaultModel: "model-a",
    })
    const callerManager = SettingsManager.create(root, join(root, "agent"))

    await runWithChatAuthSurface("neon-function", async () => {
      const a = await createServices("a", callerManager)
      const b = await createServices("b")
      expect(a.settingsManager).not.toBe(callerManager)
      expect(a.settingsManager.getGlobalSettings()).toEqual({})
      expect(a.settingsManager.getEnabledModels()).toEqual(["custom+a/model-a"])
      expect(
        a.resourceLoader.getSkills().skills.map((skill) => skill.name)
      ).toContain("private-a")
      expect(
        b.resourceLoader.getSkills().skills.map((skill) => skill.name)
      ).not.toContain("private-a")
      expect(b.settingsManager.getEnabledModels()).toBeUndefined()
      expect(b.settingsManager.getDefaultProvider()).toBeUndefined()
      expect(b.settingsManager.getDefaultModel()).toBeUndefined()
      expect(b.settingsManager.getThemePaths()).toEqual([])
      expect(b.settingsManager.getPackages()).toEqual([])
    })
    expect(await readFile(sharedFile, "utf8")).toBe(sharedSource)
  })

  it.each(["neon-function", "vercel"] as const)(
    "keeps concurrent users and deny-all isolated on %s",
    async (surface) => {
      if (surface === "vercel") vi.stubEnv("VERCEL", "1")
      settingsByUser.set("a", {
        packages: [],
        enabledModels: ["custom+a/model"],
      })
      settingsByUser.set("b", { packages: [], enabledModels: [] })
      await runWithChatAuthSurface(
        surface === "neon-function" ? surface : "web",
        async () => {
          const [a, b] = await Promise.all([
            createServices("a"),
            createServices("b"),
          ])
          expect(a.settingsManager).not.toBe(b.settingsManager)
          await Promise.all([
            a.resourceLoader.reload(),
            b.resourceLoader.reload(),
          ])
          expect(a.settingsManager.getEnabledModels()).toEqual([
            "custom+a/model",
          ])
          expect(b.settingsManager.getEnabledModels()).toEqual([])
        }
      )
      expect(await readFile(sharedFile, "utf8")).toBe(sharedSource)
    }
  )

  it("removes old overrides on hydration and reloads only the matching user", async () => {
    settingsByUser.set("a", {
      enabledModels: ["custom+a/old"],
      themes: ["themes/old"],
      defaultProvider: "custom+a",
      defaultModel: "old",
      transport: "websocket",
    })
    settingsByUser.set("b", { enabledModels: ["custom+b/keep"] })
    await runWithChatAuthSurface("neon-function", async () => {
      const [a, b] = await Promise.all([
        createServices("a"),
        createServices("b"),
      ])
      retainServices("session-a", "a", a)
      retainServices("session-b", "b", b)
      const reloadB = vi.spyOn(b.resourceLoader, "reload")
      settingsByUser.set("a", {})

      await hotReloadActiveRuntimesForUser("a", {}, root)
      expect(a.settingsManager.getEnabledModels()).toBeUndefined()
      expect(a.settingsManager.getThemePaths()).toEqual([])
      expect(a.settingsManager.getDefaultModel()).toBeUndefined()
      expect(a.settingsManager.getDefaultProvider()).toBeUndefined()
      expect(a.settingsManager.getTransport()).toBe("auto")
      expect(b.settingsManager.getEnabledModels()).toEqual(["custom+b/keep"])
      expect(reloadB).not.toHaveBeenCalled()
      settingsByUser.set("a", { enabledModels: [] })
      await hydrateSessionServicesSettings(a, {
        userId: "a",
        projectRoot: root,
      })
      expect(a.settingsManager.getEnabledModels()).toEqual([])
      await a.resourceLoader.reload()
      expect(a.settingsManager.getEnabledModels()).toEqual([])
    })
    expect(await readFile(sharedFile, "utf8")).toBe(sharedSource)
  })

  it("flushes pending writes before replacing the complete snapshot", async () => {
    const manager = createIsolatedProjectSettings({ enabledModels: ["old"] })
    manager.setEnabledModels(["pending"])
    manager.setProjectThemePaths(["themes/pending"])
    await replaceIsolatedProjectSettings(manager, { enabledModels: [] })
    await manager.reload()
    expect(manager.getEnabledModels()).toEqual([])
    expect(manager.getThemePaths()).toEqual([])
    expect(manager.getGlobalSettings()).toEqual({})
    await expect(
      replaceIsolatedProjectSettings(SettingsManager.inMemory(), {})
    ).rejects.toThrow("isolated runtime storage")
  })
})
