import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  bootstrapAgentWorkspace,
  loadAgentWorkspaceHealth,
} from "./bootstrap-agent-workspace"
import type { AppRuntimeContext } from "../app-runtime"

const roots = new Set<string>()

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { force: true, recursive: true })
  }
  roots.clear()
})

function createWorkspaceContext(): AppRuntimeContext {
  const projectRoot = mkdtempSync(join(tmpdir(), "fleet-pi-workspace-"))
  roots.add(projectRoot)

  return {
    projectRoot,
    workspaceRoot: join(projectRoot, "agent-workspace"),
  }
}

describe("bootstrapAgentWorkspace", () => {
  it("creates the typed workspace contract without overwriting files", async () => {
    const context = createWorkspaceContext()

    const health = await bootstrapAgentWorkspace(context)
    const manifest = JSON.parse(
      readFileSync(join(context.workspaceRoot, "manifest.json"), "utf8")
    ) as { version: number; workspaceRoot: string }

    expect(health.status).toBe("ok")
    expect(health.manifest.created).toBe(true)
    expect(health.sections.missing).toEqual([])
    expect(health.policies.missing).toEqual([])
    expect(health.scratch.protected).toBe(true)
    expect(health.bootstrap.createdSections).toEqual(
      expect.arrayContaining([
        "agent-workspace/instructions",
        "agent-workspace/policies",
        "agent-workspace/indexes",
      ])
    )
    expect(manifest).toMatchObject({
      version: 1,
      workspaceRoot: "agent-workspace",
    })
  })

  it("preserves existing manifest and policy content across repeated probes", async () => {
    const context = createWorkspaceContext()
    const manifestPath = join(context.workspaceRoot, "manifest.json")
    const policyPath = join(context.workspaceRoot, "policies", "tool-policy.md")

    mkdirSync(context.workspaceRoot, { recursive: true })
    mkdirSync(join(context.workspaceRoot, "policies"), { recursive: true })
    writeFileSync(manifestPath, "not-json")
    writeFileSync(policyPath, "keep me\n")

    const first = await loadAgentWorkspaceHealth(context)
    const second = await loadAgentWorkspaceHealth(context)

    expect(first.status).toBe("degraded")
    expect(second.status).toBe("degraded")
    expect(first.manifest.valid).toBe(false)
    expect(second.manifest.valid).toBe(false)
    expect(readFileSync(manifestPath, "utf8")).toBe("not-json")
    expect(readFileSync(policyPath, "utf8")).toBe("keep me\n")
    expect(first.bootstrap.createdPaths).not.toContain(
      "agent-workspace/manifest.json"
    )
    expect(first.bootstrap.createdPaths).not.toContain(
      "agent-workspace/policies/tool-policy.md"
    )
  })

  it("reports projection degradation separately from canonical workspace files", async () => {
    const context = createWorkspaceContext()
    await bootstrapAgentWorkspace(context)
    rmSync(join(context.workspaceRoot, "indexes"), {
      force: true,
      recursive: true,
    })
    writeFileSync(join(context.workspaceRoot, "indexes"), "blocked")

    const health = await loadAgentWorkspaceHealth(context)

    expect(health.status).toBe("degraded")
    expect(health.manifest.valid).toBe(true)
    expect(health.projection.status).toBe("degraded")
    expect(health.projection.canonicalSourceOfTruth).toBe(true)
    expect(health.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "projection",
          path: "agent-workspace/indexes",
        }),
      ])
    )
  })

  it("degrades cleanly when the workspace root cannot be initialized", async () => {
    const context = createWorkspaceContext()
    rmSync(context.workspaceRoot, { force: true, recursive: true })
    writeFileSync(context.workspaceRoot, "blocked")

    const health = await loadAgentWorkspaceHealth(context)

    expect(health.status).toBe("degraded")
    expect(health.workspace.available).toBe(false)
    expect(health.sections.missing).toContain("agent-workspace/instructions")
    expect(health.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "filesystem",
          path: "agent-workspace",
        }),
      ])
    )
  })
})
