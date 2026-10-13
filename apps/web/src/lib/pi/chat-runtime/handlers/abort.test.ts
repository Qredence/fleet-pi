import { afterEach, describe, expect, it, vi } from "vitest"

import { abortChatHandler } from "./abort"

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
