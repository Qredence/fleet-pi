import { describe, expect, it } from "vitest"
import {
  conversationIdFromDurableSession,
  durableSessionId,
  isDurableSessionId,
  isLegacyChatSession,
} from "../durable-session"
import { resolveChatApiUrlFromBase } from "../../chat-runtime-url"
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

  it("keeps a new hosted Agent turn on the worker when a function URL is set", () => {
    const base = "https://function.example"
    expect(resolveChatApiUrlFromBase(base, "/api/chat", {})).toBe("/api/chat")
    expect(
      resolveChatApiUrlFromBase(base, "/api/chat", { sessionId: "durable:4" })
    ).toBe("/api/chat")
    expect(
      resolveChatApiUrlFromBase(base, "/api/chat", {
        sessionFile: "/tmp/old.jsonl",
      })
    ).toBe("https://function.example/api/chat")
    expect(resolveChatApiUrlFromBase(base, "/api/chat/sessions")).toBe(
      "/api/chat/sessions"
    )
    expect(resolveChatApiUrlFromBase(base, "/api/chat/settings")).toBe(
      "/api/chat/settings"
    )
    expect(
      resolveChatApiUrlFromBase(base, "/api/chat/session?sessionId=durable:4")
    ).toBe("/api/chat/session?sessionId=durable:4")
    expect(
      resolveChatApiUrlFromBase(base, "/api/chat/session?sessionId=legacy")
    ).toBe("https://function.example/api/chat/session?sessionId=legacy")
    expect(
      resolveChatApiUrlFromBase(base, "/api/chat/abort", {
        sessionId: durableSessionId("4"),
      })
    ).toBe("/api/chat/abort")
    expect(
      resolveChatApiUrlFromBase(base, "/api/chat/abort", {
        sessionFile: "/tmp/old.jsonl",
      })
    ).toBe("https://function.example/api/chat/abort")
  })

  it("does not fail the turn when a projection throws", async () => {
    await expect(
      projectDurableTurn(async () => {
        throw new Error("neon down")
      })
    ).resolves.toBeUndefined()
  })
})
