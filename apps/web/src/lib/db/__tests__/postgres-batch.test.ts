import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  replacePiFileMutations,
  upsertPiSessionMirror,
} from "../pi-session-mirror"
import { insertRowsChunked } from "../postgres-batch"
import type { PiSessionEntryMirrorInput } from "../pi-session-mirror"
import type { PostgresQueryClient } from "../postgres-batch"

type RecordedQuery = { sql: string; params: Array<unknown> }

function createMockClient(): PostgresQueryClient & {
  queries: Array<RecordedQuery>
} {
  const queries: Array<RecordedQuery> = []
  return {
    queries,
    query(sql, params = []) {
      queries.push({ sql, params })
      return Promise.resolve({ rows: [] as Array<never> })
    },
  }
}

describe("insertRowsChunked", () => {
  it("issues no query when rows is empty", async () => {
    const client = createMockClient()
    await insertRowsChunked(client, {
      table: "t",
      columns: ["a", "b"],
      rows: [],
      serializeRow: (row: { x: number }) => [row.x],
    })
    expect(client.queries).toEqual([])
  })

  it("generates a single insert for one row with ordered $N placeholders", async () => {
    const client = createMockClient()
    await insertRowsChunked(client, {
      table: "t",
      columns: ["a", "b", "c"],
      rows: [{ v: 1 }],
      serializeRow: (row: { v: number }) => [row.v, "x", null],
    })
    expect(client.queries).toEqual([
      {
        sql: "INSERT INTO t (a, b, c) VALUES ($1,$2,$3)",
        params: [1, "x", null],
      },
    ])
  })

  it("issues one query at exactly chunkSize rows", async () => {
    const client = createMockClient()
    await insertRowsChunked(client, {
      table: "t",
      columns: ["a"],
      rows: [{ v: 1 }, { v: 2 }],
      serializeRow: (row: { v: number }) => [row.v],
      chunkSize: 2,
    })
    expect(client.queries).toHaveLength(1)
    expect(client.queries[0]?.sql).toBe("INSERT INTO t (a) VALUES ($1),($2)")
    expect(client.queries[0]?.params).toEqual([1, 2])
  })

  it("splits chunkSize+1 rows into two queries with per-chunk $N restart", async () => {
    const client = createMockClient()
    await insertRowsChunked(client, {
      table: "t",
      columns: ["a", "b"],
      rows: [{ v: 1 }, { v: 2 }, { v: 3 }],
      serializeRow: (row: { v: number }) => [row.v, `${row.v}!`],
      chunkSize: 2,
    })
    expect(client.queries).toEqual([
      {
        sql: "INSERT INTO t (a, b) VALUES ($1,$2),($3,$4)",
        params: [1, "1!", 2, "2!"],
      },
      {
        sql: "INSERT INTO t (a, b) VALUES ($1,$2)",
        params: [3, "3!"],
      },
    ])
  })

  it("defaults chunkSize to 50 rows", async () => {
    const client = createMockClient()
    await insertRowsChunked(client, {
      table: "t",
      columns: ["a"],
      rows: Array.from({ length: 51 }, (_, i) => ({ v: i })),
      serializeRow: (row: { v: number }) => [row.v],
    })
    expect(client.queries).toHaveLength(2)
    expect(client.queries[0]?.params).toHaveLength(50)
    expect(client.queries[1]?.sql).toBe("INSERT INTO t (a) VALUES ($1)")
    expect(client.queries[1]?.params).toEqual([50])
  })

  it("applies per-column cast suffixes to only those placeholders", async () => {
    const client = createMockClient()
    await insertRowsChunked(client, {
      table: "t",
      columns: ["id", { name: "doc", cast: "jsonb" }, "ts"],
      rows: [{ v: 0 }, { v: 1 }],
      serializeRow: (row: { v: number }) => [row.v, "{}", row.v + 10],
    })
    expect(client.queries).toEqual([
      {
        sql: "INSERT INTO t (id, doc, ts) VALUES ($1,$2::jsonb,$3),($4,$5::jsonb,$6)",
        params: [0, "{}", 10, 1, "{}", 11],
      },
    ])
  })

  it("emits expression columns inline without consuming a value or $N slot", async () => {
    const client = createMockClient()
    await insertRowsChunked(client, {
      table: "t",
      columns: [
        "a",
        { name: "synced_at", expression: "now()" },
        { name: "doc", cast: "jsonb" },
      ],
      rows: [{ v: 1 }, { v: 2 }],
      serializeRow: (row: { v: number }) => [row.v, "doc"],
    })
    expect(client.queries).toEqual([
      {
        sql: "INSERT INTO t (a, synced_at, doc) VALUES ($1,now(),$2::jsonb),($3,now(),$4::jsonb)",
        params: [1, "doc", 2, "doc"],
      },
    ])
  })

  it("appends onConflictSql verbatim after the VALUES clause", async () => {
    const client = createMockClient()
    const onConflictSql = "ON CONFLICT (id) DO UPDATE SET v = EXCLUDED.v"
    await insertRowsChunked(client, {
      table: "t",
      columns: ["id", "v"],
      rows: [{ v: 1 }],
      serializeRow: (row: { v: number }) => [row.v, row.v],
      onConflictSql,
    })
    expect(client.queries[0]?.sql).toBe(
      `INSERT INTO t (id, v) VALUES ($1,$2) ${onConflictSql}`
    )
  })

  it("preserves flat row-major value order across chunks", async () => {
    const client = createMockClient()
    await insertRowsChunked(client, {
      table: "t",
      columns: ["a", "b"],
      rows: [{ v: 1 }, { v: 2 }, { v: 3 }],
      serializeRow: (row: { v: number }) => [row.v * 10, row.v * 100],
      chunkSize: 1,
    })
    expect(client.queries.map((query) => query.params)).toEqual([
      [10, 100],
      [20, 200],
      [30, 300],
    ])
  })

  it("omits the conflict clause entirely when onConflictSql is not given", async () => {
    const client = createMockClient()
    await insertRowsChunked(client, {
      table: "t",
      columns: ["a"],
      rows: [{ v: 1 }],
      serializeRow: (row: { v: number }) => [row.v],
    })
    expect(client.queries[0]?.sql).toBe("INSERT INTO t (a) VALUES ($1)")
  })
})

const ENTRIES_COLUMNS =
  "session_id, entry_id, parent_entry_id, entry_type, role, custom_type, provider, model_id, thinking_level, target_entry_id, from_entry_id, content_text, summary, is_error, tokens_total, cost_total, raw_entry, entry_timestamp, synced_at"

const ENTRIES_ON_CONFLICT_SQL = `ON CONFLICT (session_id, entry_id) DO UPDATE SET
          parent_entry_id = EXCLUDED.parent_entry_id,
          entry_type = EXCLUDED.entry_type,
          role = EXCLUDED.role,
          custom_type = EXCLUDED.custom_type,
          provider = EXCLUDED.provider,
          model_id = EXCLUDED.model_id,
          thinking_level = EXCLUDED.thinking_level,
          target_entry_id = EXCLUDED.target_entry_id,
          from_entry_id = EXCLUDED.from_entry_id,
          content_text = EXCLUDED.content_text,
          summary = EXCLUDED.summary,
          is_error = EXCLUDED.is_error,
          tokens_total = EXCLUDED.tokens_total,
          cost_total = EXCLUDED.cost_total,
          raw_entry = EXCLUDED.raw_entry,
          entry_timestamp = EXCLUDED.entry_timestamp,
          synced_at = now()`

function makeEntry(overrides: Partial<PiSessionEntryMirrorInput> = {}) {
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

function mirrorInput(entries: Array<PiSessionEntryMirrorInput>) {
  return {
    id: "session-1",
    userId: "user-1",
    sessionFilePath: "/repo/s.jsonl",
    cwd: "/repo",
    version: 3,
    entryCount: entries.length,
    messageCount: entries.length,
    createdAt: "2026-05-22T10:00:00.000Z",
    updatedAt: "2026-05-22T10:01:00.000Z",
    entries,
  }
}

describe("pi-session-mirror chunked writes", () => {
  it("emits the baseline entries upsert SQL and params for two rows", async () => {
    const client = createMockClient()
    const entry1 = makeEntry({
      entryId: "e1",
      role: "user",
      contentText: "hi",
      tokensTotal: 5,
    })
    const entry2 = makeEntry({
      entryId: "e2",
      customType: "plan-mode",
      summary: "sum",
      costTotal: 0.5,
      isError: true,
    })

    await upsertPiSessionMirror(client, mirrorInput([entry1, entry2]))

    const entriesQuery = client.queries.find((query) =>
      query.sql.includes("INSERT INTO pi_session_entries")
    )
    expect(entriesQuery?.sql).toBe(
      `INSERT INTO pi_session_entries (${ENTRIES_COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,now()),($19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35::jsonb,$36,now()) ${ENTRIES_ON_CONFLICT_SQL}`
    )
    expect(entriesQuery?.params).toEqual([
      "session-1",
      "e1",
      null,
      "message",
      "user",
      null,
      null,
      null,
      null,
      null,
      null,
      "hi",
      null,
      false,
      5,
      null,
      '{"type":"message","id":"e1"}',
      "2026-05-22T10:01:00.000Z",
      "session-1",
      "e2",
      null,
      "message",
      null,
      "plan-mode",
      null,
      null,
      null,
      null,
      null,
      null,
      "sum",
      true,
      null,
      0.5,
      '{"type":"message","id":"e2"}',
      "2026-05-22T10:01:00.000Z",
    ])
  })

  it("chunks the entries upsert at 50 rows with per-chunk $N restart", async () => {
    const client = createMockClient()
    const entries = Array.from({ length: 51 }, (_, i) =>
      makeEntry({ entryId: `e${i}` })
    )

    await upsertPiSessionMirror(client, mirrorInput(entries))

    const entryQueries = client.queries.filter((query) =>
      query.sql.includes("INSERT INTO pi_session_entries")
    )
    expect(entryQueries).toHaveLength(2)
    expect(entryQueries[0]?.params).toHaveLength(50 * 18)
    expect(entryQueries[1]?.params).toHaveLength(18)
    expect(entryQueries[1]?.sql).toContain("VALUES ($1,$2")
    expect(entryQueries[1]?.sql).toContain("$17::jsonb")
  })

  it("skips the entries insert entirely when there are no entries", async () => {
    const client = createMockClient()

    await upsertPiSessionMirror(client, mirrorInput([]))

    expect(client.queries).toHaveLength(1)
    expect(client.queries[0]?.sql).toContain("INSERT INTO pi_sessions")
  })

  it("emits the baseline file mutations SQL and params for one row", async () => {
    const client = createMockClient()

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

    const insertQuery = client.queries.find((query) =>
      query.sql.includes("INSERT INTO pi_file_mutations")
    )
    expect(insertQuery?.sql).toBe(
      "INSERT INTO pi_file_mutations (id, run_id, canonical_path, kind, tool_call_id, event_sequence, before_digest, after_digest, before_size, after_size, summary, recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)"
    )
    expect(insertQuery?.params).toEqual([
      createHash("sha256")
        .update("pi-file-mutation:run-1:package.json")
        .digest("hex")
        .slice(0, 32),
      "run-1",
      "package.json",
      "updated",
      "tool-1",
      2,
      "a",
      "b",
      1,
      2,
      "Updated package.json",
      "2026-05-22T10:02:00.000Z",
    ])
  })

  it("chunks file mutations at 50 rows and only deletes when empty", async () => {
    const client = createMockClient()
    await replacePiFileMutations(client, {
      runId: "run-1",
      recordedAt: "2026-05-22T10:02:00.000Z",
      mutations: Array.from({ length: 51 }, (_, i) => ({
        canonicalPath: `file-${i}.ts`,
        kind: "created" as const,
      })),
    })

    const insertQueries = client.queries.filter((query) =>
      query.sql.includes("INSERT INTO pi_file_mutations")
    )
    expect(insertQueries).toHaveLength(2)
    expect(insertQueries[0]?.params).toHaveLength(50 * 12)
    expect(insertQueries[1]?.params).toHaveLength(12)
    expect(insertQueries[1]?.sql).toContain("VALUES ($1,$2")

    const emptyClient = createMockClient()
    await replacePiFileMutations(emptyClient, {
      runId: "run-1",
      recordedAt: "2026-05-22T10:02:00.000Z",
      mutations: [],
    })
    expect(emptyClient.queries).toEqual([
      {
        sql: "DELETE FROM pi_file_mutations WHERE run_id = $1",
        params: ["run-1"],
      },
    ])
  })
})
