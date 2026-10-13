import { afterEach, describe, expect, it, vi } from "vitest"
import { withAuthenticatedChatRequest } from "../chat-api-auth"
import { auth } from "@/lib/auth/server"
import { chatRunsHandler } from "@/routes/api/chat/runs"

vi.mock("@/lib/auth/server", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

const originalHosted = process.env.FLEET_PI_DEPLOYMENT

afterEach(() => {
  vi.clearAllMocks()
  if (originalHosted === undefined) {
    delete process.env.FLEET_PI_DEPLOYMENT
  } else {
    process.env.FLEET_PI_DEPLOYMENT = originalHosted
  }
})

describe("hosted chat API auth gate", () => {
  it("returns 401 for unauthenticated chat handlers on Cloudflare", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const response = await withAuthenticatedChatRequest(
      new Request("http://localhost/api/chat/runs?sessionId=s1"),
      () =>
        chatRunsHandler(
          new Request("http://localhost/api/chat/runs?sessionId=s1")
        )
    )

    expect(response.status).toBe(401)
  })

  it("allows local provenance runs without auth when mirror is disabled", async () => {
    delete process.env.FLEET_PI_DEPLOYMENT
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const response = await chatRunsHandler(
      new Request("http://localhost/api/chat/runs?sessionId=session-1"),
      undefined
    )

    expect(response.status).not.toBe(401)
  })
})
