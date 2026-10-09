import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AgentSessionRuntime } from "@earendil-works/pi-coding-agent"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import type { ActiveSessionRecord } from "../runtime/active-sessions"

const mocks = vi.hoisted(() => {
  const activeRecords = new Map<string, ActiveSessionRecord>()

  return {
    activeRecords,
    applyModelSelection: vi.fn(),
    applyPlanMode: vi.fn(),
    applyRuntimeAuth: vi.fn(),
    collectDiagnostics: vi.fn((services: { marker?: string }) => [
      `${services.marker ?? "unknown"}-diagnostic`,
    ]),
    createAgentSessionFromServices: vi.fn(),
    createAgentSessionRuntime: vi.fn(),
    createSessionManager: vi.fn(),
    createSessionServices: vi.fn(),
    getAgentDir: vi.fn(() => "/tmp/pi-agent"),
    getCachedUserSandbox: vi.fn(() => undefined),
    getSessionDir: vi.fn(() => "/repo/.fleet/sessions"),
    isDaytonaEnabled: vi.fn(() => false),
    isUsableSessionFile: vi.fn(() => true),
    reconcileRuntimeOccModel: vi.fn(),
    releaseUserSandbox: vi.fn(() => Promise.resolve()),
    resolveDaytonaRuntimeApiKey: vi.fn(() => Promise.resolve(undefined)),
    resolveDaytonaWorkspace: vi.fn(),
    resolveModelSelection: vi.fn((): { model?: unknown } => ({})),
    resolveServerDefaultChatModel: vi.fn(),
    safeRealpath: vi.fn((path: string) => path),
  }
})

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSessionFromServices: mocks.createAgentSessionFromServices,
  createAgentSessionRuntime: mocks.createAgentSessionRuntime,
  getAgentDir: mocks.getAgentDir,
}))

vi.mock("../runtime/active-sessions", () => ({
  deleteActiveSessionRecord: (sessionId: string) =>
    mocks.activeRecords.delete(sessionId),
  getActiveSessionRecords: () => mocks.activeRecords,
  hasOtherActiveSessionForUser: (userId: string, excludeSessionId?: string) =>
    [...mocks.activeRecords.values()].some(
      (record) =>
        record.userId === userId && record.sessionId !== excludeSessionId
    ),
  setActiveSessionRecord: (sessionId: string, record: unknown) =>
    mocks.activeRecords.set(sessionId, record as ActiveSessionRecord),
}))

vi.mock("../circuit-breaker", () => ({
  createSessionCircuitBreaker: vi.fn(
    (handler: (...args: Array<unknown>) => unknown) => ({
      fallback: vi.fn(),
      fire: (...args: Array<unknown>) => handler(...args),
    })
  ),
  createSessionFallbackError: vi.fn(() => new Error("session fallback")),
}))

vi.mock("../plan-mode", () => ({
  CHAT_TOOL_ALLOWLIST: ["read"],
  answerPlanDecision: vi.fn(),
  applyPlanMode: mocks.applyPlanMode,
  clearPlanModeSession: vi.fn(),
  createPlanToolPart: vi.fn(),
  getPlanState: vi.fn(() => ({ pendingDecision: false, todos: [] })),
  isPlanDecisionToolCall: vi.fn(() => false),
  resolveQuestionnaireAnswer: vi.fn(() => false),
}))

vi.mock("../runtime/index", () => ({
  RESOURCE_SETTING_KEYS: [],
  applyModelSelection: mocks.applyModelSelection,
  applyRuntimeAuth: mocks.applyRuntimeAuth,
  collectDiagnostics: mocks.collectDiagnostics,
  createSessionServices: mocks.createSessionServices,
  getProviderConfigStatus: vi.fn(),
  hotReloadActiveRuntimes: vi.fn(),
  hotReloadActiveRuntimesForUser: vi.fn(),
  hotReloadProviderAuthForActiveRuntimes: vi.fn(),
  impactForSettings: vi.fn(),
  loadChatModels: vi.fn(),
  loadChatResources: vi.fn(),
  loadChatSettings: vi.fn(),
  loadPersistedProjectSettingsOverrides: vi.fn(),
  patchProjectSettingsOverrides: vi.fn(),
  readProjectSettingsFile: vi.fn(),
  resolveDaytonaRuntimeApiKey: mocks.resolveDaytonaRuntimeApiKey,
  resolveDefaultModelSelection: vi.fn(),
  resolveModelSelection: vi.fn(),
  resolveUserDaytonaApiKey: vi.fn(),
  resolveUserProviderSecret: vi.fn(),
  saveProjectSettingsOverrides: vi.fn(),
  updateChatSettings: vi.fn(),
}))

vi.mock("../runtime/model-catalog", () => ({
  applyModelSelection: mocks.applyModelSelection,
  resolveServerDefaultChatModel: mocks.resolveServerDefaultChatModel,
  resolveModelSelection: mocks.resolveModelSelection,
}))

vi.mock("../runtime/openai-chat-completions-compat", () => ({
  reconcileRuntimeOccModel: mocks.reconcileRuntimeOccModel,
}))

vi.mock("../runtime/session-factory", () => ({
  applyRuntimeAuth: mocks.applyRuntimeAuth,
}))

vi.mock("../runtime/user-provider-secrets", () => ({
  resolveDaytonaRuntimeApiKey: mocks.resolveDaytonaRuntimeApiKey,
  resolveUserDaytonaApiKey: vi.fn(),
  resolveUserProviderSecret: vi.fn(),
}))

vi.mock("../server-shared", () => ({
  collectDiagnostics: mocks.collectDiagnostics,
  createSessionServices: mocks.createSessionServices,
  getSessionDir: mocks.getSessionDir,
  safeRealpath: mocks.safeRealpath,
}))

vi.mock("../server-sessions", () => ({
  createSessionManager: mocks.createSessionManager,
  isUsableSessionFile: mocks.isUsableSessionFile,
}))

vi.mock("@/lib/daytona/client", () => ({
  executeCommand: vi.fn(),
}))

vi.mock("@/lib/daytona/resolve-user-sandbox-context", () => ({
  resolveUserSandboxContext: mocks.resolveDaytonaWorkspace,
}))

vi.mock("@/lib/daytona/sandbox-prepare", () => ({
  SANDBOX_WORKSPACE_ROOT: "/home/daytona/agent-workspace",
}))

vi.mock("@/lib/daytona/tool-context", () => ({
  resolveDaytonaToolUser: vi.fn(),
  trackDaytonaToolSession: vi.fn(),
  untrackDaytonaToolSession: vi.fn(),
}))

vi.mock("@/lib/daytona/user-sandbox", () => ({
  getCachedUserSandbox: mocks.getCachedUserSandbox,
  isDaytonaEnabled: mocks.isDaytonaEnabled,
  releaseUserSandbox: mocks.releaseUserSandbox,
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe("createPiRuntime active reuse", () => {
  beforeEach(() => {
    mocks.activeRecords.clear()
    mocks.applyModelSelection.mockReset()
    mocks.applyPlanMode.mockReset()
    mocks.createAgentSessionRuntime.mockReset()
    mocks.createSessionManager.mockReset()
    mocks.createSessionServices.mockReset()
    mocks.getCachedUserSandbox.mockReset()
    mocks.getSessionDir.mockReset()
    mocks.isDaytonaEnabled.mockReset()
    mocks.isUsableSessionFile.mockReset()
    mocks.resolveDaytonaRuntimeApiKey.mockReset()
    mocks.resolveDaytonaWorkspace.mockReset()
    mocks.safeRealpath.mockReset()
    mocks.collectDiagnostics.mockReset()

    mocks.applyModelSelection.mockResolvedValue(undefined)
    mocks.createSessionServices.mockResolvedValue({ marker: "request" })
    mocks.getCachedUserSandbox.mockReturnValue(undefined)
    mocks.getSessionDir.mockReturnValue("/repo/.fleet/sessions")
    mocks.isDaytonaEnabled.mockReturnValue(false)
    mocks.isUsableSessionFile.mockReturnValue(true)
    mocks.resolveDaytonaRuntimeApiKey.mockResolvedValue(undefined)
    mocks.resolveDaytonaWorkspace.mockResolvedValue(undefined)
    mocks.safeRealpath.mockImplementation((path: string) => path)
    mocks.collectDiagnostics.mockImplementation(
      (services: { marker?: string }) => [
        `${services.marker ?? "unknown"}-diagnostic`,
      ]
    )
  })

  it("reuses an active runtime before resolving services or Daytona", async () => {
    const { createPiRuntime, retainPiRuntime } =
      await import("../server-runtime")
    const runtime = createMockRuntime("active-session", "active.jsonl")
    retainPiRuntime(runtime, "user-a")

    const result = await createPiRuntime(
      context(),
      { sessionId: "active-session", userId: "user-a" },
      { provider: "google", id: "gemini-3.5-flash" }
    )

    expect(result.runtime).toBe(runtime)
    expect(result.sessionReset).toBe(false)
    expect(result.diagnostics).toEqual(["runtime-diagnostic"])
    expect(mocks.resolveDaytonaRuntimeApiKey).not.toHaveBeenCalled()
    expect(mocks.createSessionServices).not.toHaveBeenCalled()
    expect(mocks.createSessionManager).not.toHaveBeenCalled()
    expect(mocks.collectDiagnostics).toHaveBeenCalledWith(runtime.services)
  })

  it("validates an existing session file before reusing its runtime", async () => {
    const { createPiRuntime, retainPiRuntime } =
      await import("../server-runtime")
    const sessionFile = "/repo/.fleet/sessions/active.jsonl"
    const runtime = createMockRuntime("active-session", sessionFile)
    retainPiRuntime(runtime, "user-a")

    const result = await createPiRuntime(
      context(),
      { sessionFile, sessionId: "active-session", userId: "user-a" },
      undefined
    )

    expect(result.runtime).toBe(runtime)
    expect(result.sessionReset).toBe(false)
    expect(mocks.resolveDaytonaRuntimeApiKey).toHaveBeenCalledWith("user-a")
    expect(mocks.createSessionServices).toHaveBeenCalledTimes(1)
    expect(mocks.isUsableSessionFile).toHaveBeenCalledWith(
      sessionFile,
      "/repo/.fleet/sessions"
    )
    expect(mocks.createSessionManager).not.toHaveBeenCalled()
  })

  it("creates a fresh session and preserves reset state for an invalid file", async () => {
    const { createPiRuntime, retainPiRuntime } =
      await import("../server-runtime")
    const owner = createMockRuntime(
      "active-session",
      "/repo/.fleet/sessions/active.jsonl"
    )
    retainPiRuntime(owner, "user-a")
    const fresh = createMockRuntime(
      "fresh-session",
      "/repo/.fleet/sessions/fresh.jsonl"
    )
    mocks.isUsableSessionFile.mockReturnValue(false)
    mocks.createSessionManager.mockResolvedValue({
      sessionManager: {
        getSessionFile: () => fresh.session.sessionFile,
        getSessionId: () => fresh.session.sessionId,
      },
      sessionReset: true,
    })
    mocks.createAgentSessionRuntime.mockResolvedValue(fresh)

    const result = await createPiRuntime(
      context(),
      {
        sessionFile: "/tmp/outside-session.jsonl",
        sessionId: "active-session",
        userId: "user-a",
      },
      undefined
    )

    expect(result.runtime).toBe(fresh)
    expect(result.runtime).not.toBe(owner)
    expect(result.sessionReset).toBe(true)
    expect(mocks.createSessionManager).toHaveBeenCalledWith(
      {
        sessionFile: "/tmp/outside-session.jsonl",
        sessionId: "active-session",
        userId: "user-a",
      },
      "/repo",
      "/repo/.fleet/sessions",
      { userId: "user-a" }
    )
  })

  it("does not reuse another user's active runtime", async () => {
    const { createPiRuntime, retainPiRuntime } =
      await import("../server-runtime")
    const owner = createMockRuntime("shared-session", "shared.jsonl")
    retainPiRuntime(owner, "user-a")
    const fresh = createMockRuntime("fresh-session", "fresh.jsonl")
    mocks.createSessionManager.mockResolvedValue({
      sessionManager: {
        getSessionFile: () => fresh.session.sessionFile,
        getSessionId: () => fresh.session.sessionId,
      },
      sessionReset: true,
    })
    mocks.createAgentSessionRuntime.mockResolvedValue(fresh)

    const result = await createPiRuntime(
      context(),
      { sessionId: "shared-session", userId: "user-b" },
      undefined
    )

    expect(result.runtime).toBe(fresh)
    expect(result.runtime).not.toBe(owner)
    expect(mocks.createSessionServices).toHaveBeenCalledWith(
      context(),
      undefined,
      { userId: "user-b" }
    )
    expect(mocks.createSessionManager).toHaveBeenCalled()
  })

  it("applies model selection and Plan mode on active reuse", async () => {
    const { createPiRuntime, retainPiRuntime } =
      await import("../server-runtime")
    const runtime = createMockRuntime("plan-session", "plan.jsonl")
    retainPiRuntime(runtime, "user-a")
    const selection = {
      provider: "openai-chat-completions",
      id: "gpt-5.6-luna",
      thinkingLevel: "high" as const,
    }

    await createPiRuntime(
      context(),
      {
        sessionId: "plan-session",
        userId: "user-a",
        mode: "plan",
        planAction: "refine",
      },
      selection
    )

    expect(mocks.applyModelSelection).toHaveBeenCalledWith(
      runtime,
      selection,
      "user-a"
    )
    expect(mocks.applyPlanMode).toHaveBeenCalledWith(runtime, "plan", "refine")
  })

  it("schedules disposal when reuse model application fails", async () => {
    const { createPiRuntime, retainPiRuntime } =
      await import("../server-runtime")
    const runtime = createMockRuntime("broken-session", "broken.jsonl")
    retainPiRuntime(runtime, "user-a")
    const error = new Error("model selection failed")
    mocks.applyModelSelection.mockRejectedValueOnce(error)

    await expect(
      createPiRuntime(
        context(),
        { sessionId: "broken-session", userId: "user-a" },
        "google/gemini-3.5-flash"
      )
    ).rejects.toBe(error)

    const record = mocks.activeRecords.get("broken-session")
    expect(record?.disposeTimer).toBeDefined()
    expect(runtime.dispose).not.toHaveBeenCalled()
    if (!record?.disposeTimer) {
      throw new Error("Expected reuse failure to schedule runtime disposal")
    }
    clearTimeout(record.disposeTimer)
  })

  it("concurrent first-turn creation disposes the first-resolved runtime once and keeps the survivor streaming", async () => {
    vi.useFakeTimers()
    const previousTtl = process.env.FLEET_PI_RUNTIME_TTL_MS
    process.env.FLEET_PI_RUNTIME_TTL_MS = "0"
    try {
      const { createPiRuntime, retainPiRuntime } =
        await import("../server-runtime")
      const sessionFile = "/repo/.fleet/sessions/race.jsonl"
      const first = createMockRuntime("race", sessionFile)
      const second = createMockRuntime("race", sessionFile)

      mocks.createSessionManager.mockResolvedValue({
        sessionManager: {
          getSessionFile: () => sessionFile,
          getSessionId: () => "race",
        },
        sessionReset: true,
      })
      let resolveSecond!: (runtime: AgentSessionRuntime) => void
      mocks.createAgentSessionRuntime
        .mockImplementationOnce(() => Promise.resolve(first))
        .mockImplementationOnce(
          () =>
            new Promise<AgentSessionRuntime>((resolve) => {
              resolveSecond = resolve
            })
        )

      // Both turns start before either runtime is tracked, so both pass the
      // early reuse check and each creates its own runtime for the session.
      const firstTurn = createPiRuntime(
        context(),
        { sessionId: "race", sessionFile, userId: "user-a" },
        undefined
      )
      const secondTurn = createPiRuntime(
        context(),
        { sessionId: "race", sessionFile, userId: "user-a" },
        undefined
      )

      // The first-resolved turn retains + releases, scheduling a disposal.
      const firstResult = await firstTurn
      const releaseFirst = retainPiRuntime(firstResult.runtime, "user-a")
      releaseFirst()

      // Let the second creation resolve; it replaces the first runtime.
      resolveSecond(second)
      const secondResult = await secondTurn
      retainPiRuntime(secondResult.runtime, "user-a")

      // The replaced (first-resolved) runtime is disposed exactly once.
      expect(first.dispose).toHaveBeenCalledTimes(1)
      expect(second.dispose).not.toHaveBeenCalled()

      // The survivor still streams.
      await expect(second.session.prompt("hello")).resolves.toBeUndefined()
      expect(second.session.prompt).toHaveBeenCalledWith("hello")

      // No stale scheduled disposal (for the first-resolved runtime) can
      // ever dispose the survivor.
      await vi.runOnlyPendingTimersAsync()
      expect(second.dispose).not.toHaveBeenCalled()
      expect(first.dispose).toHaveBeenCalledTimes(1)
    } finally {
      process.env.FLEET_PI_RUNTIME_TTL_MS = previousTtl
      vi.useRealTimers()
    }
  })
})

function context() {
  return {
    projectRoot: "/repo",
    workspaceRoot: "/repo/agent-workspace",
  } as unknown as AppRuntimeContext
}

function createMockRuntime(sessionId: string, sessionFile: string) {
  return {
    dispose: vi.fn(() => Promise.resolve(undefined)),
    modelFallbackMessage: undefined,
    services: { marker: "runtime" },
    session: {
      isStreaming: false,
      prompt: vi.fn(() => Promise.resolve()),
      sessionFile,
      sessionId,
    },
  } as unknown as AgentSessionRuntime
}

describe("createPiRuntime default model for new sessions", () => {
  const configured = { provider: "openai-chat-completions", id: "cmd-model" }

  async function runFactory(
    sessionContext: { messages: Array<unknown>; model?: unknown },
    selectionModel?: unknown
  ) {
    const { createPiRuntime } = await import("../server-runtime")
    const fresh = createMockRuntime("new-session", "new.jsonl")
    const runtimeSessionManager = {
      buildSessionContext: () => sessionContext,
      getSessionFile: () => fresh.session.sessionFile,
      getSessionId: () => fresh.session.sessionId,
    }
    const services = {
      marker: "request",
      modelRuntime: {
        getModel: () => undefined,
        hasConfiguredAuth: () => false,
      },
    }
    mocks.createSessionServices.mockResolvedValue(services)
    mocks.createSessionManager.mockResolvedValue({
      sessionManager: runtimeSessionManager,
      sessionReset: false,
    })
    mocks.resolveModelSelection.mockReturnValue(
      selectionModel ? { model: selectionModel } : {}
    )
    mocks.createAgentSessionFromServices.mockResolvedValue({
      session: fresh.session,
    })
    mocks.createAgentSessionRuntime.mockImplementation(
      async (factory: (args: Record<string, unknown>) => Promise<unknown>) => {
        await factory({ sessionManager: runtimeSessionManager })
        return fresh
      }
    )
    await createPiRuntime(context(), { userId: "user-a" }, undefined)
    return mocks.createAgentSessionFromServices.mock.calls.at(-1)?.[0] as
      { model?: unknown } | undefined
  }

  beforeEach(() => {
    mocks.activeRecords.clear()
    mocks.createAgentSessionFromServices.mockReset()
    mocks.createAgentSessionRuntime.mockReset()
    mocks.resolveServerDefaultChatModel.mockReset()
    mocks.resolveServerDefaultChatModel.mockResolvedValue(configured)
    mocks.getSessionDir.mockReturnValue("/repo/.fleet/sessions")
    mocks.resolveDaytonaRuntimeApiKey.mockResolvedValue(undefined)
    mocks.isDaytonaEnabled.mockReturnValue(false)
  })

  it("resolves the server default when a new session arrives without a model", async () => {
    const params = await runFactory({ messages: [], model: null })
    expect(mocks.resolveServerDefaultChatModel).toHaveBeenCalledWith(
      expect.objectContaining({ marker: "request" }),
      "user-a"
    )
    expect(params?.model).toBe(configured)
  })

  it("keeps the client selection when one is sent", async () => {
    const picked = { provider: "google", id: "gemini" }
    const params = await runFactory({ messages: [], model: null }, picked)
    expect(mocks.resolveServerDefaultChatModel).not.toHaveBeenCalled()
    expect(params?.model).toBe(picked)
  })

  it("surfaces a clear error when no model is available", async () => {
    mocks.resolveServerDefaultChatModel.mockRejectedValue(
      new Error("No chat model is available")
    )
    await expect(runFactory({ messages: [], model: null })).rejects.toThrow(
      "No chat model is available"
    )
    expect(mocks.createAgentSessionFromServices).not.toHaveBeenCalled()
  })
})
