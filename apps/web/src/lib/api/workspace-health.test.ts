import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { workspaceHealthHandler } from "../../routes/api/workspace/health"

const roots = new Set<string>()
const originalRepoRoot = process.env.FLEET_PI_REPO_ROOT

beforeEach(() => {
  delete process.env.FLEET_PI_REPO_ROOT
})

afterEach(() => {
  process.env.FLEET_PI_REPO_ROOT = originalRepoRoot
  for (const root of roots) {
    rmSync(root, { force: true, recursive: true })
  }
  roots.clear()
})

function createProjectRoot() {
  const root = mkdtempSync(join(tmpdir(), "fleet-pi-health-route-"))
  roots.add(root)
  return root
}

describe("GET /api/workspace/health", () => {
  it("returns machine-readable bootstrap health", async () => {
    const projectRoot = createProjectRoot()
    process.env.FLEET_PI_REPO_ROOT = projectRoot

    const response = await workspaceHealthHandler()
    const body = (await response.json()) as {
      status: string
      workspaceRoot: string
      manifest: { valid: boolean }
    }

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/json")
    expect(body.status).toBe("ok")
    expect(body.workspaceRoot).toBe(
      join(realpathSync(projectRoot), "agent-workspace")
    )
    expect(body.manifest.valid).toBe(true)
  })

  it("returns degraded json when the workspace root is blocked", async () => {
    const projectRoot = createProjectRoot()
    process.env.FLEET_PI_REPO_ROOT = projectRoot
    writeFileSync(join(projectRoot, "agent-workspace"), "blocked")

    const response = await workspaceHealthHandler()
    const body = (await response.json()) as {
      status: string
      workspace: { available: boolean }
      diagnostics: Array<{ scope: string }>
    }

    expect(response.status).toBe(200)
    expect(body.status).toBe("degraded")
    expect(body.workspace.available).toBe(false)
    expect(body.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "filesystem",
        }),
      ])
    )
  })
})
