import { afterEach, describe, expect, it, vi } from "vitest"
import {
  enforceChatSessionOwnership,
  enforceRunOwnership,
  isVercelChatDeployment,
  requireVercelChatAuth,
  unauthorizedChatResponse,
  withAuthenticatedChatRequest,
} from "../chat-api-auth"

import { auth } from "@/lib/auth/server"
import {
  lookupSessionIdBySessionFile,
  verifyRunOwnership,
  verifySessionOwnership,
} from "@/lib/db/pi-session-ownership-db"

vi.mock("@/lib/auth/server", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock("@/lib/db/pi-session-ownership-db", () => ({
  verifySessionOwnership: vi.fn(),
  lookupSessionIdBySessionFile: vi.fn(),
  verifyRunOwnership: vi.fn(),
  isUserScopedEphemeralSessionFile: vi.fn(() => false),
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

    expect(verifySessionOwnership).toHaveBeenCalledWith(
      "session-1",
      "user-1",
      {}
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
    }
  })

  it("skips ownership checks when no session identifier is present", async () => {
    const result = await enforceChatSessionOwnership({
      userId: "user-1",
    })

    expect(verifySessionOwnership).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it("denies sessionFile-only access on Vercel when mirror lookup fails", async () => {
    process.env.VERCEL = "1"
    vi.mocked(lookupSessionIdBySessionFile).mockResolvedValue(undefined)
    const { isUserScopedEphemeralSessionFile } =
      await import("@/lib/db/pi-session-ownership-db")
    vi.mocked(isUserScopedEphemeralSessionFile).mockReturnValue(false)

    const result = await enforceChatSessionOwnership({
      sessionFile: "/tmp/.fleet/sessions/session.jsonl",
      userId: "user-1",
    })

    expect(lookupSessionIdBySessionFile).toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
    }
  })

  it("allows sessionFile-only access on Vercel when ephemeral JSONL exists before mirror sync", async () => {
    process.env.VERCEL = "1"
    vi.mocked(lookupSessionIdBySessionFile).mockResolvedValue(undefined)
    const { isUserScopedEphemeralSessionFile } =
      await import("@/lib/db/pi-session-ownership-db")
    vi.mocked(isUserScopedEphemeralSessionFile).mockReturnValue(true)

    const result = await enforceChatSessionOwnership({
      sessionFile: "/tmp/.fleet/sessions/user-1/session.jsonl",
      userId: "user-1",
    })

    expect(verifySessionOwnership).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it("resolves sessionFile to sessionId on Vercel before ownership check", async () => {
    process.env.VERCEL = "1"
    vi.mocked(lookupSessionIdBySessionFile).mockResolvedValue("session-1")
    vi.mocked(verifySessionOwnership).mockResolvedValue(true)

    const result = await enforceChatSessionOwnership({
      sessionFile: "/tmp/.fleet/sessions/session.jsonl",
      userId: "user-1",
    })

    expect(verifySessionOwnership).toHaveBeenCalledWith("session-1", "user-1", {
      sessionFile: "/tmp/.fleet/sessions/session.jsonl",
    })
    expect(result.ok).toBe(true)
  })

  it("allows sessionFile-only access outside Vercel", async () => {
    delete process.env.VERCEL

    const result = await enforceChatSessionOwnership({
      sessionFile: "/tmp/.fleet/sessions/session.jsonl",
      userId: "user-1",
    })

    expect(verifySessionOwnership).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it("wraps handlers with authenticated chat context", async () => {
    delete process.env.VERCEL
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
    } as never)

    const response = await withAuthenticatedChatRequest(
      new Request("http://localhost/api/chat"),
      async ({ userId }) => Response.json({ userId })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ userId: "user-1" })
  })

  it("exposes deployment detection for tests", () => {
    process.env.VERCEL = "1"
    expect(isVercelChatDeployment()).toBe(true)
    expect(unauthorizedChatResponse().status).toBe(401)
  })

  it("denies foreign runs when mirror ownership fails", async () => {
    vi.mocked(verifyRunOwnership).mockResolvedValue(false)

    const result = await enforceRunOwnership({
      runId: "run-1",
      userId: "user-1",
    })

    expect(verifyRunOwnership).toHaveBeenCalledWith("run-1", "user-1")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
    }
  })

  it("requires auth for run access on Vercel", async () => {
    process.env.VERCEL = "1"

    const result = await enforceRunOwnership({
      runId: "run-1",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })
})
