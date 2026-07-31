import Database from "better-sqlite3"
import { describe, expect, it, vi } from "vitest"
import {
  CompositeProvenanceSink,
  PostgresMirrorSink,
  SqliteProvenanceSink,
} from "../provenance-sink"
import {
  ensureWorkspaceProvenanceSchema,
  getRunDetail,
} from "../workspace-provenance"
import type {
  ProvenanceFileMutationsInput,
  ProvenanceFinalizeRunInput,
  ProvenanceRunEventInput,
  ProvenanceRunStartInput,
  ProvenanceSink,
  ProvenanceToolExecutionInput,
} from "../provenance-sink"
import type { PostgresQueryClient } from "../pi-session-mirror"
import type { WorkspaceProvenanceConnection } from "../workspace-provenance"

const runStartInput: ProvenanceRunStartInput = {
  runId: "run-1",
  assistantMessageId: "run-1",
  sessionId: "session-1",
  sessionFile: "sessions/session-1.jsonl",
  mode: "agent",
  startedAt: "2026-05-22T10:00:00.000Z",
}

const eventInput: ProvenanceRunEventInput = {
  runId: "run-1",
  sequence: 1,
  eventType: "tool",
  summary: "tool-Write (output-available)",
  payload: { type: "tool", toolCallId: "tool-1" },
  recordedAt: "2026-05-22T10:00:01.000Z",
}

const toolExecutionInput: ProvenanceToolExecutionInput = {
  sessionId: "session-1",
  runId: "run-1",
  toolCallId: "tool-1",
  toolName: "Write",
  state: "output-available",
  isError: false,
  input: { file_path: "agent-workspace/scratch/t.txt" },
  output: { ok: true },
  claimedPaths: ["agent-workspace/scratch/t.txt"],
  firstSequence: 1,
  lastSequence: 1,
}

const mutationsInput: ProvenanceFileMutationsInput = {
  runId: "run-1",
  recordedAt: "2026-05-22T10:00:02.000Z",
  mutations: [
    {
      canonicalPath: "agent-workspace/scratch/t.txt",
      kind: "created",
      toolCallId: "tool-1",
      eventSequence: 1,
      afterDigest: "digest-after",
      afterSize: 5,
      summary: "Created agent-workspace/scratch/t.txt (5 bytes)",
    },
  ],
}

const finalizeInput: ProvenanceFinalizeRunInput = {
  runId: "run-1",
  status: "completed",
  assistantPreview: "done",
  errorMessage: null,
  completedAt: "2026-05-22T10:00:03.000Z",
}

function createSqliteConnection(): WorkspaceProvenanceConnection {
  const db = new Database(":memory:")
  ensureWorkspaceProvenanceSchema(db)
  return {
    db,
    databasePath: ":memory:",
    created: true,
    close: () => {
      if (db.open) {
        db.close()
      }
    },
  }
}

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

type EnqueuedOperation = {
  operation: (client: PostgresQueryClient) => Promise<void>
  userId?: string
}

function createRecordingQueue() {
  const operations: Array<EnqueuedOperation> = []
  return {
    operations,
    enabled: true as const,
    enqueue: (
      operation: (client: PostgresQueryClient) => Promise<void>,
      userId?: string
    ): Promise<void> => {
      operations.push({ operation, userId })
      return Promise.resolve()
    },
    close: vi.fn(() => Promise.resolve()),
  }
}

describe("SqliteProvenanceSink", () => {
  it("persists a full run lifecycle through the SQLite projection", () => {
    const connection = createSqliteConnection()
    const sink = new SqliteProvenanceSink(connection)

    sink.insertRunStart(runStartInput)
    sink.appendRunEvent(eventInput)
    sink.upsertToolExecution(toolExecutionInput)
    sink.replaceFileMutations(mutationsInput)
    sink.finalizeRun(finalizeInput)

    const detail = getRunDetail(connection.db, "run-1")
    expect(detail?.run).toEqual(
      expect.objectContaining({
        runId: "run-1",
        sessionId: "session-1",
        sessionTurnIndex: 1,
        status: "completed",
        eventCount: 1,
        toolCallCount: 1,
        mutationCount: 1,
        assistantPreview: "done",
      })
    )
    expect(detail?.events).toEqual([
      expect.objectContaining({ runId: "run-1", sequence: 1 }),
    ])
    expect(detail?.toolCalls).toEqual([
      expect.objectContaining({ toolCallId: "tool-1", toolName: "Write" }),
    ])
    expect(detail?.mutations).toEqual([
      expect.objectContaining({
        canonicalPath: "agent-workspace/scratch/t.txt",
        toolCallId: "tool-1",
      }),
    ])

    sink.close()
    expect(connection.db.open).toBe(false)
  })

  it("turn indexes advance across runs within one session", () => {
    const connection = createSqliteConnection()
    const sink = new SqliteProvenanceSink(connection)

    sink.insertRunStart(runStartInput)
    sink.insertRunStart({ ...runStartInput, runId: "run-2" })

    expect(getRunDetail(connection.db, "run-1")?.run.sessionTurnIndex).toBe(1)
    expect(getRunDetail(connection.db, "run-2")?.run.sessionTurnIndex).toBe(2)

    sink.close()
  })
})

describe("PostgresMirrorSink", () => {
  it("enqueues run-start mirroring with the sink's cwd and userId", async () => {
    const queue = createRecordingQueue()
    const sink = new PostgresMirrorSink(queue, {
      cwd: "/repo",
      userId: "user-1",
    })

    sink.insertRunStart(runStartInput)

    expect(queue.operations).toHaveLength(1)
    expect(queue.operations[0]?.userId).toBe("user-1")

    const client = createMockClient()
    await queue.operations[0]?.operation(client)

    const stubQuery = client.queries.find((query) =>
      query.sql.includes("INSERT INTO pi_sessions")
    )
    expect(stubQuery?.params).toContain("session-1")
    expect(stubQuery?.params).toContain("user-1")
    expect(stubQuery?.params).toContain("/repo")

    const runQuery = client.queries.find((query) =>
      query.sql.includes("INSERT INTO pi_runs")
    )
    expect(runQuery?.params).toContain("run-1")
  })

  it("enqueues run events, tool executions, mutations, and finalization", async () => {
    const queue = createRecordingQueue()
    const sink = new PostgresMirrorSink(queue, {
      cwd: "/repo",
      userId: "user-1",
    })

    sink.insertRunStart(runStartInput)
    sink.appendRunEvent(eventInput)
    sink.upsertToolExecution(toolExecutionInput)
    sink.replaceFileMutations(mutationsInput)
    sink.finalizeRun(finalizeInput)

    expect(queue.operations).toHaveLength(5)
    expect(queue.operations.map((operation) => operation.userId)).toEqual([
      "user-1",
      "user-1",
      "user-1",
      "user-1",
      "user-1",
    ])

    const client = createMockClient()
    for (const operation of queue.operations) {
      await operation.operation(client)
    }

    const eventQuery = client.queries.find((query) =>
      query.sql.includes("INSERT INTO pi_run_events")
    )
    expect(eventQuery?.params[0]).toBe("run-1")
    expect(eventQuery?.params[1]).toBe(1)

    const toolQuery = client.queries.find((query) =>
      query.sql.includes("INSERT INTO pi_tool_executions")
    )
    expect(toolQuery?.params).toContain("session-1")
    expect(toolQuery?.params).toContain("run-1")
    expect(toolQuery?.params).toContain("tool-1")

    const deleteMutationsQuery = client.queries.find((query) =>
      query.sql.includes("DELETE FROM pi_file_mutations")
    )
    expect(deleteMutationsQuery?.params).toEqual(["run-1"])

    const insertMutationsQuery = client.queries.find((query) =>
      query.sql.includes("INSERT INTO pi_file_mutations")
    )
    expect(insertMutationsQuery?.params).toContain(
      "agent-workspace/scratch/t.txt"
    )

    const finalizeQuery = client.queries.find((query) =>
      query.sql.includes("UPDATE pi_runs")
    )
    expect(finalizeQuery?.params).toEqual([
      "run-1",
      "completed",
      "done",
      null,
      "2026-05-22T10:00:03.000Z",
    ])

    await sink.close()
    expect(queue.close).toHaveBeenCalledTimes(1)
  })

  it("stays inert against a disabled queue (mirror off, anonymous mode)", async () => {
    const queue = {
      enabled: false as const,
      enqueue: (_operation: (client: PostgresQueryClient) => Promise<void>) =>
        undefined,
      close: () => Promise.resolve(),
    }
    const sink = new PostgresMirrorSink(queue, { cwd: "/repo" })

    expect(() => {
      sink.insertRunStart(runStartInput)
      sink.appendRunEvent(eventInput)
      sink.upsertToolExecution(toolExecutionInput)
      sink.replaceFileMutations(mutationsInput)
      sink.finalizeRun(finalizeInput)
    }).not.toThrow()
    await expect(sink.close()).resolves.toBeUndefined()
  })
})

function createRecordingSink(
  name: string,
  calls: Array<string>
): ProvenanceSink & { finalizedWith: Array<string> } {
  const finalizedWith: Array<string> = []
  return {
    finalizedWith,
    insertRunStart: vi.fn(() => {
      calls.push(`${name}:insertRunStart`)
    }),
    appendRunEvent: vi.fn(() => {
      calls.push(`${name}:appendRunEvent`)
    }),
    upsertToolExecution: vi.fn(() => {
      calls.push(`${name}:upsertToolExecution`)
    }),
    replaceFileMutations: vi.fn(() => {
      calls.push(`${name}:replaceFileMutations`)
    }),
    finalizeRun: vi.fn((input: ProvenanceFinalizeRunInput) => {
      finalizedWith.push(input.runId)
      calls.push(`${name}:finalizeRun`)
    }),
    close: vi.fn(() => {
      calls.push(`${name}:close`)
      return Promise.resolve()
    }),
  }
}

describe("CompositeProvenanceSink", () => {
  it("fans out each method to every sink in order with the same input", async () => {
    const calls: Array<string> = []
    const first = createRecordingSink("sqlite", calls)
    const second = createRecordingSink("postgres", calls)
    const composite = new CompositeProvenanceSink([first, second])

    composite.insertRunStart(runStartInput)
    composite.appendRunEvent(eventInput)
    composite.upsertToolExecution(toolExecutionInput)
    composite.replaceFileMutations(mutationsInput)
    composite.finalizeRun(finalizeInput)
    await composite.close()

    expect(calls).toEqual([
      "sqlite:insertRunStart",
      "postgres:insertRunStart",
      "sqlite:appendRunEvent",
      "postgres:appendRunEvent",
      "sqlite:upsertToolExecution",
      "postgres:upsertToolExecution",
      "sqlite:replaceFileMutations",
      "postgres:replaceFileMutations",
      "sqlite:finalizeRun",
      "postgres:finalizeRun",
      "sqlite:close",
      "postgres:close",
    ])
    expect(first.insertRunStart).toHaveBeenCalledWith(runStartInput)
    expect(second.insertRunStart).toHaveBeenCalledWith(runStartInput)
    expect(first.upsertToolExecution).toHaveBeenCalledWith(toolExecutionInput)
    expect(second.upsertToolExecution).toHaveBeenCalledWith(toolExecutionInput)
  })

  it("surfaces a failure from an earlier sink without calling later sinks", () => {
    const calls: Array<string> = []
    const failing = createRecordingSink("sqlite", calls)
    const skipped = createRecordingSink("postgres", calls)
    failing.appendRunEvent = vi.fn(() => {
      calls.push("sqlite:appendRunEvent")
      throw new Error("projection write failed")
    })
    const composite = new CompositeProvenanceSink([failing, skipped])

    expect(() => composite.appendRunEvent(eventInput)).toThrow(
      "projection write failed"
    )
    expect(skipped.appendRunEvent).not.toHaveBeenCalled()
  })

  it("surfaces a failure from the Postgres position unchanged", () => {
    const calls: Array<string> = []
    const sqlite = createRecordingSink("sqlite", calls)
    const failing = createRecordingSink("postgres", calls)
    failing.finalizeRun = vi.fn(() => {
      throw new Error("mirror exploded")
    })
    const composite = new CompositeProvenanceSink([sqlite, failing])

    expect(() => composite.finalizeRun(finalizeInput)).toThrow(
      "mirror exploded"
    )
    expect(sqlite.finalizeRun).toHaveBeenCalledWith(finalizeInput)
  })

  it("closes every sink in order and awaits async closes", async () => {
    const closeOrder: Array<string> = []
    const first = createRecordingSink("sqlite", closeOrder)
    const second = createRecordingSink("postgres", closeOrder)
    const composite = new CompositeProvenanceSink([first, second])

    await composite.close()

    expect(closeOrder).toEqual(["sqlite:close", "postgres:close"])
  })
})
