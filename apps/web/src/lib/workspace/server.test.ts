import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { loadAgentWorkspaceFile, loadAgentWorkspaceTree } from "./server"
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

describe("workspace server", () => {
  it("seeds the typed workspace contract inside the selected project root", async () => {
    const context = createWorkspaceContext()
    const tree = await loadAgentWorkspaceTree(context)

    expect(tree.root).toBe("agent-workspace")
    expect(
      tree.nodes.some((node) => node.path === "agent-workspace/instructions")
    ).toBe(true)
    expect(
      tree.nodes.some((node) => node.path === "agent-workspace/policies")
    ).toBe(true)
  })

  it("reads workspace files using project-relative agent-workspace paths", async () => {
    const context = createWorkspaceContext()
    const file = await loadAgentWorkspaceFile(
      context,
      "agent-workspace/policies/tool-policy.md"
    )

    expect(file.path).toBe("agent-workspace/policies/tool-policy.md")
    expect(file.name).toBe("tool-policy.md")
    expect(file.mediaType).toBe("text/markdown")
    expect(file.status).toBe("ok")
    expect(file.content).toContain("# Tool Policy")
  })

  it("rejects absolute paths", async () => {
    const context = createWorkspaceContext()

    await expect(
      loadAgentWorkspaceFile(
        context,
        join(context.workspaceRoot, "instructions")
      )
    ).rejects.toMatchObject({ status: 400 })
  })

  it("rejects traversal paths", async () => {
    const context = createWorkspaceContext()

    await expect(
      loadAgentWorkspaceFile(context, "agent-workspace/../package.json")
    ).rejects.toMatchObject({ status: 403 })
  })

  it("rejects directories", async () => {
    const context = createWorkspaceContext()

    await expect(
      loadAgentWorkspaceFile(context, "agent-workspace/instructions")
    ).rejects.toMatchObject({ status: 400 })
  })

  it("reports missing files explicitly", async () => {
    const context = createWorkspaceContext()

    await expect(
      loadAgentWorkspaceFile(context, "agent-workspace/instructions/missing.md")
    ).rejects.toMatchObject({ status: 404 })
  })

  it("rejects symlinks that resolve outside the workspace", async () => {
    const context = createWorkspaceContext()
    await loadAgentWorkspaceTree(context)
    const outsideRoot = mkdtempSync(join(tmpdir(), "fleet-pi-outside-"))
    roots.add(outsideRoot)
    const outsideFile = join(outsideRoot, "secret.txt")
    writeFileSync(outsideFile, "secret")
    const linkPath = join(context.workspaceRoot, "scratch", "tmp", "secret.txt")
    symlinkSync(outsideFile, linkPath)

    await expect(
      loadAgentWorkspaceFile(context, "agent-workspace/scratch/tmp/secret.txt")
    ).rejects.toMatchObject({ status: 403 })
  })

  it("returns a too-large preview state for large files", async () => {
    const context = createWorkspaceContext()
    await loadAgentWorkspaceTree(context)
    const largePath = join(context.workspaceRoot, "scratch", "tmp", "large.txt")
    writeFileSync(largePath, "a".repeat(256 * 1024 + 1))

    const file = await loadAgentWorkspaceFile(
      context,
      "agent-workspace/scratch/tmp/large.txt"
    )

    expect(file.status).toBe("too-large")
    expect(file.content).toBe("")
  })

  it("returns an unsupported preview state for binary files", async () => {
    const context = createWorkspaceContext()
    await loadAgentWorkspaceTree(context)
    const binaryDirectory = join(context.workspaceRoot, "scratch", "tmp")
    mkdirSync(binaryDirectory, { recursive: true })
    writeFileSync(join(binaryDirectory, "binary.bin"), Buffer.from([0, 1, 2]))

    const file = await loadAgentWorkspaceFile(
      context,
      "agent-workspace/scratch/tmp/binary.bin"
    )

    expect(file.status).toBe("unsupported")
    expect(file.mediaType).toBe("application/octet-stream")
    expect(file.content).toBe("")
  })
})
