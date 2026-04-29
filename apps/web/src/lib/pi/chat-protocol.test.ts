import { describe, expect, it } from "vitest"
import type { ChatPlanAction, ChatRequest } from "./chat-protocol"

describe("chat-protocol types", () => {
  it("accepts a valid agent mode request", () => {
    const req: ChatRequest = {
      message: "Hello",
      mode: "agent",
    }
    expect(req.mode).toBe("agent")
    expect(req.message).toBe("Hello")
  })

  it("accepts a valid plan mode request", () => {
    const req: ChatRequest = {
      message: "Plan this",
      mode: "plan",
      planAction: "execute",
    }
    expect(req.mode).toBe("plan")
    expect(req.planAction).toBe("execute")
  })

  it("accepts session metadata", () => {
    const req: ChatRequest = {
      sessionFile: "/tmp/session.json",
      sessionId: "abc-123",
    }
    expect(req.sessionFile).toBe("/tmp/session.json")
    expect(req.sessionId).toBe("abc-123")
  })
})
