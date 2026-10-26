import { describe, expect, it } from "vitest"
import {
  conversationIdFromDurableSession,
  durableSessionId,
  isDurableSessionId,
  isLegacyChatSession,
} from "../durable-session"
import { projectDurableTurn } from "../durable-projection"

describe("hosted session routing", () => {
  it("treats JSONL ids as legacy and durable ids as hosted conversations", () => {
    expect(isLegacyChatSession({ sessionFile: "/tmp/session.jsonl" })).toBe(
      true
    )
    expect(isLegacyChatSession({ sessionId: "jsonl-id" })).toBe(true)
    expect(isLegacyChatSession({})).toBe(false)
    expect(isDurableSessionId(durableSessionId("12"))).toBe(true)
    expect(conversationIdFromDurableSession(durableSessionId("12"))).toBe("12")
    expect(isLegacyChatSession({ sessionId: durableSessionId("12") })).toBe(
      false
    )
  })

  it("does not fail the turn when a projection throws", async () => {
    await expect(
      projectDurableTurn(async () => {
        throw new Error("neon down")
      })
    ).resolves.toBeUndefined()
  })
})
