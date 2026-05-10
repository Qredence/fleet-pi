import { describe, expect, it } from "vitest"
import {
  applyChatMessageIdMap,
  findLatestUnmappedAssistantMessageId,
  restoreChatMessageIdMap,
} from "./server-utils"

describe("server utils", () => {
  it("applies persisted assistant message id mappings during hydration", () => {
    const mappings = restoreChatMessageIdMap([
      {
        type: "custom",
        customType: "chat-message-id",
        data: {
          sessionMessageId: "assistant-entry",
          chatMessageId: "chat-assistant-1",
        },
      },
    ] as any)

    const hydrated = applyChatMessageIdMap(
      [
        { id: "user-entry", role: "user", parts: [] },
        { id: "assistant-entry", role: "assistant", parts: [] },
      ] as any,
      mappings
    )

    expect(hydrated).toMatchObject([
      { id: "user-entry", role: "user" },
      { id: "chat-assistant-1", role: "assistant" },
    ])
  })

  it("finds the latest unmapped assistant message id", () => {
    const sessionMessageId = findLatestUnmappedAssistantMessageId([
      {
        type: "message",
        id: "assistant-entry-1",
        message: { role: "assistant" },
      },
      {
        type: "custom",
        customType: "chat-message-id",
        data: {
          sessionMessageId: "assistant-entry-1",
          chatMessageId: "chat-assistant-1",
        },
      },
      {
        type: "message",
        id: "assistant-entry-2",
        message: { role: "assistant" },
      },
    ] as any)

    expect(sessionMessageId).toBe("assistant-entry-2")
  })
})
