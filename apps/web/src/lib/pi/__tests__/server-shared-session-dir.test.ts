import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it } from "vitest"
import { getSessionDir } from "../server-shared"
import { runWithChatAuthSurface } from "@/lib/auth/chat-auth-surface"

const originalHosted = process.env.FLEET_PI_DEPLOYMENT

afterEach(() => {
  if (originalHosted === undefined) {
    delete process.env.FLEET_PI_DEPLOYMENT
  } else {
    process.env.FLEET_PI_DEPLOYMENT = originalHosted
  }
})

describe("getSessionDir", () => {
  const services = {
    settingsManager: {
      getSessionDir: () => ".fleet/sessions",
    },
  } as never

  it("isolates hosted session directories per authenticated user", () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
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

  it("isolates Neon Function session directories per authenticated user", () => {
    delete process.env.FLEET_PI_DEPLOYMENT
    const userA = runWithChatAuthSurface("neon-function", () =>
      getSessionDir("/repo", services, { userId: "user-a" })
    )
    const userB = runWithChatAuthSurface("neon-function", () =>
      getSessionDir("/repo", services, { userId: "user-b" })
    )

    expect(userA).toBe("/tmp/.fleet/sessions/user-a")
    expect(userB).toBe("/tmp/.fleet/sessions/user-b")
    rmSync("/tmp/.fleet/sessions/user-a", { recursive: true, force: true })
    rmSync("/tmp/.fleet/sessions/user-b", { recursive: true, force: true })
  })

  it("uses the shared fallback directory on Cloudflare when userId is absent", () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    expect(getSessionDir("/repo", services)).toBe("/tmp/.fleet/sessions")
  })

  it("uses project-scoped session dirs outside Cloudflare", () => {
    delete process.env.FLEET_PI_DEPLOYMENT
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
