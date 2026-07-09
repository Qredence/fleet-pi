import { afterEach, describe, expect, it, vi } from "vitest"
import {
  enforceChatSessionOwnership,
  isVercelChatDeployment,
  requireVercelChatAuth,
  unauthorizedChatResponse,
} from "../chat-api-auth"

import { auth } from "@/lib/auth/server"
import { verifySessionOwnership } from "@/lib/db/pi-session-mirror"

vi.mock("@/lib/auth/server", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock("@/lib/db/pi-session-mirror", () => ({
  verifySessionOwnership: vi.fn(),
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

describe("chat-api-auth", () => {
  it("requires auth on Vercel deployments", async () => {
    process.env.VERCEL = "1"
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const result = await requireVercelChatAuth(
      new Request("http://localhost/api/chat")
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })

  it("allows unauthenticated access outside Vercel", async () => {
    delete process.env.VERCEL
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const result = await requireVercelChatAuth(
      new Request("http://localhost/api/chat")
    )

    expect(result.ok).toBe(true)
  })

  it("enforces session ownership when sessionId and userId are present", async () => {
    vi.mocked(verifySessionOwnership).mockResolvedValue(false)

    const result = await enforceChatSessionOwnership({
      sessionId: "session-1",
      userId: "user-1",
    })

    expect(verifySessionOwnership).toHaveBeenCalledWith("session-1", "user-1")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
    }
  })

  it("skips ownership checks when session metadata is incomplete", async () => {
    const result = await enforceChatSessionOwnership({
      sessionId: undefined,
      userId: "user-1",
    })

    expect(verifySessionOwnership).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it("exposes deployment detection for tests", () => {
    process.env.VERCEL = "1"
    expect(isVercelChatDeployment()).toBe(true)
    expect(unauthorizedChatResponse().status).toBe(401)
  })
})
