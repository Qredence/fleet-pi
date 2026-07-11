import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { recoverOwnedSessionFile } from "../pi-session-recovery"

import { resolveOwnedMirrorSession } from "../pi-session-ownership-db"
import type * as PiSessionOwnershipDbModule from "../pi-session-ownership-db"

const { poolQuery, withUserContext, getChatPostgresPool } = vi.hoisted(() => {
  const poolQuery = vi.fn()
  const withUserContext = vi.fn(
    async (
      _pool: unknown,
      _userId: string | undefined,
      handler: (client: { query: typeof poolQuery }) => Promise<unknown>
    ) => handler({ query: poolQuery })
  )
  const getChatPostgresPool = vi.fn(() => ({}))
  return { poolQuery, withUserContext, getChatPostgresPool }
})

vi.mock("@neondatabase/serverless", () => ({
  Pool: class MockPool {},
}))

vi.mock("../pi-session-ownership-db", async (importOriginal) => {
  const actual = await importOriginal<typeof PiSessionOwnershipDbModule>()
  return {
    ...actual,
    getChatPostgresPool,
    withUserContext,
    isPiSessionMirrorEnabled: vi.fn(() => true),
    resolveOwnedMirrorSession: vi.fn(),
  }
})

describe("recoverOwnedSessionFile", () => {
  let sessionDir: string
  const originalChatUrl = process.env.FLEET_PI_CHAT_DATABASE_URL

  beforeEach(() => {
    sessionDir = mkdtempSync(join(tmpdir(), "fleet-pi-recovery-"))
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://example"
    poolQuery.mockReset()
    withUserContext.mockClear()
    vi.mocked(resolveOwnedMirrorSession).mockReset()
  })

  afterEach(() => {
    rmSync(sessionDir, { recursive: true, force: true })
    if (originalChatUrl === undefined) {
      delete process.env.FLEET_PI_CHAT_DATABASE_URL
    } else {
      process.env.FLEET_PI_CHAT_DATABASE_URL = originalChatUrl
    }
  })

  it("reconstructs JSONL from mirrored entries when disk copy is missing", async () => {
    vi.mocked(resolveOwnedMirrorSession).mockResolvedValue({
      id: "session-1",
      user_id: "user-1",
      session_file_path: join(sessionDir, "missing.jsonl"),
      cwd: "/repo",
      version: 1,
      parent_session_file_path: null,
      name: null,
    })

    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          entry_id: "entry-1",
          parent_entry_id: null,
          raw_entry: {
            type: "message",
            id: "entry-1",
            parentId: null,
            timestamp: "2026-07-10T12:00:00.000Z",
            message: {
              role: "user",
              content: [{ type: "text", text: "hello" }],
            },
          },
          entry_timestamp: "2026-07-10T12:00:00.000Z",
        },
      ],
    })

    const result = await recoverOwnedSessionFile({
      sessionId: "session-1",
      userId: "user-1",
      sessionDir,
    })

    expect(result.recovered).toBe(true)
    expect(result.sessionFile).toBe(join(sessionDir, "missing.jsonl"))
    expect(existsSync(result.sessionFile!)).toBe(true)
  })

  it("resolves owned sessions by sessionFile path", async () => {
    const sessionFile = join(sessionDir, "owned.jsonl")
    writeFileSync(sessionFile, '{"type":"session"}\n', "utf8")
    vi.mocked(resolveOwnedMirrorSession).mockResolvedValue({
      id: "session-file-1",
      user_id: "user-1",
      session_file_path: sessionFile,
      cwd: "/repo",
      version: 1,
      parent_session_file_path: null,
      name: null,
    })

    const result = await recoverOwnedSessionFile({
      sessionFile,
      userId: "user-1",
      sessionDir,
    })

    expect(resolveOwnedMirrorSession).toHaveBeenCalledWith({
      sessionFile,
      userId: "user-1",
    })
    expect(result.recovered).toBe(true)
    expect(result.reason).toBe("existing-jsonl")
  })

  it("rejects orphan sessions", async () => {
    vi.mocked(resolveOwnedMirrorSession).mockResolvedValue(undefined)

    const result = await recoverOwnedSessionFile({
      sessionId: "session-orphan",
      userId: "user-1",
      sessionDir,
    })

    expect(result.recovered).toBe(false)
    expect(result.reason).toBe("session-not-owned-or-missing")
  })

  it("does not trust mirrored paths that only share the sessionDir prefix", async () => {
    const evilDir = `${sessionDir}-evil`
    vi.mocked(resolveOwnedMirrorSession).mockResolvedValue({
      id: "session-1",
      user_id: "user-1",
      session_file_path: join(evilDir, "hijack.jsonl"),
      cwd: "/repo",
      version: 1,
      parent_session_file_path: null,
      name: null,
    })

    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          entry_id: "entry-1",
          parent_entry_id: null,
          raw_entry: {
            type: "message",
            id: "entry-1",
            parentId: null,
            timestamp: "2026-07-10T12:00:00.000Z",
            message: {
              role: "user",
              content: [{ type: "text", text: "hello" }],
            },
          },
          entry_timestamp: "2026-07-10T12:00:00.000Z",
        },
      ],
    })

    const result = await recoverOwnedSessionFile({
      sessionId: "session-1",
      userId: "user-1",
      sessionDir,
    })

    expect(result.recovered).toBe(true)
    expect(result.sessionFile).toBe(join(sessionDir, "session-1.jsonl"))
    expect(existsSync(join(evilDir, "hijack.jsonl"))).toBe(false)
  })
})
