import { describe, expect, it } from "vitest"

import { createAssistantMessage } from "./message-factories"

describe("createAssistantMessage", () => {
  it("returns a valid ChatMessage", () => {
    const message = createAssistantMessage("agent-chat-error", [
      { type: "error", title: "Request failed", message: "boom" },
    ])

    expect(message.role).toBe("assistant")
    expect(typeof message.id).toBe("string")
    expect(message.id.length).toBeGreaterThan(0)
    expect(message.parts).toEqual([
      { type: "error", title: "Request failed", message: "boom" },
    ])
  })

  it("produces distinct ids for two consecutive calls", () => {
    const first = createAssistantMessage("agent-chat-error", [
      { type: "error", title: "Request failed", message: "first" },
    ])
    const second = createAssistantMessage("agent-chat-error", [
      { type: "error", title: "Request failed", message: "second" },
    ])

    expect(first.id).not.toBe(second.id)
  })
})
