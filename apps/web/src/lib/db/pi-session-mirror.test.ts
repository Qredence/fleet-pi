import { afterEach, describe, expect, it, vi } from "vitest"
import { logger } from "../logger"
import {
  appendPiRunEvent,
  extractPiSessionMirrorInput,
  finalizePiRun,
  insertPiRunStart,
  mapSessionEntryToMirrorRow,
  replacePiFileMutations,
  syncPiSessionMirrorSafely,
  upsertPiSessionMirror,
  upsertPiToolExecution,
} from "./pi-session-mirror"
import type {
  PiSessionEntryMirrorInput,
  PiSessionMirrorInput,
  PostgresQueryClient,
} from "./pi-session-mirror"
import type {
  SessionEntry,
  SessionEntryBase,
  SessionHeader,
} from "@earendil-works/pi-coding-agent"

const originalChatDatabaseUrl = process.env.FLEET_PI_CHAT_DATABASE_URL

afterEach(() => {
  process.env.FLEET_PI_CHAT_DATABASE_URL = originalChatDatabaseUrl
  vi.restoreAllMocks()
})

type RecordedQuery = {
  sql: string
  params: Array<unknown>
}

function createMockClient(): PostgresQueryClient & {
  queries: Array<RecordedQuery>
} {
  const queries: Array<RecordedQuery> = []
  return {
    queries,
    query(sql, params = []) {
      queries.push({ sql, params })
      if (sql.includes('AS "nextTurnIndex"')) {
        return Promise.resolve({ rows: [{ nextTurnIndex: 3 }] as Array<never> })
      }
      return Promise.resolve({ rows: [] as Array<never> })
    },
  }
}

const header: SessionHeader = {
  type: "session",
  version: 3,
  id: "session-1",
  timestamp: "2026-05-22T10:00:00.000Z",
  cwd: "/repo",
}

function entryBase(type: string, id: string): SessionEntryBase {
  return {
    type,
    id,
    parentId: null,
    timestamp: "2026-05-22T10:01:00.000Z",
  }
}

describe("Pi session mirror mapping", () => {
  it("normalizes all Pi session entry families for Postgres indexing", () => {
    const entries = [
      {
        ...entryBase("message", "user-1"),
        type: "message",
        message: {
          role: "user",
          content: "hello fleet",
          timestamp: Date.now(),
        },
      },
      {
        ...entryBase("message", "assistant-1"),
        type: "message",
        parentId: "user-1",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "checking" },
            { type: "text", text: "done" },
            { type: "toolCall", id: "tool-1", name: "Read", arguments: {} },
          ],
          provider: "amazon-bedrock",
          model: "claude",
          usage: {
            totalTokens: 42,
            cost: { total: 0.12 },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        },
      },
      {
        ...entryBase("message", "tool-1"),
        type: "message",
        parentId: "assistant-1",
        message: {
          role: "toolResult",
          toolCallId: "tool-1",
          toolName: "Read",
          content: [{ type: "text", text: "package.json" }],
          isError: true,
          timestamp: Date.now(),
        },
      },
      {
        ...entryBase("model_change", "model-1"),
        type: "model_change",
        provider: "amazon-bedrock",
        modelId: "sonnet",
      },
      {
        ...entryBase("thinking_level_change", "thinking-1"),
        type: "thinking_level_change",
        thinkingLevel: "high",
      },
      {
        ...entryBase("compaction", "compaction-1"),
        type: "compaction",
        summary: "older context",
        firstKeptEntryId: "assistant-1",
        tokensBefore: 1000,
      },
      {
        ...entryBase("branch_summary", "branch-1"),
        type: "branch_summary",
        fromId: "assistant-1",
        summary: "alternate path",
      },
      {
        ...entryBase("custom", "custom-1"),
        type: "custom",
        customType: "plan-mode",
        data: { todos: 2 },
      },
      {
        ...entryBase("custom_message", "custom-message-1"),
        type: "custom_message",
        customType: "extension-note",
        content: "visible extension context",
        display: true,
      },
      {
        ...entryBase("label", "label-1"),
        type: "label",
        targetId: "assistant-1",
        label: "checkpoint",
      },
      {
        ...entryBase("session_info", "info-1"),
        type: "session_info",
        name: "Schema design",
      },
    ] as Array<SessionEntry>

    const rows = entries.map((entry) =>
      mapSessionEntryToMirrorRow(header, entry)
    )

    expect(rows).toEqual([
      expect.objectContaining({
        entryId: "user-1",
        role: "user",
        contentText: "hello fleet",
      }),
      expect.objectContaining({
        entryId: "assistant-1",
        role: "assistant",
        provider: "amazon-bedrock",
        modelId: "claude",
        contentText: "checking\ndone\ntool:Read",
        tokensTotal: 42,
        costTotal: 0.12,
      }),
      expect.objectContaining({
        entryId: "tool-1",
        role: "toolResult",
        isError: true,
      }),
      expect.objectContaining({
        entryId: "model-1",
        provider: "amazon-bedrock",
        modelId: "sonnet",
      }),
      expect.objectContaining({
        entryId: "thinking-1",
        thinkingLevel: "high",
      }),
      expect.objectContaining({
        entryId: "compaction-1",
        summary: "older context",
        tokensTotal: 1000,
      }),
      expect.objectContaining({
        entryId: "branch-1",
        fromEntryId: "assistant-1",
        summary: "alternate path",
      }),
      expect.objectContaining({
        entryId: "custom-1",
        customType: "plan-mode",
        contentText: '{"todos":2}',
      }),
      expect.objectContaining({
        entryId: "custom-message-1",
        customType: "extension-note",
        contentText: "visible extension context",
      }),
      expect.objectContaining({
        entryId: "label-1",
        targetEntryId: "assistant-1",
        contentText: "checkpoint",
      }),
      expect.objectContaining({
        entryId: "info-1",
        contentText: "Schema design",
      }),
    ])
  })

  it("extracts session-level metadata from a SessionManager-like source", () => {
    const entries = [
      {
        ...entryBase("message", "user-1"),
        type: "message",
        message: {
          role: "user",
          content: "first prompt",
          timestamp: Date.now(),
        },
      },
    ] as Array<SessionEntry>

    const input = extractPiSessionMirrorInput({
      getHeader: () => header,
      getSessionFile: () => "/repo/.fleet/sessions/session.jsonl",
      getCwd: () => "/repo",
      getSessionName: () => "Named session",
      getLeafId: () => "user-1",
      getEntries: () => entries,
    } as never)

    expect(input).toEqual(
      expect.objectContaining({
        id: "session-1",
        sessionFilePath: "/repo/.fleet/sessions/session.jsonl",
        cwd: "/repo",
        version: 3,
        name: "Named session",
        firstMessagePreview: "first prompt",
        leafEntryId: "user-1",
        entryCount: 1,
        messageCount: 1,
      })
    )
  })
})

describe("Pi session mirror repository", () => {
  it("upserts a session with raw JSON entries", async () => {
    const client = createMockClient()
    const entry = mapSessionEntryToMirrorRow(header, {
      ...entryBase("custom", "custom-1"),
      type: "custom",
      customType: "plan-mode",
      data: { ok: true },
    })

    await upsertPiSessionMirror(client, {
      id: "session-1",
      userId: "user-1",
      sessionFilePath: "/repo/.fleet/sessions/session.jsonl",
      cwd: "/repo",
      version: 3,
      name: "Named session",
      firstMessagePreview: "hello",
      leafEntryId: "custom-1",
      entryCount: 1,
      messageCount: 0,
      createdAt: "2026-05-22T10:00:00.000Z",
      updatedAt: "2026-05-22T10:01:00.000Z",
      entries: [entry],
    })

    const sessionQuery = client.queries.find((query) =>
      query.sql.includes("INSERT INTO pi_sessions")
    )
    const entriesQuery = client.queries.find((query) =>
      query.sql.includes("INSERT INTO pi_session_entries")
    )
    expect(sessionQuery?.sql).toContain("INSERT INTO pi_sessions")
    expect(entriesQuery?.sql).toContain("INSERT INTO pi_session_entries")
    expect(entriesQuery?.params[16]).toBe(
      '{"type":"custom","id":"custom-1","parentId":null,"timestamp":"2026-05-22T10:01:00.000Z","customType":"plan-mode","data":{"ok":true}}'
    )
  })

  it("records run, event, tool, mutation, and finalize writes", async () => {
    const client = createMockClient()

    await insertPiRunStart(client, {
      runId: "run-1",
      assistantMessageId: "assistant-1",
      sessionId: "session-1",
      sessionFile: "/repo/.fleet/sessions/session.jsonl",
      cwd: "/repo",
      mode: "agent",
      startedAt: "2026-05-22T10:00:00.000Z",
      userId: "user-1",
    })
    await appendPiRunEvent(client, {
      runId: "run-1",
      sequence: 1,
      eventType: "tool",
      summary: "tool-Read",
      payload: { type: "tool", value: BigInt(1) },
      recordedAt: "2026-05-22T10:01:00.000Z",
    })
    await upsertPiToolExecution(client, {
      sessionId: "session-1",
      runId: "run-1",
      toolCallId: "tool-1",
      toolName: "Read",
      state: "output-available",
      isError: false,
      input: { file_path: "package.json" },
      output: { content: "ok" },
      claimedPaths: ["package.json"],
      firstSequence: 1,
      lastSequence: 2,
    })
    await replacePiFileMutations(client, {
      runId: "run-1",
      recordedAt: "2026-05-22T10:02:00.000Z",
      mutations: [
        {
          canonicalPath: "package.json",
          kind: "updated",
          toolCallId: "tool-1",
          eventSequence: 2,
          beforeDigest: "a",
          afterDigest: "b",
          beforeSize: 1,
          afterSize: 2,
          summary: "Updated package.json",
        },
      ],
    })
    await finalizePiRun(client, {
      runId: "run-1",
      status: "completed",
      assistantPreview: "done",
      completedAt: "2026-05-22T10:03:00.000Z",
    })

    expect(client.queries.map((query) => query.sql)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("INSERT INTO pi_sessions"),
        expect.stringContaining("INSERT INTO pi_runs"),
        expect.stringContaining("INSERT INTO pi_run_events"),
        expect.stringContaining("INSERT INTO pi_tool_executions"),
        expect.stringContaining("DELETE FROM pi_file_mutations"),
        expect.stringContaining("INSERT INTO pi_file_mutations"),
        expect.stringContaining("UPDATE pi_runs"),
      ])
    )
    const eventQuery = client.queries.find((query) =>
      query.sql.includes("INSERT INTO pi_run_events")
    )
    expect(eventQuery?.params[4]).toBe('{"type":"tool","value":"1"}')
  })

  it("logs non-fatal mirror sync failures", async () => {
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://mirror.test/fleet"
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined)

    await expect(
      syncPiSessionMirrorSafely({
        getHeader() {
          throw new Error("boom")
        },
      } as never)
    ).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledWith(
      {
        error: expect.objectContaining({ message: "boom" }),
      },
      "[pi-session-mirror] sync failed (non-fatal)"
    )
  })

  it("requires userId when inserting runs on Vercel", async () => {
    process.env.VERCEL = "1"
    const client = createMockClient()

    await expect(
      insertPiRunStart(client, {
        runId: "run-1",
        assistantMessageId: "assistant-1",
        sessionId: "session-1",
        cwd: "/repo",
        startedAt: "2026-05-22T10:00:00.000Z",
      })
    ).rejects.toThrow(/Authenticated owner is required/)

    delete process.env.VERCEL
  })

  it("logs mirror sync failures on Vercel without throwing", async () => {
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://mirror.test/fleet"
    process.env.VERCEL = "1"
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined)

    try {
      await expect(
        syncPiSessionMirrorSafely(
          {
            getHeader() {
              throw new Error("boom vercel")
            },
          } as never,
          { userId: "user-vercel" }
        )
      ).resolves.toBeUndefined()

      expect(errorSpy).toHaveBeenCalledWith(
        {
          error: expect.objectContaining({ message: "boom vercel" }),
        },
        "[pi-session-mirror] sync failure on Vercel (non-fatal)"
      )
    } finally {
      delete process.env.VERCEL
    }
  })
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
