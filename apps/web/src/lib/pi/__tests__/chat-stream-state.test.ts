import { describe, expect, it } from "vitest"
import { EMPTY_QUEUE_STATE, applyChatStreamEvent } from "../chat-stream-state"
import type { ChatStreamTransition } from "../chat-stream-state"

describe("chat stream state", () => {
  it("applies streamed events through a single snapshot reducer", () => {
    let transition: ChatStreamTransition = {
      assistantId: null as string | null,
      snapshot: {
        messages: [],
        queue: EMPTY_QUEUE_STATE,
        sessionMetadata: {},
      },
    }

    transition = applyChatStreamEvent(transition, {
      type: "start",
      id: "assistant-1",
      runId: "assistant-1",
      sessionId: "session-1",
      sessionFile: ".fleet/sessions/session-1.jsonl",
      diagnostics: ["Using persisted Pi session"],
    })

    expect(transition.assistantId).toBe("assistant-1")
    expect(transition.snapshot.activityLabel).toBe("Using persisted Pi session")
    expect(transition.snapshot.sessionMetadata).toEqual({
      sessionFile: ".fleet/sessions/session-1.jsonl",
      sessionId: "session-1",
    })

    transition = applyChatStreamEvent(transition, {
      type: "thinking",
      text: "Inspecting README",
    })
    transition = applyChatStreamEvent(transition, {
      type: "tool",
      part: {
        type: "tool-Read",
        toolCallId: "tool-1",
        state: "input-available",
        input: {
          path: "README.md",
          file_path: "README.md",
        },
      },
    })
    transition = applyChatStreamEvent(transition, {
      type: "delta",
      text: "Fleet Pi overview",
    })
    transition = applyChatStreamEvent(transition, {
      type: "queue",
      steering: ["Wait for current turn"],
      followUp: ["Summarize risks"],
    })
    transition = applyChatStreamEvent(transition, {
      type: "state",
      state: { name: "message_start" },
    })

    expect(transition.snapshot.activityLabel).toBe("Receiving response")
    expect(transition.snapshot.queue).toEqual({
      steering: ["Wait for current turn"],
      followUp: ["Summarize risks"],
    })
    expect(transition.snapshot.messages[0]?.parts).toEqual([
      {
        type: "tool-Thinking",
        toolCallId: "assistant-1-thinking-0",
        state: "input-streaming",
        input: { thought: "Inspecting README" },
        output: "Inspecting README",
      },
      {
        type: "tool-Read",
        toolCallId: "tool-1",
        state: "input-available",
        input: {
          path: "README.md",
          file_path: "README.md",
        },
      },
      {
        type: "text",
        text: "Fleet Pi overview",
      },
    ])

    transition = applyChatStreamEvent(transition, {
      type: "done",
      runId: "assistant-1",
      message: {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "Fleet Pi overview" }],
      },
      sessionId: "session-1",
      sessionFile: ".fleet/sessions/session-1.jsonl",
    })

    expect(transition.assistantId).toBeNull()
    expect(transition.snapshot.activityLabel).toBeUndefined()
    expect(transition.snapshot.queue).toEqual(EMPTY_QUEUE_STATE)
    expect(transition.snapshot.messages).toEqual([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "Fleet Pi overview" }],
      },
    ])
  })

  it("labels an aborted done as Stopped and keeps a finished tool", () => {
    const finished = applyChatStreamEvent(streamingTurn(), {
      type: "done",
      runId: "assistant-1",
      stopReason: "aborted",
      message: {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-Read",
            toolCallId: "tool-1",
            state: "output-available",
            output: "notes",
          },
          {
            type: "tool-Bash",
            toolCallId: "tool-2",
            state: "input-available",
          },
        ],
      },
      sessionId: "session-1",
    })

    expect(finished.snapshot.activityLabel).toBe("Stopped")
    expect(finished.snapshot.messages[0]?.parts).toEqual([
      {
        type: "tool-Read",
        toolCallId: "tool-1",
        state: "output-available",
        output: "notes",
      },
      {
        type: "tool-Bash",
        toolCallId: "tool-2",
        state: "input-available",
      },
    ])
  })

  it("clears the activity label when a turn finishes", () => {
    const finished = applyChatStreamEvent(
      {
        ...streamingTurn(),
        snapshot: {
          ...streamingTurn().snapshot,
          activityLabel: "Compaction will retry",
        },
      },
      {
        type: "done",
        runId: "assistant-1",
        message: {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "Done" }],
        },
        sessionId: "session-1",
      }
    )

    expect(finished.snapshot.activityLabel).toBeUndefined()
  })

  it("keeps a will-retry compaction label until the next compaction event", () => {
    const started = applyChatStreamEvent(streamingTurn(), {
      type: "compaction",
      phase: "start",
      reason: "context",
    })
    expect(started.snapshot.activityLabel).toBe("Compacting session")

    const retrying = applyChatStreamEvent(streamingTurn(), {
      type: "compaction",
      phase: "end",
      reason: "context",
      aborted: false,
      willRetry: true,
      errorMessage: "context length",
    })
    expect(retrying.snapshot.activityLabel).toBe("Compaction will retry")

    const aborted = applyChatStreamEvent(retrying, {
      type: "compaction",
      phase: "end",
      reason: "context",
      aborted: true,
      willRetry: false,
      errorMessage: "aborted",
    })
    expect(aborted.snapshot.activityLabel).toBe("Compaction aborted")

    const failed = applyChatStreamEvent(streamingTurn(), {
      type: "compaction",
      phase: "end",
      reason: "context",
      aborted: false,
      willRetry: false,
      errorMessage: "model failed",
    })
    expect(failed.snapshot.activityLabel).toBe("Compaction failed")
  })
})

function streamingTurn(): ChatStreamTransition {
  return {
    assistantId: "assistant-1",
    snapshot: {
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "" }],
        },
      ],
      queue: EMPTY_QUEUE_STATE,
      sessionMetadata: { sessionId: "session-1" },
    },
  }
}
