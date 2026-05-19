import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resolveWorkspaceContext } from "./workspace-context"

const { mockExecuteCommand, mockGetSession, mockGetUserSandbox } = vi.hoisted(
  () => ({
    mockExecuteCommand: vi.fn(),
    mockGetSession: vi.fn(),
    mockGetUserSandbox: vi.fn(),
  })
)

vi.mock("@/lib/auth/server", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}))

vi.mock("@/lib/daytona/client", () => ({
  executeCommand: mockExecuteCommand,
}))

vi.mock("@/lib/daytona/user-sandbox", () => ({
  getUserSandbox: mockGetUserSandbox,
  isDaytonaEnabled: (userId?: string) =>
    Boolean(userId) && Boolean(process.env.DAYTONA_API_KEY),
}))

const originalAuthDatabaseUrl = process.env.FLEET_PI_AUTH_DATABASE_URL
const originalDaytonaApiKey = process.env.DAYTONA_API_KEY
const originalRepoRoot = process.env.FLEET_PI_REPO_ROOT
const roots = new Set<string>()

beforeEach(() => {
  delete process.env.FLEET_PI_AUTH_DATABASE_URL
  delete process.env.DAYTONA_API_KEY
  delete process.env.FLEET_PI_REPO_ROOT
  mockExecuteCommand.mockReset()
  mockGetSession.mockReset()
  mockGetUserSandbox.mockReset()
})

afterEach(() => {
  restoreEnv("FLEET_PI_AUTH_DATABASE_URL", originalAuthDatabaseUrl)
  restoreEnv("DAYTONA_API_KEY", originalDaytonaApiKey)
  restoreEnv("FLEET_PI_REPO_ROOT", originalRepoRoot)
  for (const root of roots) {
    rmSync(root, { force: true, recursive: true })
  }
  roots.clear()
})

describe("resolveWorkspaceContext", () => {
  it("uses Daytona workspace filesystem with local SQLite auth fallback", async () => {
    const projectRoot = mkdtempSync(
      join(tmpdir(), "fleet-pi-workspace-context-")
    )
    roots.add(projectRoot)
    process.env.FLEET_PI_REPO_ROOT = projectRoot
    process.env.DAYTONA_API_KEY = "daytona-test-key"
    mockGetSession.mockResolvedValue({
      user: { email: "user@example.test", id: "user-1" },
    })
    const sandbox = {}
    mockGetUserSandbox.mockResolvedValue({ sandbox })
    mockExecuteCommand.mockResolvedValue({ exitCode: 0, result: "" })

    const context = await resolveWorkspaceContext(
      new Request("http://localhost:3000/api/workspace/tree")
    )

    expect(mockGetUserSandbox).toHaveBeenCalledWith({
      userEmail: "user@example.test",
      userId: "user-1",
    })
    expect(mockExecuteCommand).toHaveBeenCalledWith(
      sandbox,
      "mkdir -p /home/daytona/fleet-pi/agent-workspace"
    )
    expect(context.workspaceRoot).toBe("/home/daytona/fleet-pi/agent-workspace")
    expect(context.workspaceFS).toBeDefined()
  })
})

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
    return
  }
  process.env[key] = value
}
