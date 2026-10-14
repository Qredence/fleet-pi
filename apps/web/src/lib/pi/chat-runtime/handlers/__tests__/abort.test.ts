import { afterEach, describe, expect, it, vi } from "vitest"

import { abortChatHandler } from "../abort"
import { abortHostedAgentTurn } from "@/lib/pi/durable/hosted-agent-turn"

vi.mock("@/lib/pi/durable/hosted-agent-turn", () => ({
  abortHostedAgentTurn: vi.fn(),
}))

vi.mock("@/lib/auth/chat-api-auth", () => ({
  enforceChatSessionOwnership: vi.fn(() => Promise.resolve({ ok: true })),
  withAuthenticatedChatRequest: vi.fn(
    (_request: Request, handler: (auth: { userId: string }) => unknown) =>
      handler({ userId: "user-1" })
  ),
}))

describe("abortChatHandler", () => {
  afterEach(() => {
    delete process.env.FLEET_PI_DEPLOYMENT
    vi.mocked(abortHostedAgentTurn).mockReset()
  })

  it("asks the hosted durable object to abort an in-flight turn", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    vi.mocked(abortHostedAgentTurn).mockResolvedValue(
      Response.json({ aborted: true })
    )
    const response = await abortChatHandler(
      new Request("https://fleet-pi.example/api/chat/abort", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: "durable:42" }),
      })
    )

    expect(abortHostedAgentTurn).toHaveBeenCalledWith("user-1")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ aborted: true })
  })

  it("returns not-live and does not report the turn as aborted when the runtime map is empty", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    const response = await abortChatHandler(
      new Request("https://fleet-pi.example/api/chat/abort", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: "missing-session" }),
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: "not-live",
      aborted: false,
    })
  })
})
