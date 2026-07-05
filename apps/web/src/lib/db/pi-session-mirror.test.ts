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
import type { PostgresQueryClient } from "./pi-session-mirror"
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

    expect(client.queries).toHaveLength(2)
    expect(client.queries[0]?.sql).toContain("INSERT INTO pi_sessions")
    expect(client.queries[1]?.sql).toContain("INSERT INTO pi_session_entries")
    expect(client.queries[1]?.params[16]).toBe(
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

  it("throws fatal error on mirror sync failures on Vercel", async () => {
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://mirror.test/fleet"
    process.env.VERCEL = "1"
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined)

    try {
      await expect(
        syncPiSessionMirrorSafely({
          getHeader() {
            throw new Error("boom vercel")
          },
        } as never)
      ).rejects.toThrow(
        "Fatal session mirror synchronization failure on Vercel: boom vercel"
      )

      expect(errorSpy).toHaveBeenCalledWith(
        {
          error: expect.objectContaining({ message: "boom vercel" }),
        },
        "[pi-session-mirror] fatal sync failure on Vercel"
      )
    } finally {
      delete process.env.VERCEL
    }
  })
})
