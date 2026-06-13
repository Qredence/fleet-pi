import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
