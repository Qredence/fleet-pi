import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ChatStreamEvent } from "@workspace/pi-protocol/chat-protocol"

const createPiRuntime = vi.fn()
const retainPiRuntime = vi.fn(() => () => {})
const getErrorMessage = vi.fn((error: unknown) =>
  error instanceof Error ? error.message : String(error)
)

vi.mock("@/lib/pi/server", () => ({
  createPiRuntime,
  getErrorMessage,
  retainPiRuntime,
}))

vi.mock("@/lib/pi/server-chat-stream", () => ({
  beginAssistantTurn: vi.fn(() => ({
    runId: "run-error-1",
    assistantId: "assistant-error-1",
    hadError: false,
  })),
  completeAssistantTurn: vi.fn(),
  createTurnStartContext: vi.fn(() => ({
    firstStartPending: true,
    send: vi.fn(),
    session: {},
    sessionReset: false,
    diagnostics: [],
    pendingEvents: [],
  })),
  finalizeAssistantTurn: vi.fn(),
  handleSessionEvent: vi.fn(),
  shouldEmitInitialPlanEvent: vi.fn(() => false),
}))

vi.mock("@/lib/pi/plan-mode", () => ({
  createPlanEvent: vi.fn(),
  getPlanState: vi.fn(() => undefined),
}))

vi.mock("@/lib/db/pi-session-mirror", () => ({
  syncPiSessionMirrorSafely: vi.fn(),
}))

vi.mock("@/lib/pi/server-sessions", () => ({
  scheduleSessionBlobPersist: vi.fn(),
}))

vi.mock("@/lib/app-runtime", () => ({
  resolveAppRuntimeContext: vi.fn(() => ({
    projectRoot: "/tmp/test-project",
  })),
}))

vi.mock("@/lib/pii/sanitizer", () => ({
  sanitizePii: vi.fn((input: string) => input),
}))

const mockLogs: Array<Record<string, unknown>> = []

vi.mock("@/lib/logger", () => ({
  createRequestLogger: vi.fn((requestId: string) => {
    const makeEntry =
      (level: string) => (fieldsOrMsg: unknown, msg?: string) => {
        const entry =
          typeof fieldsOrMsg === "string"
            ? { level, requestId, msg: fieldsOrMsg }
            : { level, requestId, ...(fieldsOrMsg as object), msg }
        mockLogs.push(entry)
      }
    return {
      info: makeEntry("info"),
      error: makeEntry("error"),
      warn: makeEntry("warn"),
      debug: makeEntry("debug"),
    }
  }),
}))

describe("handleChatTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogs.length = 0
  })

  afterEach(() => {
    vi.resetModules()
  })

  function makeRecorder() {
    const events: Array<ChatStreamEvent> = []
    return {
      record: vi.fn((event: ChatStreamEvent) => events.push(event)),
      close: vi.fn(),
      events,
    }
  }

  it("throws 'Missing message' when prompt is empty and logs rejection", async () => {
    const { handleChatTurn } = await import("./handle-chat-turn")
    const recorder = makeRecorder()
    const requestId = "req-missing-msg-1"

    const generator = handleChatTurn({
      body: { message: "" },
      signal: new AbortController().signal,
      recorder: recorder,
      prompt: "",
      requestId,
    })

    await expect(async () => {
      for await (const event of generator) {
        void event // drain
      }
    }).rejects.toThrow("Missing message")

    const rejectLog = mockLogs.find((l) => l.msg === "prompt rejected")
    expect(rejectLog).toBeDefined()
    expect(rejectLog!.requestId).toBe(requestId)
    expect(rejectLog!.level).toBe("warn")
    expect(rejectLog!.reason).toBe("missing message")
  })

  it("emits error event when runtime creation fails", async () => {
    createPiRuntime.mockRejectedValueOnce(new Error("Runtime boot failed"))

    const { handleChatTurn } = await import("./handle-chat-turn")
    const recorder = makeRecorder()
    const requestId = "req-test-123"

    const events: Array<ChatStreamEvent> = []
    const generator = handleChatTurn({
      body: { message: "hello", sessionId: "sess-1" },
      signal: new AbortController().signal,
      recorder: recorder,
      prompt: "hello",
      requestId,
    })

    for await (const event of generator) {
      events.push(event)
    }

    const errorEvent = events.find((e) => e.type === "error")
    expect(errorEvent).toBeDefined()
    expect(errorEvent).toMatchObject({
      type: "error",
      message: "Runtime boot failed",
    })
  })

  it("does not emit error event when signal is already aborted", async () => {
    createPiRuntime.mockRejectedValueOnce(new Error("Aborted runtime"))

    const { handleChatTurn } = await import("./handle-chat-turn")
    const recorder = makeRecorder()
    const controller = new AbortController()
    controller.abort()

    const events: Array<ChatStreamEvent> = []
    const generator = handleChatTurn({
      body: { message: "hello" },
      signal: controller.signal,
      recorder: recorder,
      prompt: "hello",
      requestId: "req-aborted-1",
    })

    for await (const event of generator) {
      events.push(event)
    }

    const errorEvent = events.find((e) => e.type === "error")
    expect(errorEvent).toBeUndefined()
  })

  it("logs lifecycle start, error, and teardown with requestId correlation", async () => {
    createPiRuntime.mockRejectedValueOnce(new Error("Provider unavailable"))

    const { handleChatTurn } = await import("./handle-chat-turn")
    const recorder = makeRecorder()
    const requestId = "req-log-check-42"

    const events: Array<ChatStreamEvent> = []
    const generator = handleChatTurn({
      body: { message: "test", sessionId: "sess-log", mode: "agent" } as any,
      signal: new AbortController().signal,
      recorder: recorder,
      prompt: "test",
      requestId,
    })

    for await (const event of generator) {
      events.push(event)
    }

    // Lifecycle start log
    const startLog = mockLogs.find((l) => l.msg === "chat turn lifecycle start")
    expect(startLog).toBeDefined()
    expect(startLog!.requestId).toBe(requestId)
    expect(startLog!.level).toBe("info")
    expect(startLog!.sessionId).toBe("sess-log")
    expect(startLog!.mode).toBe("agent")

    // Error log
    const errorLog = mockLogs.find((l) => l.msg === "chat turn error")
    expect(errorLog).toBeDefined()
    expect(errorLog!.requestId).toBe(requestId)
    expect(errorLog!.level).toBe("error")
    expect(errorLog!.error).toBe("Provider unavailable")

    // Teardown log includes aborted context
    const teardownLog = mockLogs.find(
      (l) => l.msg === "chat turn teardown complete"
    )
    expect(teardownLog).toBeDefined()
    expect(teardownLog!.requestId).toBe(requestId)
    expect(teardownLog!.level).toBe("info")
    expect(teardownLog!.aborted).toBe(false)
  })

  it("emits error without runId when runtime creation fails before turnStartContext", async () => {
    createPiRuntime.mockRejectedValueOnce(new Error("Session corrupt"))

    const { handleChatTurn } = await import("./handle-chat-turn")
    const recorder = makeRecorder()

    const events: Array<ChatStreamEvent> = []
    const generator = handleChatTurn({
      body: { message: "hi", sessionId: "sess-2" },
      signal: new AbortController().signal,
      recorder: recorder,
      prompt: "hi",
      requestId: "req-runid-1",
    })

    for await (const event of generator) {
      events.push(event)
    }

    const errorEvent = events.find((e) => e.type === "error")
    expect(errorEvent).toBeDefined()
    expect(errorEvent).toMatchObject({
      type: "error",
      message: "Session corrupt",
    })
    // turnStartContext is never assigned when createPiRuntime fails,
    // so the error is emitted without a runId
    expect((errorEvent as any).runId).toBeUndefined()
  })
})
