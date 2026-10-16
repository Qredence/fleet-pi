import { afterEach, describe, expect, it, vi } from "vitest"
import { runWithChatAuthSurface } from "../../auth/chat-auth-surface"
import { logger } from "../../logger"
import {
  appendPiRunEvent,
  appendPiRunEvents,
  finalizePiRun,
  insertPiRunStart,
  mapSessionEntryToMirrorRow,
  replacePiFileMutations,
  syncPiSessionMirrorSafely,
  upsertPiSessionMirror,
  upsertPiToolExecution,
} from "../pi-session-mirror"
import {
  createMockClient,
  entryBase,
  header,
} from "./pi-session-mirror-fixtures"

const originalChatDatabaseUrl = process.env.FLEET_PI_CHAT_DATABASE_URL

afterEach(() => {
  process.env.FLEET_PI_CHAT_DATABASE_URL = originalChatDatabaseUrl
  vi.restoreAllMocks()
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
    // Skip-unchanged guard: unchanged canonical entries must not be rewritten.
    expect(entriesQuery?.sql).toContain(
      "WHERE pi_session_entries.raw_entry IS DISTINCT FROM EXCLUDED.raw_entry"
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

  it("batches multiple run events into one chunked INSERT", async () => {
    const client = createMockClient()

    await appendPiRunEvents(client, [
      {
        runId: "run-1",
        sequence: 1,
        eventType: "tool",
        summary: "Read",
        payload: { type: "tool", value: 1 },
        recordedAt: "2026-05-22T10:00:01.000Z",
      },
      {
        runId: "run-1",
        sequence: 2,
        eventType: "delta",
        summary: null,
        payload: { type: "delta", text: "hi" },
        recordedAt: "2026-05-22T10:00:02.000Z",
      },
      {
        runId: "run-1",
        sequence: 3,
        eventType: "done",
        summary: "ok",
        payload: { type: "done" },
        recordedAt: "2026-05-22T10:00:03.000Z",
      },
    ])

    const eventQueries = client.queries.filter((query) =>
      query.sql.includes("INSERT INTO pi_run_events")
    )
    expect(eventQueries).toHaveLength(1)
    const sql = eventQueries[0]?.sql ?? ""
    const params = eventQueries[0]?.params ?? []
    expect(sql).toContain(
      "($1,$2,$3,$4,$5::jsonb,$6),($7,$8,$9,$10,$11::jsonb,$12),($13,$14,$15,$16,$17::jsonb,$18)"
    )
    expect(sql).toContain("ON CONFLICT (run_id, sequence) DO UPDATE SET")
    expect(params).toHaveLength(18)
    expect(params[0]).toBe("run-1")
    expect(params[1]).toBe(1)
    expect(params[7]).toBe(2)
    expect(params[13]).toBe(3)
    expect(params[4]).toBe('{"type":"tool","value":1}')
  })

  it("requires userId when inserting runs on Cloudflare", async () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
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

    delete process.env.FLEET_PI_DEPLOYMENT
  })

  it("fails the turn when mirror sync fails on the Neon Function", async () => {
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://mirror.test/fleet"
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined)

    await expect(
      runWithChatAuthSurface("neon-function", () =>
        syncPiSessionMirrorSafely(
          {
            getHeader() {
              throw new Error("boom function")
            },
          } as never,
          { userId: "user-function" }
        )
      )
    ).rejects.toThrow("boom function")

    expect(errorSpy).toHaveBeenCalledWith(
      {
        error: expect.objectContaining({ message: "boom function" }),
      },
      "[pi-session-mirror] sync failure; failing the turn"
    )
  })

  it("fails the turn when mirror sync fails on Cloudflare", async () => {
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://mirror.test/fleet"
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined)

    try {
      await expect(
        syncPiSessionMirrorSafely(
          {
            getHeader() {
              throw new Error("boom cloudflare")
            },
          } as never,
          { userId: "user-cloudflare" }
        )
      ).rejects.toThrow("boom cloudflare")
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      delete process.env.FLEET_PI_DEPLOYMENT
    }
  })
})
