import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { setLocalUserId, withUserContext } from "../pi-session-ownership-db"

const poolQuery = vi.hoisted(() => vi.fn())
const clientRelease = vi.hoisted(() => vi.fn())
const poolConnect = vi.hoisted(() =>
  vi.fn(async () => ({
    query: poolQuery,
    release: clientRelease,
  }))
)

vi.mock("@neondatabase/serverless", () => ({
  Pool: class MockPool {
    connect = poolConnect
    query = poolQuery
  },
}))

describe("withUserContext", () => {
  const originalChatUrl = process.env.FLEET_PI_CHAT_DATABASE_URL

  beforeEach(() => {
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://example"
    poolQuery.mockReset()
    poolConnect.mockClear()
    clientRelease.mockClear()
    poolQuery.mockResolvedValue({ rows: [] })
  })

  afterEach(() => {
    if (originalChatUrl === undefined) {
      delete process.env.FLEET_PI_CHAT_DATABASE_URL
    } else {
      process.env.FLEET_PI_CHAT_DATABASE_URL = originalChatUrl
    }
  })

  it("sets app.current_user_id after BEGIN on the same client", async () => {
    const { getChatPostgresPool } = await import("../pi-session-ownership-db")
    const pool = getChatPostgresPool()
    if (!pool) throw new Error("expected chat pool")

    const calls: Array<{ sql: string; params?: Array<unknown> }> = []
    poolQuery.mockImplementation(
      async (sql: string, params?: Array<unknown>) => {
        calls.push({ sql, params })
        return { rows: [] }
      }
    )

    await withUserContext(pool, "user-1", async (client) => {
      await client.query("SELECT 1")
    })

    expect(calls.map((call) => call.sql)).toEqual([
      "BEGIN",
      "SELECT set_config('app.current_user_id', $1, true)",
      "SELECT 1",
      "COMMIT",
    ])
    expect(calls[1]?.params).toEqual(["user-1"])
    expect(calls.some((call) => call.sql.includes("RESET"))).toBe(false)
    expect(clientRelease).toHaveBeenCalledOnce()
  })

  it("rolls back and rethrows when the operation fails", async () => {
    const { getChatPostgresPool } = await import("../pi-session-ownership-db")
    const pool = getChatPostgresPool()
    if (!pool) throw new Error("expected chat pool")

    const calls: Array<string> = []
    poolQuery.mockImplementation(async (sql: string) => {
      calls.push(sql)
      if (sql === "SELECT boom") {
        throw new Error("boom")
      }
      return { rows: [] }
    })

    await expect(
      withUserContext(pool, "user-1", async (client) => {
        await client.query("SELECT boom")
      })
    ).rejects.toThrow("boom")

    expect(calls).toEqual([
      "BEGIN",
      "SELECT set_config('app.current_user_id', $1, true)",
      "SELECT boom",
      "ROLLBACK",
    ])
  })

  it("exports setLocalUserId for transaction-scoped RLS context", async () => {
    const client = {
      query: vi.fn(async () => ({ rows: [] })),
    }

    await setLocalUserId(client, "user-42")

    expect(client.query).toHaveBeenCalledWith(
      "SELECT set_config('app.current_user_id', $1, true)",
      ["user-42"]
    )
  })
})
