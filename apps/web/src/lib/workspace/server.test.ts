import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { loadAgentWorkspaceFile, loadAgentWorkspaceTree } from "./server"
import type { AppRuntimeContext } from "../desktop/server"

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
    isDesktop: true,
    projectRoot,
    workspaceRoot: join(projectRoot, "agent-workspace"),
    workspaceId: "workspace-test",
    sessionDir: join(projectRoot, ".tmp-sessions"),
  }
}

describe("workspace server", () => {
  it("seeds the agent-workspace tree inside the selected project root", async () => {
    const context = createWorkspaceContext()
    const tree = await loadAgentWorkspaceTree(context)

    expect(tree.root).toBe("agent-workspace")
    expect(
      tree.nodes.some((node) => node.path === "agent-workspace/system")
    ).toBe(true)
    expect(
      tree.nodes.some((node) => node.path === "agent-workspace/memory")
    ).toBe(true)
  })

  it("reads workspace files using project-relative agent-workspace paths", async () => {
    const context = createWorkspaceContext()
    const file = await loadAgentWorkspaceFile(
      context,
      "agent-workspace/system/identity.md"
    )

    expect(file.path).toBe("agent-workspace/system/identity.md")
    expect(file.name).toBe("identity.md")
    expect(file.mediaType).toBe("text/markdown")
    expect(file.content).toContain("# Identity")
  })
})
