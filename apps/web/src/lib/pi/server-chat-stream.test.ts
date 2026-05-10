import { afterEach, describe, expect, it, vi } from "vitest"
import {
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
})
