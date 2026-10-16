import { afterEach, describe, expect, it, vi } from "vitest"
import { markPiSessionDeleted } from "../pi-session-tombstones"
import { queryUserSessionSummaries } from "../pi-session-mirror"
import type { PostgresQueryClient } from "../pi-session-mirror"
import type { RecordedQuery } from "./pi-session-mirror-fixtures"

const originalChatDatabaseUrl = process.env.FLEET_PI_CHAT_DATABASE_URL

afterEach(() => {
  process.env.FLEET_PI_CHAT_DATABASE_URL = originalChatDatabaseUrl
  vi.restoreAllMocks()
})

describe("Pi session mirror read-back", () => {
  it("lists the caller's non-tombstoned sessions newest first", async () => {
    const rows = [
      {
        id: "session-new",
        session_file_path: "/tmp/.fleet/sessions/u/session-new.jsonl",
        cwd: "/repo",
        name: null,
        first_message_preview: "hello",
        message_count: 2,
        created_at: "2026-05-22T10:00:00.000Z",
        updated_at: "2026-05-22T11:00:00.000Z",
      },
    ]
    const queries: Array<RecordedQuery> = []
    const client: PostgresQueryClient = {
      query(sql, params = []) {
        queries.push({ sql, params })
        return Promise.resolve({ rows: rows as Array<never> })
      },
    }

    await expect(queryUserSessionSummaries(client, "user-1")).resolves.toEqual(
      rows
    )
    expect(queries).toHaveLength(1)
    expect(queries[0]?.params).toEqual(["user-1"])
    expect(queries[0]?.sql).toContain("FROM pi_sessions s")
    expect(queries[0]?.sql).toContain("WHERE s.user_id = $1")
    expect(queries[0]?.sql).toContain("FROM pi_session_tombstones t")
    expect(queries[0]?.sql).toContain("ORDER BY s.updated_at DESC")
  })

  it("drops sessions deleted in this process before the tombstone lands", async () => {
    markPiSessionDeleted("session-just-deleted")
    const client: PostgresQueryClient = {
      query: () =>
        Promise.resolve({
          rows: [
            { id: "session-just-deleted" },
            { id: "session-kept" },
          ] as Array<never>,
        }),
    }

    const result = await queryUserSessionSummaries(client, "user-1")
    expect(result.map((row) => row.id)).toEqual(["session-kept"])
  })
})
