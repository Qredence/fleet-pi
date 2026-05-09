import { describe, expect, it } from "vitest"
import {
  appendAssistantDelta,
  createTextMessage,
  finalizeThinkingToolParts,
  upsertAssistantThinkingPart,
  upsertAssistantToolPart,
} from "./chat-message-helpers"
import { sessionEntriesToChatMessages } from "./server-utils"

describe("chat message helpers", () => {
  it("keeps completed streamed assistant parts aligned with hydration", () => {
    const assistantId = "assistant-1"

    let streamed = [createTextMessage("assistant", "", assistantId)]
    streamed = upsertAssistantThinkingPart(
      streamed,
      assistantId,
      "Inspecting README"
    )
    streamed = upsertAssistantToolPart(streamed, assistantId, {
      type: "tool-Read",
      toolCallId: "tool-1",
      state: "input-available",
      input: { path: "README.md", file_path: "README.md" },
    })
    streamed = appendAssistantDelta(streamed, assistantId, "Fleet Pi overview")
    streamed = upsertAssistantToolPart(streamed, assistantId, {
      type: "tool-Read",
      toolCallId: "tool-1",
      state: "output-available",
      input: { path: "README.md", file_path: "README.md" },
      output: { content: "Fleet Pi", details: {} },
    })

    const streamedMessage = {
      ...streamed[0],
      parts: finalizeThinkingToolParts(streamed[0]?.parts ?? []),
    }

    const hydrated = sessionEntriesToChatMessages([
      {
        type: "message",
        id: assistantId,
        message: {
          role: "assistant",
          timestamp: 1,
          content: [
            { type: "thinking", thinking: "Inspecting README" },
            {
              type: "tool_use",
              id: "tool-1",
              name: "read",
              arguments: { path: "README.md" },
            },
            { type: "text", text: "Fleet Pi overview" },
          ],
        },
      },
      {
        type: "message",
        id: "tool-result-1",
        message: {
          role: "toolResult",
          timestamp: 2,
          toolCallId: "tool-1",
          toolName: "read",
          isError: false,
          content: [{ type: "text", text: "Fleet Pi" }],
        },
      },
    ] as any)

    expect(hydrated).toHaveLength(1)
    expect(streamedMessage.role).toBe("assistant")
    expect(hydrated[0]?.role).toBe("assistant")
    expect(streamedMessage.parts).toEqual(hydrated[0]?.parts)
  })

  it("finalizes streamed thinking parts for completed messages", () => {
    const assistantId = "assistant-2"
    const streamed = upsertAssistantThinkingPart(
      [createTextMessage("assistant", "", assistantId)],
      assistantId,
      "Inspecting contract seam"
    )

    const finalized = finalizeThinkingToolParts(streamed[0]?.parts ?? [])
    expect(finalized).toContainEqual(
      expect.objectContaining({
        type: "tool-Thinking",
        toolCallId: `${assistantId}-thinking-0`,
        state: "output-available",
        input: { thought: "Inspecting contract seam" },
        output: "Inspecting contract seam",
      })
    )
  })
})
