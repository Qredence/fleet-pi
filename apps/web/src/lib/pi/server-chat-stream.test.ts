import { afterEach, describe, expect, it, vi } from "vitest"
import {
  completeAssistantTurn,
  createTurnStartContext,
  handleSessionEvent,
} from "./server-chat-stream"
import type { ChatStreamEvent } from "./chat-protocol"

describe("server chat stream", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("emits start before buffered state events on the first assistant content", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-0000-0000-000000000001"
    )

    const emitted: Array<ChatStreamEvent> = []
    const startContext = createTurnStartContext({
      diagnostics: ["Using persisted Pi session"],
      send: (event) => emitted.push(event),
      session: {
        sessionFile: ".fleet/sessions/session-1.jsonl",
        sessionId: "session-1",
      } as any,
      sessionReset: false,
    })

    let activeTurn
    activeTurn = handleSessionEvent(
      { type: "agent_start" } as any,
      activeTurn,
      startContext
    )
    activeTurn = handleSessionEvent(
      { type: "turn_start" } as any,
      activeTurn,
      startContext
    )
    activeTurn = handleSessionEvent(
      { type: "message_start" } as any,
      activeTurn,
      startContext
    )

    expect(emitted).toEqual([])

    activeTurn = handleSessionEvent(
      {
        type: "message_update",
        assistantMessageEvent: {
          type: "thinking_delta",
          delta: "Inspecting README",
        },
      } as any,
      activeTurn,
      startContext
    )

    expect(emitted.map((event) => event.type)).toEqual([
      "start",
      "state",
      "state",
      "state",
      "thinking",
    ])
    expect(emitted[0]).toMatchObject({
      type: "start",
      id: "00000000-0000-0000-0000-000000000001",
      runId: "00000000-0000-0000-0000-000000000001",
      sessionFile: ".fleet/sessions/session-1.jsonl",
      sessionId: "session-1",
      diagnostics: ["Using persisted Pi session"],
    })
    expect(emitted.slice(1, 4)).toEqual([
      { type: "state", state: { name: "agent_start" } },
      { type: "state", state: { name: "turn_start" } },
      { type: "state", state: { name: "message_start" } },
    ])
    expect(emitted[4]).toEqual({
      type: "thinking",
      text: "Inspecting README",
    })
  })

  it("emits start before a question tool after buffered plan-mode state events", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-0000-0000-000000000002"
    )

    const emitted: Array<ChatStreamEvent> = []
    const startContext = createTurnStartContext({
      diagnostics: ["Plan mode active"],
      send: (event) => emitted.push(event),
      session: {
        sessionFile: ".fleet/sessions/session-2.jsonl",
        sessionId: "session-2",
      } as any,
      sessionReset: false,
    })

    let activeTurn
    activeTurn = handleSessionEvent(
      { type: "agent_start" } as any,
      activeTurn,
      startContext
    )
    activeTurn = handleSessionEvent(
      { type: "turn_start" } as any,
      activeTurn,
      startContext
    )
    activeTurn = handleSessionEvent(
      { type: "message_start" } as any,
      activeTurn,
      startContext
    )

    activeTurn = handleSessionEvent(
      {
        type: "tool_execution_start",
        toolCallId: "tool-question-1",
        toolName: "questionnaire",
        args: {
          questions: [{ id: "scope", prompt: "Which workspace?" }],
        },
      } as any,
      activeTurn,
      startContext
    )

    expect(emitted.map((event) => event.type)).toEqual([
      "start",
      "state",
      "state",
      "state",
      "tool",
    ])
    expect(emitted[0]).toMatchObject({
      type: "start",
      id: "00000000-0000-0000-0000-000000000002",
      runId: "00000000-0000-0000-0000-000000000002",
      sessionId: "session-2",
      diagnostics: ["Plan mode active"],
    })
    expect(emitted[4]).toMatchObject({
      type: "tool",
      part: {
        type: "tool-Question",
        toolCallId: "tool-question-1",
        state: "input-available",
      },
    })
  })

  it("starts a run before emitting an assistant error without prior content", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-0000-0000-000000000003"
    )

    const emitted: Array<ChatStreamEvent> = []
    const startContext = createTurnStartContext({
      diagnostics: ["Recovered persisted session"],
      send: (event) => emitted.push(event),
      session: {
        sessionFile: ".fleet/sessions/session-3.jsonl",
        sessionId: "session-3",
      } as any,
      sessionReset: true,
    })

    let activeTurn
    activeTurn = handleSessionEvent(
      { type: "agent_start" } as any,
      activeTurn,
      startContext
    )
    activeTurn = handleSessionEvent(
      { type: "turn_start" } as any,
      activeTurn,
      startContext
    )
    activeTurn = handleSessionEvent(
      { type: "message_start" } as any,
      activeTurn,
      startContext
    )
    activeTurn = handleSessionEvent(
      {
        type: "message_end",
        message: {
          role: "assistant",
          stopReason: "error",
          errorMessage: "Provider disconnected",
        },
      } as any,
      activeTurn,
      startContext
    )

    expect(emitted.map((event) => event.type)).toEqual([
      "start",
      "state",
      "state",
      "state",
      "state",
      "error",
    ])
    expect(emitted[0]).toMatchObject({
      type: "start",
      runId: "00000000-0000-0000-0000-000000000003",
      sessionReset: true,
    })
    expect(emitted[4]).toEqual({
      type: "state",
      state: { name: "message_end" },
    })
    expect(emitted[5]).toEqual({
      type: "error",
      message: "Provider disconnected",
      runId: "00000000-0000-0000-0000-000000000003",
    })
    expect(activeTurn).toMatchObject({
      hadError: true,
      runId: "00000000-0000-0000-0000-000000000003",
    })
  })

  it("finalizes errored turns that already emitted assistant content", () => {
    const emitted: Array<ChatStreamEvent> = []
    const runtime = {
      session: {
        sessionManager: {
          getBranch: () => [],
        },
      },
    } as any

    const result = completeAssistantTurn({
      activeTurn: {
        assistantId: "assistant-4",
        hadError: true,
        parts: [{ type: "text", text: "Partial answer" }],
        runId: "run-4",
        thinkingText: "",
        toolInputs: new Map(),
      },
      body: {
        message: "hello",
        mode: "agent",
      } as any,
      runtime,
      send: (event) => emitted.push(event),
      session: {
        sessionFile: ".fleet/sessions/session-4.jsonl",
        sessionId: "session-4",
      } as any,
      sessionReset: false,
    })

    expect(result).toBeUndefined()
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({
      type: "done",
      runId: "run-4",
      sessionFile: ".fleet/sessions/session-4.jsonl",
      sessionId: "session-4",
      sessionReset: false,
      message: {
        role: "assistant",
        parts: [{ type: "text", text: "Partial answer" }],
      },
    })
  })
})
