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

const originalVercel = process.env.VERCEL

afterEach(() => {
  vi.clearAllMocks()
  if (originalVercel === undefined) {
    delete process.env.VERCEL
  } else {
    process.env.VERCEL = originalVercel
  }
})

describe("Vercel chat API auth gate", () => {
  it("returns 401 for unauthenticated chat handlers on Vercel", async () => {
    process.env.VERCEL = "1"
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
    delete process.env.VERCEL
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const response = await chatRunsHandler(
      new Request("http://localhost/api/chat/runs?sessionId=session-1"),
      undefined
    )

    expect(response.status).not.toBe(401)
  })
})
