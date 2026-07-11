import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deleteOwnedPiSession, eraseUserPiData } from "../pi-session-deletion"

import { resolveOwnedMirrorSession } from "../pi-session-ownership-db"
import type * as PiSessionOwnershipDbModule from "../pi-session-ownership-db"

const { poolQuery, withUserContext, getChatPostgresPool } = vi.hoisted(() => {
  const poolQuery = vi.fn()
  const withUserContext = vi.fn(
    async (
      _pool: unknown,
      _userId: string | undefined,
      handler: (client: { query: typeof poolQuery }) => Promise<unknown>
    ) => handler({ query: poolQuery })
  )
  const getChatPostgresPool = vi.fn(() => ({}))
  return { poolQuery, withUserContext, getChatPostgresPool }
})

vi.mock("@neondatabase/serverless", () => ({
  Pool: class MockPool {},
}))

vi.mock("../pi-session-ownership-db", async (importOriginal) => {
  const actual = await importOriginal<typeof PiSessionOwnershipDbModule>()
  return {
    ...actual,
    getChatPostgresPool,
    withUserContext,
    isPiSessionMirrorEnabled: vi.fn(() => true),
    resolveOwnedMirrorSession: vi.fn(),
  }
})

vi.mock("@/lib/pi/server-runtime", () => ({
  evictPiRuntimeForDeletedSession: vi.fn(),
}))

describe("pi-session-deletion", () => {
  const originalChatUrl = process.env.FLEET_PI_CHAT_DATABASE_URL

  beforeEach(() => {
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://example"
    poolQuery.mockReset()
    withUserContext.mockClear()
    vi.mocked(resolveOwnedMirrorSession).mockReset()
  })

  afterEach(() => {
    if (originalChatUrl === undefined) {
      delete process.env.FLEET_PI_CHAT_DATABASE_URL
    } else {
      process.env.FLEET_PI_CHAT_DATABASE_URL = originalChatUrl
    }
  })

  it("deletes owned sessions through owner-scoped SQL", async () => {
    vi.mocked(resolveOwnedMirrorSession).mockResolvedValue({
      id: "session-1",
      session_file_path: "/tmp/session-1.jsonl",
    } as never)
    poolQuery.mockResolvedValueOnce({ rows: [] })

    const result = await deleteOwnedPiSession({
      sessionId: "session-1",
      userId: "user-1",
    })

    expect(result.deleted).toBe(true)
    expect(poolQuery).toHaveBeenCalledWith(
      "DELETE FROM pi_sessions WHERE id = $1 AND user_id = $2",
      ["session-1", "user-1"]
    )
  })

  it("erases all mirrored sessions and provider credentials for a user", async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: "session-1", session_file_path: "/tmp/session-1.jsonl" }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "provider-1" }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await eraseUserPiData("user-1")

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.erasedSessions).toBe(1)
      expect(result.erasedProviders).toBe(1)
    }
    expect(poolQuery).toHaveBeenCalledWith(
      "DELETE FROM pi_sessions WHERE user_id = $1",
      ["user-1"]
    )
    expect(poolQuery).toHaveBeenCalledWith(
      "DELETE FROM pi_user_providers WHERE user_id = $1 RETURNING id",
      ["user-1"]
    )
  })

  it("returns failure when erasure throws", async () => {
    withUserContext.mockRejectedValueOnce(new Error("db down"))

    const result = await eraseUserPiData("user-1")

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("erase-failed")
    }
  })
})
