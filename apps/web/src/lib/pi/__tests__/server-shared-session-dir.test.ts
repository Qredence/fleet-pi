import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it } from "vitest"
import { getSessionDir } from "../server-shared"

const originalVercel = process.env.VERCEL

afterEach(() => {
  if (originalVercel === undefined) {
    delete process.env.VERCEL
  } else {
    process.env.VERCEL = originalVercel
  }
})

describe("getSessionDir", () => {
  const services = {
    settingsManager: {
      getSessionDir: () => ".fleet/sessions",
    },
  } as never

  it("isolates Vercel session directories per authenticated user", () => {
    process.env.VERCEL = "1"
    const userA = getSessionDir("/repo", services, { userId: "user-a" })
    const userB = getSessionDir("/repo", services, { userId: "user-b" })

    expect(userA).toBe("/tmp/.fleet/sessions/user-a")
    expect(userB).toBe("/tmp/.fleet/sessions/user-b")
    expect(userA).not.toBe(userB)
    expect(existsSync(userA)).toBe(true)
    expect(existsSync(userB)).toBe(true)

    rmSync("/tmp/.fleet/sessions/user-a", { recursive: true, force: true })
    rmSync("/tmp/.fleet/sessions/user-b", { recursive: true, force: true })
  })

  it("uses the shared fallback directory on Vercel when userId is absent", () => {
    process.env.VERCEL = "1"
    expect(getSessionDir("/repo", services)).toBe("/tmp/.fleet/sessions")
  })

  it("uses project-scoped session dirs outside Vercel", () => {
    delete process.env.VERCEL
    const repoRoot = mkdtempSync(join(tmpdir(), "fleet-pi-session-dir-"))
    try {
      expect(getSessionDir(repoRoot, services)).toBe(
        join(repoRoot, ".fleet", "sessions")
      )
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })
})
