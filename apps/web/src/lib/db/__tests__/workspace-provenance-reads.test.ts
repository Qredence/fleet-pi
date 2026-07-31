import Database from "better-sqlite3"
import { describe, expect, it } from "vitest"
import {
  appendRunEvent,
  ensureWorkspaceProvenanceSchema,
  finalizeRun,
  getRunDetail,
  insertRunStart,
  listPathProvenance,
  listSessionRuns,
  replaceRunMutations,
  upsertToolCall,
} from "../workspace-provenance"

function seedCompletedRun(db: Database.Database) {
  insertRunStart(db, {
    runId: "run-1",
    assistantMessageId: "assistant-1",
    sessionId: "session-1",
    sessionFile: "sessions/session-1.jsonl",
    mode: "agent",
    startedAt: "2026-05-22T10:00:00.000Z",
  })
  appendRunEvent(db, {
    runId: "run-1",
    sequence: 1,
    eventType: "tool",
    summary: "tool-Write",
    payload: { type: "tool", path: "agent-workspace/scratch/t.txt" },
    recordedAt: "2026-05-22T10:00:01.000Z",
  })
  upsertToolCall(db, {
    runId: "run-1",
    toolCallId: "tool-1",
    toolName: "Write",
    state: "output-available",
    isError: false,
    input: { file_path: "agent-workspace/scratch/t.txt" },
    output: { ok: true },
    claimedPaths: ["agent-workspace/scratch/t.txt"],
    firstSequence: 2,
    lastSequence: 3,
  })
  replaceRunMutations(db, {
    runId: "run-1",
    recordedAt: "2026-05-22T10:00:02.000Z",
    mutations: [
      {
        canonicalPath: "agent-workspace/scratch/t.txt",
        kind: "created",
        toolCallId: "tool-1",
        eventSequence: 3,
        beforeDigest: null as never,
        afterDigest: "digest-after",
        beforeSize: null as never,
        afterSize: 5,
        summary: "Created agent-workspace/scratch/t.txt",
      },
    ],
  })
  finalizeRun(db, {
    runId: "run-1",
    status: "completed",
    assistantPreview: "done",
    completedAt: "2026-05-22T10:00:03.000Z",
  })
}

function createDb() {
  const db = new Database(":memory:")
  ensureWorkspaceProvenanceSchema(db)
  return db
}

describe("workspace provenance read queries (shared select fragments)", () => {
  it("listSessionRuns returns the full run summary projection", () => {
    const db = createDb()
    seedCompletedRun(db)

    const runs = listSessionRuns(db, { sessionId: "session-1" })
    expect(runs).toEqual([
      {
        runId: "run-1",
        assistantMessageId: "assistant-1",
        sessionId: "session-1",
        sessionFile: "sessions/session-1.jsonl",
        sessionTurnIndex: 1,
        mode: "agent",
        planAction: null,
        status: "completed",
        assistantPreview: "done",
        errorMessage: null,
        eventCount: 1,
        toolCallCount: 1,
        mutationCount: 1,
        startedAt: "2026-05-22T10:00:00.000Z",
        completedAt: "2026-05-22T10:00:03.000Z",
      },
    ])

    expect(
      listSessionRuns(db, { sessionFile: "sessions/session-1.jsonl" })
    ).toHaveLength(1)
    expect(listSessionRuns(db, {})).toEqual([])
    db.close()
  })

  it("getRunDetail returns run, events, tool calls, and joined mutations", () => {
    const db = createDb()
    seedCompletedRun(db)

    const detail = getRunDetail(db, "run-1")
    expect(detail).not.toBeNull()
    expect(detail?.run).toEqual(
      expect.objectContaining({
        runId: "run-1",
        sessionId: "session-1",
        status: "completed",
        eventCount: 1,
        toolCallCount: 1,
        mutationCount: 1,
      })
    )
    expect(detail?.events).toEqual([
      expect.objectContaining({
        runId: "run-1",
        sequence: 1,
        eventType: "tool",
        summary: "tool-Write",
        payload: { type: "tool", path: "agent-workspace/scratch/t.txt" },
        recordedAt: "2026-05-22T10:00:01.000Z",
      }),
    ])
    expect(detail?.toolCalls).toEqual([
      expect.objectContaining({
        toolCallId: "tool-1",
        toolName: "Write",
        state: "output-available",
        isError: false,
        input: { file_path: "agent-workspace/scratch/t.txt" },
        output: { ok: true },
        claimedPaths: ["agent-workspace/scratch/t.txt"],
        firstSequence: 2,
        lastSequence: 3,
      }),
    ])
    expect(detail?.mutations).toEqual([
      expect.objectContaining({
        canonicalPath: "agent-workspace/scratch/t.txt",
        kind: "created",
        toolCallId: "tool-1",
        toolName: "Write",
        eventSequence: 3,
        afterDigest: "digest-after",
        afterSize: 5,
        summary: "Created agent-workspace/scratch/t.txt",
      }),
    ])
    db.close()
  })

  it("listPathProvenance pairs the run summary with the joined mutation row", () => {
    const db = createDb()
    seedCompletedRun(db)

    const records = listPathProvenance(db, "agent-workspace/scratch/t.txt")
    expect(records).toHaveLength(1)
    const [record] = records
    expect(record.run).toEqual({
      runId: "run-1",
      assistantMessageId: "assistant-1",
      sessionId: "session-1",
      sessionFile: "sessions/session-1.jsonl",
      sessionTurnIndex: 1,
      mode: "agent",
      planAction: null,
      status: "completed",
      assistantPreview: "done",
      errorMessage: null,
      eventCount: 1,
      toolCallCount: 1,
      mutationCount: 1,
      startedAt: "2026-05-22T10:00:00.000Z",
      completedAt: "2026-05-22T10:00:03.000Z",
    })
    expect(record.mutation).toEqual(
      expect.objectContaining({
        canonicalPath: "agent-workspace/scratch/t.txt",
        kind: "created",
        toolCallId: "tool-1",
        toolName: "Write",
      })
    )
    expect(listPathProvenance(db, "missing.txt")).toEqual([])
    db.close()
  })
})
