import { describe, expect, it } from "vitest"
import {
  assistantMessageFromDiff,
  createDurableViewDiff,
  eventsFromConversationView,
  messagesFromEntries,
} from "../durable-events"

describe("durable conversation events", () => {
  it("maps new assistant text and a write tool onto existing NDJSON parts", () => {
    const diff = createDurableViewDiff()
    eventsFromConversationView(
      {
        entries: [
          {
            id: 1,
            model: [{ role: "user", content: "write a note" }],
          },
        ],
      },
      diff
    )

    const events = eventsFromConversationView(
      {
        entries: [
          {
            id: 1,
            model: [{ role: "user", content: "write a note" }],
          },
          {
            id: 2,
            model: [
              {
                role: "assistant",
                content: [
                  { type: "text", text: "Wrote it." },
                  {
                    type: "toolCall",
                    id: "call-1",
                    name: "write",
                    arguments: { path: "note.txt", content: "hello" },
                  },
                ],
              },
              {
                role: "toolResult",
                toolCallId: "call-1",
                toolName: "write",
                content: [{ type: "text", text: "ok" }],
                isError: false,
              },
            ],
          },
        ],
      },
      diff
    )

    expect(events.map((event) => event.type)).toEqual(["delta", "tool", "tool"])
    expect(events[0]).toMatchObject({ type: "delta", text: "Wrote it." })
    expect(events[1]).toMatchObject({
      type: "tool",
      part: {
        type: "tool-Write",
        toolCallId: "call-1",
        state: "input-available",
      },
    })
    expect(events[2]).toMatchObject({
      type: "tool",
      part: { type: "tool-Write", state: "output-available", output: "ok" },
    })

    const message = assistantMessageFromDiff(diff, "message-1")
    expect(
      message.parts.some((part: { type: string }) => part.type === "tool-Write")
    ).toBe(true)
    expect(
      message.parts.some((part: { type: string }) => part.type === "text")
    ).toBe(true)
  })

  it("builds readable messages from committed entries", () => {
    const messages = messagesFromEntries([
      { id: 1, model: [{ role: "user", content: "hello" }] },
      {
        id: 2,
        model: [
          {
            role: "assistant",
            content: [{ type: "text", text: "hi" }],
          },
        ],
      },
    ])
    expect(messages).toEqual([
      { id: "user-1", role: "user", parts: [{ type: "text", text: "hello" }] },
      {
        id: "assistant-2",
        role: "assistant",
        parts: [{ type: "text", text: "hi" }],
      },
    ])
  })

  it("keeps willRetry visible and labels an aborted compaction separately", () => {
    const diff = createDurableViewDiff()
    const retrying = eventsFromConversationView(
      {
        entries: [],
        docs: {
          "pi.live": {
            compactions: [
              {
                reason: "context",
                retry: { error: "summarizer timed out" },
              },
            ],
          },
        },
      },
      diff
    )
    expect(retrying).toEqual([
      {
        type: "compaction",
        phase: "end",
        reason: "context",
        aborted: false,
        willRetry: true,
        errorMessage: "summarizer timed out",
      },
    ])
    const aborted = eventsFromConversationView(
      {
        entries: [],
        docs: {
          "pi.live": {
            compactionFailure: { reason: "context", error: "aborted" },
          },
        },
      },
      diff
    )
    expect(aborted[0]).toMatchObject({
      type: "compaction",
      aborted: true,
      willRetry: false,
    })
  })
})
