/**
 * Event contract for the Pi harness.
 *
 * Runs a real Pi `AgentSession` (in-memory session + settings, faux streaming
 * provider from `@earendil-works/pi-ai`) through `handleChatTurn` and asserts
 * the exact NDJSON lines the browser receives. Only fleet-side persistence and
 * plan mode are mocked; Pi itself is not.
 *
 * This is the safety net for the Pi 0.82 -> 1.x upgrade: the same sequences
 * must hold after the bump unless a change is intentional.
 *
 * Some sequences pin today's buggy behaviour; those are marked TODO(PR 3:
 * abort semantics) and should be updated in that PR, not "fixed" here.
 */
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ModelRuntime,
  SessionManager,
  SettingsManager,
  createAgentSession,
} from "@earendil-works/pi-coding-agent"
import {
  createFauxCore,
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
} from "@earendil-works/pi-ai"
import { Type } from "typebox"
import type { FauxResponseStep } from "@earendil-works/pi-ai"
import type {
  AgentSession,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent"
import type { RunProvenanceRecorder } from "@/lib/pi/run-provenance"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import type {
  ChatRequest,
  ChatStreamEvent,
} from "@workspace/pi-protocol/chat-protocol"
import { encodeEvent } from "@/lib/pi/server-shared"

const { createPiRuntime } = vi.hoisted(() => ({ createPiRuntime: vi.fn() }))

vi.mock("@/lib/pi/server", () => ({
  createPiRuntime,
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  retainPiRuntime: () => () => {},
}))

vi.mock("@/lib/pi/plan-mode", () => ({
  createPlanEvent: vi.fn(),
  finalizePlanTurn: () => undefined,
  getPlanState: () => ({ executing: false, pendingDecision: false, todos: [] }),
}))

vi.mock("@/lib/db/pi-session-mirror", () => ({
  syncPiSessionMirrorSafely: vi.fn(),
}))

vi.mock("@/lib/pi/server-sessions", () => ({
  scheduleSessionBlobPersist: vi.fn(),
}))

const PROVIDER = "faux"
const MODEL_ID = "contract-model"

const echoTool = {
  name: "echo",
  label: "echo",
  description: "Echo the value back",
  parameters: Type.Object({ v: Type.String() }),
  execute: (_toolCallId: string, params: { v: string }) =>
    Promise.resolve({
      content: [{ type: "text" as const, text: `echo:${params.v}` }],
      details: {},
    }),
} as unknown as ToolDefinition

const sessions: Array<AgentSession> = []

afterEach(() => {
  for (const session of sessions.splice(0)) session.dispose()
  createPiRuntime.mockReset()
})

async function createSession(
  steps: Array<FauxResponseStep>,
  stream: { tokensPerSecond?: number; tokenSize?: number } = {}
) {
  const tokenSize = stream.tokenSize ?? 10_000
  const faux = createFauxCore({
    api: PROVIDER,
    provider: PROVIDER,
    models: [{ id: MODEL_ID, reasoning: true }],
    tokensPerSecond: stream.tokensPerSecond,
    tokenSize: { min: tokenSize, max: tokenSize },
  })
  faux.setResponses(steps)

  const modelRuntime = await ModelRuntime.create({
    // Pi 1.x reads the credential store on every request, so it must live in
    // a writable (throwaway) directory.
    authPath: join(
      mkdtempSync(join(tmpdir(), "fleet-pi-contract-")),
      "auth.json"
    ),
    modelsPath: null,
  })
  modelRuntime.registerProvider(PROVIDER, {
    api: PROVIDER,
    apiKey: "contract-test",
    baseUrl: "http://faux.invalid",
    streamSimple: faux.streamSimple,
    models: [
      {
        id: MODEL_ID,
        name: MODEL_ID,
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 100_000,
        maxTokens: 1_000,
      },
    ],
  })

  const { session } = await createAgentSession({
    cwd: "/tmp",
    agentDir: "/tmp/fleet-pi-contract-agent",
    model: modelRuntime.getModel(PROVIDER, MODEL_ID),
    modelRuntime,
    thinkingLevel: "low",
    sessionManager: SessionManager.inMemory("/tmp"),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: true, keepRecentTokens: 1, reserveTokens: 1 },
      retry: { enabled: true, maxRetries: 2, baseDelayMs: 1 },
    }),
    tools: ["echo"],
    customTools: [echoTool],
  })
  sessions.push(session)
  createPiRuntime.mockResolvedValue({
    runtime: { session },
    diagnostics: [],
    sessionReset: false,
  })
  return session
}

/** Runs one chat turn and returns the NDJSON lines, normalized. */
async function runTurn(
  options: {
    signal?: AbortSignal
    onEvent?: (event: ChatStreamEvent) => void
  } = {}
) {
  const { handleChatTurn } = await import("@/lib/pi/handle-chat-turn")
  const decoder = new TextDecoder()
  const lines: Array<string> = []
  for await (const event of handleChatTurn({
    body: { message: "hi" } satisfies Partial<ChatRequest>,
    signal: options.signal ?? new AbortController().signal,
    recorder: { record() {} } as unknown as RunProvenanceRecorder,
    runtimeContext: { projectRoot: "/tmp" } as AppRuntimeContext,
  })) {
    lines.push(decoder.decode(encodeEvent(event)))
    options.onEvent?.(event)
  }
  return normalize(lines)
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

/** Parses NDJSON, replaces UUIDs with stable placeholders and drops timestamps. */
function normalize(lines: Array<string>) {
  const ids = new Map<string, string>()
  return lines.map((line) => {
    expect(line.endsWith("\n")).toBe(true)
    const stable = line.replace(UUID, (uuid) => {
      if (!ids.has(uuid)) ids.set(uuid, `<id${ids.size + 1}>`)
      return ids.get(uuid)!
    })
    return JSON.parse(stable, (key, value) =>
      key === "createdAt" ? "<ts>" : value
    ) as Record<string, unknown>
  })
}

const state = (name: string) => ({ type: "state", state: { name } })
const userMessage = [state("message_start"), state("message_end")]
// Pi 1.x (canonical session context, 0.87+) records the system prompt as a
// `role: "system"` transcript message at the start of a run, which surfaces
// as one extra message_start/message_end pair before the user message.
const systemMessage = [state("message_start"), state("message_end")]
const start = (id: string, session: string) => ({
  type: "start",
  id,
  runId: id,
  sessionId: session,
  sessionReset: false,
  diagnostics: [],
})
const done = (
  id: string,
  session: string,
  parts: Array<unknown>,
  stopReason?: "aborted" | "error"
) => ({
  type: "done",
  runId: id,
  message: { id, role: "assistant", createdAt: "<ts>", parts },
  sessionId: session,
  sessionReset: false,
  ...(stopReason && { stopReason }),
})
// Empty terminal turns (abort before content, error without content).
const emptyParts = [{ type: "text", text: "" }]

describe("chat event contract (real Pi AgentSession -> NDJSON)", () => {
  it("streams thinking, text, tool calls and done", async () => {
    await createSession([
      fauxAssistantMessage(
        [
          fauxThinking("plan"),
          fauxText("a"),
          fauxToolCall("echo", { v: "x" }, { id: "call-1" }),
        ],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage("b"),
    ])

    const toolInput = {
      type: "tool-echo",
      toolCallId: "call-1",
      state: "input-available",
      input: { v: "x" },
    }
    const toolOutput = {
      ...toolInput,
      state: "output-available",
      output: { content: "echo:x", details: {} },
    }

    expect(await runTurn()).toEqual([
      start("<id1>", "<id2>"),
      state("agent_start"),
      state("turn_start"),
      ...systemMessage,
      ...userMessage,
      state("message_start"),
      { type: "thinking", text: "plan" },
      { type: "delta", text: "a" },
      state("message_end"),
      { type: "tool", part: toolInput },
      { type: "tool", part: toolOutput },
      // tool result message
      state("message_start"),
      state("message_end"),
      state("turn_end"),
      state("turn_start"),
      state("message_start"),
      { type: "delta", text: "b" },
      state("message_end"),
      state("turn_end"),
      state("agent_end"),
      state("agent_settled"),
      done("<id1>", "<id2>", [
        {
          type: "tool-Thinking",
          toolCallId: "<id1>-thinking-0",
          state: "output-available",
          input: { thought: "plan" },
          output: "plan",
        },
        toolOutput,
        { type: "text", text: "ab" },
      ]),
    ])
  })

  it("surfaces a provider error", async () => {
    await createSession([
      fauxAssistantMessage([], { stopReason: "error", errorMessage: "boom" }),
    ])

    expect(await runTurn()).toEqual([
      start("<id1>", "<id2>"),
      state("agent_start"),
      state("turn_start"),
      ...systemMessage,
      ...userMessage,
      state("message_start"),
      state("message_end"),
      state("turn_end"),
      state("agent_end"),
      // The error is held until the run settles (no retry/compaction took
      // it), then the turn ends with a terminal `done`.
      { type: "error", message: "boom", runId: "<id1>" },
      state("agent_settled"),
      done("<id1>", "<id2>", emptyParts, "error"),
    ])
  })

  it("auto-retries a retryable error and then completes", async () => {
    await createSession([
      fauxAssistantMessage([], {
        stopReason: "error",
        errorMessage: "rate limit",
      }),
      fauxAssistantMessage("ok"),
    ])

    expect(await runTurn()).toEqual([
      start("<id1>", "<id2>"),
      state("agent_start"),
      state("turn_start"),
      ...systemMessage,
      ...userMessage,
      state("message_start"),
      state("message_end"),
      // A recovered retry never surfaces as `error`: only `retry` frames.
      state("turn_end"),
      state("agent_end"),
      {
        type: "retry",
        phase: "start",
        attempt: 1,
        maxAttempts: 2,
        delayMs: 1,
        errorMessage: "rate limit",
      },
      state("agent_start"),
      state("turn_start"),
      state("message_start"),
      { type: "delta", text: "ok" },
      state("message_end"),
      { type: "retry", phase: "end", success: true, attempt: 1 },
      state("turn_end"),
      state("agent_end"),
      state("agent_settled"),
      done("<id1>", "<id2>", [{ type: "text", text: "ok" }]),
    ])
  })

  it("compacts on context overflow and retries", async () => {
    const session = await createSession([
      fauxAssistantMessage("earlier answer"),
      fauxAssistantMessage([], {
        stopReason: "error",
        errorMessage: "prompt is too long",
      }),
      fauxAssistantMessage("summary"),
      // Pi 1.x also summarizes the split turn prefix: a second summary call.
      fauxAssistantMessage("turn prefix summary"),
      fauxAssistantMessage("ok"),
    ])
    // Seed history so there is something to compact.
    await session.prompt("earlier question")

    expect(await runTurn()).toEqual([
      start("<id1>", "<id2>"),
      state("agent_start"),
      state("turn_start"),
      // The system prompt was already recorded by the seeding prompt.
      ...userMessage,
      state("message_start"),
      state("message_end"),
      // Overflow recovered by compaction: no `error` frame.
      state("turn_end"),
      state("agent_end"),
      { type: "compaction", phase: "start", reason: "overflow" },
      {
        type: "compaction",
        phase: "end",
        reason: "overflow",
        aborted: false,
        willRetry: true,
      },
      state("agent_start"),
      state("turn_start"),
      state("message_start"),
      { type: "delta", text: "ok" },
      state("message_end"),
      state("turn_end"),
      state("agent_end"),
      state("agent_settled"),
      done("<id1>", "<id2>", [{ type: "text", text: "ok" }]),
    ])
  })

  it("emits queue updates and finalizes each follow-up turn", async () => {
    const holder: { session?: AgentSession } = {}
    holder.session = await createSession([
      async () => {
        await holder.session!.followUp("second")
        return fauxAssistantMessage("first")
      },
      fauxAssistantMessage("reply2"),
    ])

    expect(await runTurn()).toEqual([
      start("<id1>", "<id2>"),
      state("agent_start"),
      state("turn_start"),
      ...systemMessage,
      ...userMessage,
      { type: "queue", steering: [], followUp: ["second"] },
      state("message_start"),
      { type: "delta", text: "first" },
      state("message_end"),
      state("turn_end"),
      state("turn_start"),
      { type: "queue", steering: [], followUp: [] },
      done("<id1>", "<id2>", [{ type: "text", text: "first" }]),
      { type: "start", id: "<id3>", runId: "<id3>", sessionId: "<id2>" },
      ...userMessage,
      state("message_start"),
      { type: "delta", text: "reply2" },
      state("message_end"),
      state("turn_end"),
      state("agent_end"),
      state("agent_settled"),
      done("<id3>", "<id2>", [{ type: "text", text: "reply2" }]),
    ])
  })

  it("abort before any content", async () => {
    const controller = new AbortController()
    await createSession([
      () => {
        controller.abort()
        return fauxAssistantMessage("never streamed")
      },
    ])

    // Abort before content: `start` plus a terminal `done` marked aborted.
    expect(await runTurn({ signal: controller.signal })).toEqual([
      start("<id1>", "<id2>"),
      state("agent_start"),
      state("turn_start"),
      ...systemMessage,
      ...userMessage,
      state("message_start"),
      state("message_end"),
      state("turn_end"),
      state("agent_end"),
      state("agent_settled"),
      done("<id1>", "<id2>", emptyParts, "aborted"),
    ])
  })

  it("abort after content", async () => {
    const controller = new AbortController()
    await createSession(
      [fauxAssistantMessage("one two three four five six seven eight")],
      { tokensPerSecond: 20, tokenSize: 1 }
    )

    const events = await runTurn({
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === "delta") controller.abort()
      },
    })

    // Abort after content: `done` keeps the streamed content and is marked
    // aborted (from agent_settled.aborted / stopReason "aborted").
    expect(events).toEqual([
      start("<id1>", "<id2>"),
      state("agent_start"),
      state("turn_start"),
      ...systemMessage,
      ...userMessage,
      state("message_start"),
      { type: "delta", text: "one " },
      state("message_end"),
      state("turn_end"),
      state("agent_end"),
      state("agent_settled"),
      done("<id1>", "<id2>", [{ type: "text", text: "one " }], "aborted"),
    ])
  })
})
