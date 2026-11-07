import { describe, expect, it } from "vitest"

import {
  conversationIdFromDurableSession,
  durableSessionId,
  isDurableSessionId,
  isLegacyChatSession,
} from "../durable-session"

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
})
