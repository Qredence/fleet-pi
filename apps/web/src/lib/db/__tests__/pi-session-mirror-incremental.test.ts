import { afterEach, describe, expect, it, vi } from "vitest"
import { upsertPiSessionMirror } from "../pi-session-mirror"
import type {
  PiSessionEntryMirrorInput,
  PiSessionMirrorInput,
} from "../pi-session-mirror"
import type { RecordedQuery } from "./pi-session-mirror-fixtures"

const originalChatDatabaseUrl = process.env.FLEET_PI_CHAT_DATABASE_URL

afterEach(() => {
  process.env.FLEET_PI_CHAT_DATABASE_URL = originalChatDatabaseUrl
  vi.restoreAllMocks()
})

// ── Incremental sync helpers ────────────────────────────────────────────────

type MirrorDbSession = {
  entry_count: number
  last_synced_entry_id: string | null
  last_synced_entry_timestamp: string | null
}

type MirrorDb = {
  sessions: Map<string, MirrorDbSession>
  entries: Map<string, { sessionId: string; entryId: string }>
}

const MIRROR_ROW_PARAMS = 18

// A stateful mock that actually applies the (session_id, entry_id) idempotent
// upsert so concurrent/dedup tests can assert the final set.
function createStatefulMockClient(
  db: MirrorDb,
  options: { failOnEntriesInsert?: boolean } = {}
) {
  const queries: Array<RecordedQuery> = []
  const query = <T = Record<string, unknown>>(
    sql: string,
    params: Array<unknown> = []
  ): Promise<{ rows: Array<T> }> => {
    queries.push({ sql, params })
    if (
      sql.includes("FROM pi_sessions") &&
      sql.includes("last_synced_entry_id")
    ) {
      const sessionId = params[0] as string
      const session = db.sessions.get(sessionId)
      const rows = session
        ? [
            {
              last_synced_entry_id: session.last_synced_entry_id,
              last_synced_entry_timestamp: session.last_synced_entry_timestamp,
              entry_count: session.entry_count,
            },
          ]
        : []
      return Promise.resolve({ rows: rows as unknown as Array<T> })
    }
    if (sql.includes("INSERT INTO pi_sessions")) {
      const id = params[0] as string
      const existing = db.sessions.get(id)
      db.sessions.set(id, {
        entry_count: params[9] as number,
        last_synced_entry_id: existing?.last_synced_entry_id ?? null,
        last_synced_entry_timestamp:
          existing?.last_synced_entry_timestamp ?? null,
      })
      return Promise.resolve({ rows: [] })
    }
    if (sql.includes("INSERT INTO pi_session_entries")) {
      if (options.failOnEntriesInsert) {
        throw new Error("boom")
      }
      for (let i = 0; i < params.length; i += MIRROR_ROW_PARAMS) {
        db.entries.set(`${params[i]}:${params[i + 1]}`, {
          sessionId: params[i] as string,
          entryId: params[i + 1] as string,
        })
      }
      return Promise.resolve({ rows: [] })
    }
    if (
      sql.includes("UPDATE pi_sessions") &&
      sql.includes("last_synced_entry_id")
    ) {
      const id = params[0] as string
      const existing = db.sessions.get(id) ?? { entry_count: 0 }
      db.sessions.set(id, {
        entry_count: existing.entry_count,
        last_synced_entry_id: params[1] as string,
        last_synced_entry_timestamp: params[2] as string,
      })
      return Promise.resolve({ rows: [] })
    }
    return Promise.resolve({ rows: [] })
  }
  return { queries, query }
}

type StatefulClient = ReturnType<typeof createStatefulMockClient>

function makeEntryDB(overrides: Partial<PiSessionEntryMirrorInput> = {}) {
  const entry: PiSessionEntryMirrorInput = {
    sessionId: "session-1",
    entryId: "e1",
    parentEntryId: null,
    entryType: "message",
    isError: false,
    rawEntry: undefined as never,
    entryTimestamp: "2026-05-22T10:01:00.000Z",
    ...overrides,
  }
  entry.rawEntry =
    overrides.rawEntry ?? ({ type: "message", id: entry.entryId } as never)
  return entry
}

function mirrorInputDB(entries: Array<PiSessionEntryMirrorInput>) {
  const input: PiSessionMirrorInput = {
    id: "session-1",
    userId: "user-1",
    sessionFilePath: "/repo/.fleet/sessions/session.jsonl",
    cwd: "/repo",
    version: 3,
    entryCount: entries.length,
    messageCount: entries.length,
    createdAt: "2026-05-22T10:00:00.000Z",
    updatedAt: "2026-05-22T10:01:00.000Z",
    entries,
  }
  return input
}

function entryIdsInInserts(client: StatefulClient): Array<string> {
  return client.queries
    .filter((query) => query.sql.includes("INSERT INTO pi_session_entries"))
    .flatMap((query) =>
      query.params.filter((_, idx) => idx % MIRROR_ROW_PARAMS === 1)
    ) as Array<string>
}

function watermarkUpdate(client: StatefulClient) {
  return client.queries.find(
    (query) =>
      query.sql.includes("UPDATE pi_sessions") &&
      query.sql.includes("last_synced_entry_id")
  )
}

function emptyDb(): MirrorDb {
  return { sessions: new Map(), entries: new Map() }
}

describe("Pi session mirror incremental sync", () => {
  it("second sync with one new entry writes only that entry", async () => {
    const db = emptyDb()
    const firstClient = createStatefulMockClient(db)
    const e1 = makeEntryDB({ entryId: "e1", entryTimestamp: "T1" })
    await upsertPiSessionMirror(firstClient, mirrorInputDB([e1]))

    const secondClient = createStatefulMockClient(db)
    const e2 = makeEntryDB({ entryId: "e2", entryTimestamp: "T2" })
    await upsertPiSessionMirror(secondClient, mirrorInputDB([e1, e2]))

    expect(entryIdsInInserts(secondClient)).toEqual(["e2"])
    expect(db.entries.size).toBe(2)
  })

  it("first sync is a full upsert of the entire history", async () => {
    const db = emptyDb()
    const client = createStatefulMockClient(db)
    const e1 = makeEntryDB({ entryId: "e1", entryTimestamp: "T1" })
    const e2 = makeEntryDB({ entryId: "e2", entryTimestamp: "T2" })
    await upsertPiSessionMirror(client, mirrorInputDB([e1, e2]))

    expect(entryIdsInInserts(client)).toEqual(["e1", "e2"])
    expect(watermarkUpdate(client)?.params).toEqual(["session-1", "e2", "T2"])
  })

  it("falls back to a full sync when the DB holds more entries than the input", async () => {
    const db: MirrorDb = {
      sessions: new Map([
        [
          "session-1",
          {
            entry_count: 5,
            last_synced_entry_id: "e2",
            last_synced_entry_timestamp: "T2",
          },
        ],
      ]),
      entries: new Map(),
    }
    const client = createStatefulMockClient(db)
    const e1 = makeEntryDB({ entryId: "e1", entryTimestamp: "T1" })
    const e2 = makeEntryDB({ entryId: "e2", entryTimestamp: "T2" })
    const e3 = makeEntryDB({ entryId: "e3", entryTimestamp: "T3" })
    // entryCount = 3 < DB prior count 5 → full self-heal upsert
    await upsertPiSessionMirror(client, mirrorInputDB([e1, e2, e3]))

    expect(entryIdsInInserts(client)).toEqual(["e1", "e2", "e3"])
  })

  it("persists the watermark in the same transaction as the entries upsert", async () => {
    const db = emptyDb()
    const client = createStatefulMockClient(db)
    const e1 = makeEntryDB({ entryId: "e1", entryTimestamp: "T1" })
    await upsertPiSessionMirror(client, mirrorInputDB([e1]))

    const insertIdx = client.queries.findIndex((q) =>
      q.sql.includes("INSERT INTO pi_session_entries")
    )
    const updateIdx = client.queries.findIndex(
      (q) =>
        q.sql.includes("UPDATE pi_sessions") &&
        q.sql.includes("last_synced_entry_id")
    )
    expect(updateIdx).toBeGreaterThan(insertIdx)
    expect(client.queries[updateIdx]?.params).toEqual(["session-1", "e1", "T1"])
  })

  it("does not advance the watermark when the entries upsert fails", async () => {
    const db = emptyDb()
    const client = createStatefulMockClient(db, {
      failOnEntriesInsert: true,
    })
    const e1 = makeEntryDB({ entryId: "e1", entryTimestamp: "T1" })

    await expect(
      upsertPiSessionMirror(client, mirrorInputDB([e1]))
    ).rejects.toThrow("boom")

    expect(watermarkUpdate(client)).toBeUndefined()
    expect(db.sessions.get("session-1")?.last_synced_entry_id).toBeNull()
  })

  it("respects recovery ordering with equal timestamps (tie-break by id)", async () => {
    const db: MirrorDb = {
      sessions: new Map([
        [
          "session-1",
          {
            entry_count: 3,
            last_synced_entry_id: "e2",
            last_synced_entry_timestamp: "T",
          },
        ],
      ]),
      entries: new Map(),
    }
    const client = createStatefulMockClient(db)
    const e1 = makeEntryDB({ entryId: "e1", entryTimestamp: "T" })
    const e2 = makeEntryDB({ entryId: "e2", entryTimestamp: "T" })
    const e3 = makeEntryDB({ entryId: "e3", entryTimestamp: "T" })
    // watermark = e2@T; only e3 (equal timestamp, later id) is new
    await upsertPiSessionMirror(client, mirrorInputDB([e1, e2, e3]))

    expect(entryIdsInInserts(client)).toEqual(["e3"])
  })

  it("concurrent syncs lose no entries (idempotent upsert)", async () => {
    const db = emptyDb()
    const client = createStatefulMockClient(db)
    const e1 = makeEntryDB({ entryId: "e1", entryTimestamp: "T1" })
    const e2 = makeEntryDB({ entryId: "e2", entryTimestamp: "T2" })
    const e3 = makeEntryDB({ entryId: "e3", entryTimestamp: "T3" })

    await Promise.all([
      upsertPiSessionMirror(client, mirrorInputDB([e1, e2])),
      upsertPiSessionMirror(client, mirrorInputDB([e2, e3])),
    ])

    expect(db.entries.size).toBe(3)
    expect([...db.entries.keys()].sort()).toEqual([
      "session-1:e1",
      "session-1:e2",
      "session-1:e3",
    ])
  })

  it("re-syncing an already-present entry id is idempotent", async () => {
    const db = emptyDb()
    const firstClient = createStatefulMockClient(db)
    const e1 = makeEntryDB({ entryId: "e1", entryTimestamp: "T1" })
    await upsertPiSessionMirror(firstClient, mirrorInputDB([e1]))

    const secondClient = createStatefulMockClient(db)
    await upsertPiSessionMirror(secondClient, mirrorInputDB([e1]))

    expect(db.entries.size).toBe(1)
    expect(entryIdsInInserts(secondClient)).toEqual([])
  })
})
