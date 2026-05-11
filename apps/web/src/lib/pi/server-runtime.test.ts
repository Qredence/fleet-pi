import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const createAgentSessionFromServices = vi.fn()
const createAgentSessionRuntime = vi.fn()
const createAgentSessionServices = vi.fn()
const getAgentDir = vi.fn(() => "/tmp/pi-agent")

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
}))

describe("answerChatQuestion", () => {
  let root = ""

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "fleet-pi-server-runtime-"))
    createAgentSessionFromServices.mockReset()
    createAgentSessionRuntime.mockReset()
    createAgentSessionServices.mockReset()
    getAgentDir.mockClear()
  })

  afterEach(() => {
    vi.resetModules()
    rmSync(root, { force: true, recursive: true })
  })

  it("rejects stale plan decision tool call ids", async () => {
    const sessionFile = createSessionFile(root, "session-a.jsonl")
    const { answerChatQuestion, retainPiRuntime } =
      await import("./server-runtime")
    const { applyPlanMode, finalizePlanTurn, getPlanState } =
      await import("./plan-mode")
    const runtime = createMockRuntime("session-a", sessionFile)

    retainPiRuntime(runtime)
    addAssistantMessage(
      runtime,
      "assistant-plan",
      `Plan:\n1. Inspect the runtime\n2. Verify the queue`
    )
    applyPlanMode(runtime, "plan")
    const planTurn = finalizePlanTurn({
      runtime,
      assistantId: "assistant-plan",
      assistantText: `Plan:\n1. Inspect the runtime\n2. Verify the queue`,
      mode: "plan",
    })

    const result = answerChatQuestion({
      sessionId: "session-a",
      toolCallId: "plan-mode-decision-stale",
      answer: { kind: "single", selectedIds: ["execute"] },
    })

    expect(planTurn?.planPart?.toolCallId).toBe(
      "plan-mode-decision-assistant-plan"
    )
    expect(result).toEqual({
      ok: false,
      message: "Plan question is no longer active.",
    })
    expect(getPlanState(runtime).pendingDecision).toBe(true)
  })

  it("accepts the active plan decision token for the same session", async () => {
    const sessionFile = createSessionFile(root, "session-b.jsonl")
    const { answerChatQuestion, retainPiRuntime } =
      await import("./server-runtime")
    const { applyPlanMode, finalizePlanTurn, getPlanState } =
      await import("./plan-mode")
    const runtime = createMockRuntime("session-b", sessionFile)

    retainPiRuntime(runtime)
    addAssistantMessage(
      runtime,
      "assistant-active",
      `Plan:\n1. Confirm the fix`
    )
    applyPlanMode(runtime, "plan")
    const planTurn = finalizePlanTurn({
      runtime,
      assistantId: "assistant-active",
      assistantText: `Plan:\n1. Confirm the fix`,
      mode: "plan",
    })
    const toolCallId = planTurn?.planPart?.toolCallId

    const result = answerChatQuestion({
      sessionId: "session-b",
      toolCallId,
      answer: { kind: "single", selectedIds: ["execute"] },
    })

    expect(toolCallId).toBe("plan-mode-decision-assistant-active")
    expect(result).toMatchObject({
      ok: true,
      mode: "agent",
      planAction: "execute",
    })
    expect(getPlanState(runtime).pendingDecision).toBe(false)
    expect(getPlanState(runtime).executing).toBe(true)
  })

  it("does not reuse a conflicting sessionId when sessionFile points elsewhere", async () => {
    const sessionFile = createSessionFile(root, "session-c.jsonl")
    const conflictingFile = createSessionFile(root, "session-other.jsonl")
    const { answerChatQuestion, retainPiRuntime } =
      await import("./server-runtime")
    const { applyPlanMode, finalizePlanTurn } = await import("./plan-mode")
    const runtime = createMockRuntime("session-c", sessionFile)

    retainPiRuntime(runtime)
    addAssistantMessage(
      runtime,
      "assistant-conflict",
      `Plan:\n1. Keep session safe`
    )
    applyPlanMode(runtime, "plan")
    const planTurn = finalizePlanTurn({
      runtime,
      assistantId: "assistant-conflict",
      assistantText: `Plan:\n1. Keep session safe`,
      mode: "plan",
    })

    const result = answerChatQuestion({
      sessionFile: conflictingFile,
      sessionId: "session-c",
      toolCallId: planTurn?.planPart?.toolCallId,
      answer: { kind: "single", selectedIds: ["execute"] },
    })

    expect(result).toEqual({
      ok: false,
      message:
        "Plan session is no longer active. Send a new message to continue.",
    })
  })

  it("matches queued follow-ups on a fresh session before the session file exists", async () => {
    const sessionFile = join(
      root,
      ".fleet",
      "sessions",
      "pending-session.jsonl"
    )
    const { queuePromptOnActiveSession, retainPiRuntime } =
      await import("./server-runtime")
    const runtime = createMockRuntime("session-queue", sessionFile)
    runtime.session.isStreaming = true

    retainPiRuntime(runtime)

    const queued = await queuePromptOnActiveSession(
      {
        sessionFile,
        sessionId: "session-queue",
      },
      "queued prompt",
      "followUp"
    )

    expect(runtime.session.prompt).toHaveBeenCalledWith("queued prompt", {
      expandPromptTemplates: true,
      streamingBehavior: "followUp",
    })
    expect(queued).toEqual({
      steering: [],
      followUp: [],
    })
  })
})

function createSessionFile(root: string, name: string) {
  const sessionsDir = join(root, ".fleet", "sessions")
  mkdirSync(sessionsDir, { recursive: true })
  const file = join(sessionsDir, name)
  writeFileSync(file, "")
  return file
}

function createMockRuntime(sessionId: string, sessionFile: string) {
  const entries: Array<Record<string, unknown>> = []

  return {
    dispose: vi.fn(() => Promise.resolve()),
    session: {
      getFollowUpMessages: vi.fn(() => []),
      getSteeringMessages: vi.fn(() => []),
      isStreaming: false,
      prompt: vi.fn(() => Promise.resolve()),
      sessionFile,
      sessionId,
      setActiveToolsByName: vi.fn(),
      sessionManager: {
        appendCustomEntry(customType: string, data: unknown) {
          entries.push({
            type: "custom",
            customType,
            data,
          })
        },
        getBranch() {
          return entries
        },
        getEntries() {
          return entries
        },
      },
    },
  } as any
}

function addAssistantMessage(
  runtime: ReturnType<typeof createMockRuntime>,
  messageId: string,
  text: string
) {
  runtime.session.sessionManager.getBranch().push({
    type: "message",
    id: messageId,
    message: {
      role: "assistant",
      timestamp: Date.now(),
      content: [{ type: "text", text }],
    },
  })
}
