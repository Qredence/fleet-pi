import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  isUserScopedEphemeralSessionFile,
  verifyRunOwnership,
  verifySessionOwnership,
} from "../pi-session-ownership-db"

const poolQuery = vi.hoisted(() => vi.fn())
const clientRelease = vi.hoisted(() => vi.fn())
const poolConnect = vi.hoisted(() =>
  vi.fn(async () => ({
    query: poolQuery,
    release: clientRelease,
  }))
)
const existsSync = vi.hoisted(() => vi.fn(() => false))

vi.mock("node:fs", () => ({
  existsSync,
  statSync: vi.fn(() => ({ isFile: () => true })),
}))

vi.mock("@neondatabase/serverless", () => ({
  Pool: class MockPool {
    connect = poolConnect
    query = poolQuery
  },
}))

const originalVercel = process.env.VERCEL
const originalChatUrl = process.env.FLEET_PI_CHAT_DATABASE_URL

afterEach(() => {
  vi.clearAllMocks()
  if (originalVercel === undefined) {
    delete process.env.VERCEL
  } else {
    process.env.VERCEL = originalVercel
  }
  if (originalChatUrl === undefined) {
    delete process.env.FLEET_PI_CHAT_DATABASE_URL
  } else {
    process.env.FLEET_PI_CHAT_DATABASE_URL = originalChatUrl
  }
})

describe("pi-session-ownership-db", () => {
  beforeEach(() => {
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://example"
    poolQuery.mockReset()
    poolConnect.mockClear()
    clientRelease.mockClear()
    existsSync.mockReset()
    existsSync.mockReturnValue(false)
  })

  it("verifyRunOwnership returns true when mirror row exists under RLS", async () => {
    poolQuery.mockResolvedValueOnce({ rows: [{ id: "run-1" }] })

    await expect(verifyRunOwnership("run-1", "user-1")).resolves.toBe(true)
    expect(poolConnect).toHaveBeenCalled()
  })

  it("verifyRunOwnership fails closed on Vercel when lookup fails", async () => {
    process.env.VERCEL = "1"
    poolConnect.mockRejectedValueOnce(new Error("db down"))

    await expect(verifyRunOwnership("run-1", "user-1")).resolves.toBe(false)
  })

  it("verifySessionOwnership denies missing mirror rows without user-scoped JSONL", async () => {
    process.env.VERCEL = "1"
    poolQuery.mockResolvedValueOnce({ rows: [{ status: "missing" }] })

    await expect(
      verifySessionOwnership("session-1", "user-1", {
        sessionFile: "/tmp/.fleet/sessions/user-1/session.jsonl",
      })
    ).resolves.toBe(false)
  })

  it("verifySessionOwnership allows missing mirror rows when user-scoped JSONL exists", async () => {
    process.env.VERCEL = "1"
    existsSync.mockReturnValue(true)
    poolQuery.mockResolvedValueOnce({ rows: [{ status: "missing" }] })

    await expect(
      verifySessionOwnership("session-1", "user-1", {
        sessionFile: "/tmp/.fleet/sessions/user-1/session.jsonl",
      })
    ).resolves.toBe(true)
  })

  it("isUserScopedEphemeralSessionFile rejects paths outside the user session dir", () => {
    expect(
      isUserScopedEphemeralSessionFile(
        "/tmp/.fleet/sessions/other-user/session.jsonl",
        "user-1"
      )
    ).toBe(false)
  })

  it("isUserScopedEphemeralSessionFile rejects the user session directory itself", () => {
    expect(
      isUserScopedEphemeralSessionFile("/tmp/.fleet/sessions/user-1", "user-1")
    ).toBe(false)
  })

  it("isUserScopedEphemeralSessionFile rejects non-jsonl paths", () => {
    existsSync.mockReturnValue(true)
    expect(
      isUserScopedEphemeralSessionFile(
        "/tmp/.fleet/sessions/user-1/notes.txt",
        "user-1"
      )
    ).toBe(false)
  })
})
