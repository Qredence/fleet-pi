import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { workspaceTreeHandler } from "@/routes/api/workspace/tree"

const { mockGetSession, mockResolveDaytonaRuntimeApiKey } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockResolveDaytonaRuntimeApiKey: vi.fn(),
}))

vi.mock("@/lib/auth/server", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}))

vi.mock("@/lib/pi/runtime/user-provider-secrets", () => ({
  resolveDaytonaRuntimeApiKey: mockResolveDaytonaRuntimeApiKey,
}))

const originalHosted = process.env.FLEET_PI_DEPLOYMENT
const originalRepoRoot = process.env.FLEET_PI_REPO_ROOT

afterEach(() => {
  restoreEnv("FLEET_PI_DEPLOYMENT", originalHosted)
  restoreEnv("FLEET_PI_REPO_ROOT", originalRepoRoot)
})

describe("hosted workspace without a Daytona row", () => {
  it("does not return agent-workspace/memory entries", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "fleet-pi-hosted-tree-"))
    const memoryFile = join(
      projectRoot,
      "agent-workspace/memory/project/decisions.md"
    )
    mkdirSync(dirname(memoryFile), { recursive: true })
    writeFileSync(memoryFile, "# Decisions\n")
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    process.env.FLEET_PI_REPO_ROOT = projectRoot
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "user@example.test", name: "User" },
    })
    mockResolveDaytonaRuntimeApiKey.mockResolvedValue(undefined)

    try {
      const response = await workspaceTreeHandler(
        new Request("http://localhost:3000/api/workspace/tree")
      )
      const body = await response.text()

      expect(response.status).toBe(403)
      expect(body).not.toContain("agent-workspace/memory")
    } finally {
      rmSync(projectRoot, { force: true, recursive: true })
    }
  })
})

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
    return
  }
  process.env[key] = value
}
