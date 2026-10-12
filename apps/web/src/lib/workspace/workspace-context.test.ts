import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resolveWorkspaceContext } from "./workspace-context"
import { DaytonaCredentialRequiredError } from "@/lib/app-runtime"

const {
  mockExecuteCommand,
  mockGetSession,
  mockResolveUserSandboxContext,
  mockResolveDaytonaRuntimeApiKey,
} = vi.hoisted(() => ({
  mockExecuteCommand: vi.fn(),
  mockGetSession: vi.fn(),
  mockResolveUserSandboxContext: vi.fn(),
  mockResolveDaytonaRuntimeApiKey: vi.fn(),
}))

vi.mock("@/lib/auth/server", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}))

vi.mock("@/lib/daytona/resolve-user-sandbox-context", () => ({
  resolveUserSandboxContext: mockResolveUserSandboxContext,
}))

vi.mock("@/lib/pi/runtime/user-provider-secrets", () => ({
  resolveDaytonaRuntimeApiKey: mockResolveDaytonaRuntimeApiKey,
}))

vi.mock("@/lib/daytona/client", () => ({
  executeCommand: mockExecuteCommand,
}))

vi.mock("@/lib/daytona/user-sandbox", () => ({
  isDaytonaEnabled: (userId?: string) =>
    Boolean(userId) && Boolean(process.env.DAYTONA_API_KEY),
}))

const originalAuthDatabaseUrl = process.env.FLEET_PI_AUTH_DATABASE_URL
const originalDaytonaApiKey = process.env.DAYTONA_API_KEY
const originalRepoRoot = process.env.FLEET_PI_REPO_ROOT
const originalVercel = process.env.VERCEL
const roots = new Set<string>()

beforeEach(() => {
  delete process.env.FLEET_PI_AUTH_DATABASE_URL
  delete process.env.DAYTONA_API_KEY
  delete process.env.FLEET_PI_REPO_ROOT
  delete process.env.VERCEL
  mockExecuteCommand.mockReset()
  mockGetSession.mockReset()
  mockResolveUserSandboxContext.mockReset()
  mockResolveDaytonaRuntimeApiKey.mockReset()
})

afterEach(() => {
  restoreEnv("FLEET_PI_AUTH_DATABASE_URL", originalAuthDatabaseUrl)
  restoreEnv("DAYTONA_API_KEY", originalDaytonaApiKey)
  restoreEnv("FLEET_PI_REPO_ROOT", originalRepoRoot)
  restoreEnv("VERCEL", originalVercel)
  for (const root of roots) {
    rmSync(root, { force: true, recursive: true })
  }
  roots.clear()
})

describe("resolveWorkspaceContext", () => {
  it("uses the authenticated Daytona workspace context", async () => {
    const projectRoot = mkdtempSync(
      join(tmpdir(), "fleet-pi-workspace-context-")
    )
    roots.add(projectRoot)
    process.env.FLEET_PI_REPO_ROOT = projectRoot
    process.env.DAYTONA_API_KEY = "daytona-test-key"
    mockGetSession.mockResolvedValue({
      user: { email: "user@example.test", id: "user-1" },
    })
    mockResolveDaytonaRuntimeApiKey.mockResolvedValue("daytona-test-key")
    const workspaceFS = {}
    mockResolveUserSandboxContext.mockResolvedValue({
      workspaceFS,
      workspaceRoot: "/home/daytona/agent-workspace",
    })

    const context = await resolveWorkspaceContext(
      new Request("http://localhost:3000/api/workspace/tree")
    )

    expect(mockResolveUserSandboxContext).toHaveBeenCalledWith({
      userEmail: "user@example.test",
      userId: "user-1",
      apiKey: "daytona-test-key",
      surface: "workspace",
    })
    expect(context.workspaceRoot).toBe("/home/daytona/agent-workspace")
    expect(context.workspaceFS).toBe(workspaceFS)
  })

  it("throws DaytonaCredentialRequiredError (403) on VERCEL=1 without BYOK", async () => {
    process.env.VERCEL = "1"
    mockGetSession.mockResolvedValue({
      user: { email: "user@example.test", id: "user-1" },
    })
    mockResolveDaytonaRuntimeApiKey.mockResolvedValue(undefined)

    await expect(
      resolveWorkspaceContext(
        new Request("http://localhost:3000/api/workspace/tree")
      )
    ).rejects.toBeInstanceOf(DaytonaCredentialRequiredError)

    expect(mockResolveUserSandboxContext).not.toHaveBeenCalled()
  })

  it("does not gate chat-only surfaces (requireDaytona: false) on hosted deployments without BYOK", async () => {
    process.env.VERCEL = "1"
    mockGetSession.mockResolvedValue({
      user: { email: "user@example.test", id: "user-1" },
    })
    mockResolveDaytonaRuntimeApiKey.mockResolvedValue(undefined)

    const context = await resolveWorkspaceContext(
      new Request("http://localhost:3000/api/chat/commands"),
      undefined,
      { requireDaytona: false }
    )

    expect(context.workspaceFS).toBeUndefined()
    expect(mockResolveUserSandboxContext).not.toHaveBeenCalled()
  })

  it("resolves a local context when VERCEL is unset and no BYOK is present", async () => {
    mockGetSession.mockResolvedValue({
      user: { email: "user@example.test", id: "user-1" },
    })
    mockResolveDaytonaRuntimeApiKey.mockResolvedValue(undefined)

    const context = await resolveWorkspaceContext(
      new Request("http://localhost:3000/api/workspace/tree")
    )

    expect(context.workspaceRoot).toContain("agent-workspace")
    expect(context.workspaceFS).toBeUndefined()
  })
})

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
    return
  }
  process.env[key] = value
}
