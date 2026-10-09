import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ChatSessionInfo } from "@workspace/pi-protocol/chat-protocol"
import type { PiSessionSummaryRow } from "@/lib/db/pi-session-mirror"

const SessionManager = {
  create: vi.fn(),
  list: vi.fn(),
  open: vi.fn(),
}

vi.mock("@earendil-works/pi-coding-agent", () => ({
  SessionManager,
}))

describe("createSessionManager", () => {
  let repoRoot = ""
  let outsideRoot = ""
  let sessionDir = ""
  let sessionFileA = ""
  let sessionFileB = ""
  let outsideSessionFile = ""

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "fleet-pi-server-sessions-"))
    outsideRoot = mkdtempSync(join(tmpdir(), "fleet-pi-server-sessions-out-"))
    sessionDir = join(repoRoot, ".fleet", "sessions")
    mkdirSync(sessionDir, { recursive: true })

    sessionFileA = join(sessionDir, "session-a.jsonl")
    sessionFileB = join(sessionDir, "session-b.jsonl")
    outsideSessionFile = join(outsideRoot, "outside.jsonl")

    writeFileSync(sessionFileA, "")
    writeFileSync(sessionFileB, "")
    writeFileSync(outsideSessionFile, "")

    SessionManager.create.mockReset()
    SessionManager.list.mockReset()
    SessionManager.open.mockReset()
  })

  afterEach(() => {
    vi.resetModules()
    rmSync(repoRoot, { force: true, recursive: true })
    rmSync(outsideRoot, { force: true, recursive: true })
  })

  it("resets instead of falling back to sessionId when sessionFile is outside", async () => {
    const freshSessionManager = { kind: "fresh" }
    SessionManager.create.mockReturnValue(freshSessionManager)
    SessionManager.list.mockResolvedValue([
      { id: "still-valid", path: sessionFileA },
    ])

    const { createSessionManager } = await import("./server-sessions")

    const result = await createSessionManager(
      {
        sessionFile: outsideSessionFile,
        sessionId: "still-valid",
      },
      repoRoot,
      sessionDir
    )

    expect(result).toEqual({
      sessionManager: freshSessionManager,
      sessionReset: true,
    })
    expect(SessionManager.list).not.toHaveBeenCalled()
    expect(SessionManager.open).not.toHaveBeenCalled()
  })

  it("prefers a provided sessionFile over a conflicting sessionId", async () => {
    const openedSessionManager = { kind: "opened-from-file" }
    SessionManager.open.mockReturnValue(openedSessionManager)
    SessionManager.list.mockResolvedValue([
      { id: "other-session", path: sessionFileB },
    ])

    const { createSessionManager } = await import("./server-sessions")

    const result = await createSessionManager(
      {
        sessionFile: sessionFileA,
        sessionId: "other-session",
      },
      repoRoot,
      sessionDir
    )

    expect(result).toEqual({
      sessionManager: openedSessionManager,
      sessionReset: false,
    })
    expect(SessionManager.list).not.toHaveBeenCalled()
    expect(SessionManager.open).toHaveBeenCalledWith(
      sessionFileA,
      sessionDir,
      repoRoot
    )
  })

  it("uses sessionId lookup when no sessionFile is provided", async () => {
    const openedSessionManager = { kind: "opened-from-id" }
    SessionManager.list.mockResolvedValue([
      { id: "session-from-id", path: sessionFileB },
    ])
    SessionManager.open.mockReturnValue(openedSessionManager)

    const { createSessionManager } = await import("./server-sessions")

    const result = await createSessionManager(
      { sessionId: "session-from-id" },
      repoRoot,
      sessionDir
    )

    expect(result).toEqual({
      sessionManager: openedSessionManager,
      sessionReset: false,
    })
    expect(SessionManager.list).toHaveBeenCalledWith(repoRoot, sessionDir)
    expect(SessionManager.open).toHaveBeenCalledWith(
      sessionFileB,
      sessionDir,
      repoRoot
    )
  })

  it("creates a fresh session when no metadata is supplied", async () => {
    const freshSessionManager = { kind: "fresh-without-metadata" }
    SessionManager.create.mockReturnValue(freshSessionManager)

    const { createSessionManager } = await import("./server-sessions")

    const result = await createSessionManager({}, repoRoot, sessionDir)

    expect(result).toEqual({
      sessionManager: freshSessionManager,
      sessionReset: false,
    })
    expect(SessionManager.create).toHaveBeenCalledWith(repoRoot, sessionDir)
    expect(SessionManager.list).not.toHaveBeenCalled()
    expect(SessionManager.open).not.toHaveBeenCalled()
  })

  it("creates a reset session when the requested session cannot be opened", async () => {
    const freshSessionManager = { kind: "fresh-after-open-failure" }
    SessionManager.open.mockReturnValue(undefined)
    SessionManager.create.mockReturnValue(freshSessionManager)

    const { createSessionManager } = await import("./server-sessions")

    const result = await createSessionManager(
      { sessionFile: sessionFileA },
      repoRoot,
      sessionDir
    )

    expect(result).toEqual({
      sessionManager: freshSessionManager,
      sessionReset: true,
    })
    expect(SessionManager.open).toHaveBeenCalledWith(
      sessionFileA,
      sessionDir,
      repoRoot
    )
  })

  it("rejects missing, outside, and unresolved session files", async () => {
    const { isUsableSessionFile, resolveSessionFile } =
      await import("./server-sessions")

    await expect(
      resolveSessionFile(
        { sessionFile: join(sessionDir, "missing.jsonl") },
        repoRoot,
        sessionDir
      )
    ).resolves.toBeUndefined()
    await expect(
      resolveSessionFile(
        { sessionFile: outsideSessionFile },
        repoRoot,
        sessionDir
      )
    ).resolves.toBeUndefined()
    expect(isUsableSessionFile(sessionFileA, sessionDir)).toBe(true)
    expect(isUsableSessionFile(outsideSessionFile, sessionDir)).toBe(false)
    expect(
      isUsableSessionFile(sessionFileA, join(repoRoot, "missing-dir"))
    ).toBe(false)
  })

  it("returns session metadata from a session manager", async () => {
    const { toSessionMetadata } = await import("./server-sessions")

    expect(
      toSessionMetadata({
        getSessionFile: () => sessionFileA,
        getSessionId: () => "session-a",
      } as never)
    ).toEqual({
      sessionFile: sessionFileA,
      sessionId: "session-a",
    })
  })
})

describe("mergeChatSessionLists", () => {
  const local = (
    id: string,
    modified: string,
    messageCount = 2
  ): ChatSessionInfo => ({
    path: `/sessions/${id}.jsonl`,
    id,
    cwd: "/repo",
    created: "2026-05-22T09:00:00.000Z",
    modified,
    messageCount,
    firstMessage: `local ${id}`,
  })
  const mirror = (
    id: string,
    updatedAt: string,
    messageCount = 2
  ): PiSessionSummaryRow => ({
    id,
    session_file_path: `/old/${id}.jsonl`,
    cwd: "/repo",
    name: null,
    first_message_preview: `mirror ${id}`,
    message_count: messageCount,
    created_at: new Date("2026-05-22T09:00:00.000Z"),
    updated_at: updatedAt,
  })

  it("adds mirror-only sessions so history survives a missing local JSONL", async () => {
    const { mergeChatSessionLists } = await import("./server-sessions")

    const result = mergeChatSessionLists(
      [],
      [mirror("from-neon", "2026-05-22T10:00:00.000Z")]
    )

    expect(result).toEqual([
      {
        path: "/old/from-neon.jsonl",
        id: "from-neon",
        cwd: "/repo",
        created: "2026-05-22T09:00:00.000Z",
        modified: "2026-05-22T10:00:00.000Z",
        messageCount: 2,
        firstMessage: "mirror from-neon",
      },
    ])
  })

  it("prefers the local working copy when both exist and hides unowned local files", async () => {
    const { mergeChatSessionLists } = await import("./server-sessions")

    const result = mergeChatSessionLists(
      [
        local("both", "2026-05-22T12:00:00.000Z", 5),
        local("not-owned", "2026-05-22T13:00:00.000Z"),
      ],
      [
        mirror("both", "2026-05-22T11:00:00.000Z", 3),
        mirror("neon-only", "2026-05-22T11:30:00.000Z"),
      ]
    )

    expect(result.map((s) => [s.id, s.firstMessage, s.messageCount])).toEqual([
      ["both", "local both", 5],
      ["neon-only", "mirror neon-only", 2],
    ])
  })

  it("skips empty mirror-only sessions and sorts newest first", async () => {
    const { mergeChatSessionLists } = await import("./server-sessions")

    const result = mergeChatSessionLists(
      [],
      [
        mirror("older", "2026-05-20T10:00:00.000Z"),
        mirror("empty", "2026-05-23T10:00:00.000Z", 0),
        mirror("newer", "2026-05-22T10:00:00.000Z"),
      ]
    )

    expect(result.map((s) => s.id)).toEqual(["newer", "older"])
  })
})
