import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import workspaceIndexExtension from "../../../../../.pi/extensions/workspace-index"
import {
  formatProjectMemoryForStartupContext,
  formatProjectMemoryForWorkspaceIndex,
  readProjectMemoryIndex,
} from "../../../../../.pi/extensions/lib/workspace-memory-index"

const PROJECT_MEMORY_DIR = "agent-workspace/memory/project"

describe("workspace memory index", () => {
  const tempRoots: Array<string> = []

  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => rm(root, { recursive: true }))
    )
  })

  it("indexes canonical memory and orphaned project memory", async () => {
    const root = await createTempWorkspace()
    await writeMemoryFile(
      root,
      "architecture.md",
      "# Architecture\n\nSeeded stub.\n"
    )
    await writeMemoryFile(
      root,
      "preferences.md",
      [
        "# Preferences",
        "",
        "## User Identity",
        "",
        "- Preference: User's name is Zachary",
        "- Applies to: all future sessions",
      ].join("\n")
    )
    await writeMemoryFile(
      root,
      "memory-harness-test.md",
      [
        "# Memory Harness Test",
        "",
        "## Sentinel",
        "",
        "- Value: the blue heron keeps the cedar key",
      ].join("\n")
    )

    const index = await readProjectMemoryIndex(root)

    expect(index.canonical).toHaveLength(5)
    expect(
      index.canonical.find((file) => file.key === "architecture")
    ).toMatchObject({
      exists: true,
      hasContent: false,
    })
    expect(
      index.canonical.find((file) => file.key === "preferences")
    ).toMatchObject({
      exists: true,
      hasContent: true,
      headings: ["User Identity"],
      snippets: expect.arrayContaining(["Preference: User's name is Zachary"]),
    })
    expect(index.orphaned).toHaveLength(1)
    expect(index.orphaned[0]).toMatchObject({
      hasContent: true,
      key: "memory-harness-test",
      path: "agent-workspace/memory/project/memory-harness-test.md",
    })
  })

  it("formats recall protocol and orphan fallback for startup context", async () => {
    const root = await createTempWorkspace()
    await writeMemoryFile(
      root,
      "preferences.md",
      "# Preferences\n\n## User Identity\n\n- Preference: User's name is Zachary\n"
    )
    await writeMemoryFile(
      root,
      "memory-harness-test.md",
      "# Memory Harness Test\n\n- Value: the blue heron keeps the cedar key\n"
    )

    const index = await readProjectMemoryIndex(root)
    const startup = formatProjectMemoryForStartupContext(index)
    const workspaceIndex =
      formatProjectMemoryForWorkspaceIndex(index).join("\n")

    expect(startup).toContain("Project memory index:")
    expect(startup).toContain("preferences: has content")
    expect(startup).toContain("Project memory recall snippets:")
    expect(startup).toContain(
      "- preferences: Preference: User's name is Zachary"
    )
    expect(startup).toContain("orphaned: memory-harness-test.md")
    expect(startup).toContain("Recall protocol")
    expect(startup).toContain("find/grep across agent-workspace/memory/project")
    expect(workspaceIndex).toContain("Orphaned project memory")
    expect(workspaceIndex).toContain("memory-harness-test.md")
  })

  it("reports project memory and runtime tools through workspace_index", async () => {
    const root = await createTempWorkspace()
    await writeMemoryFile(
      root,
      "preferences.md",
      "# Preferences\n\n## User Identity\n\n- Preference: User's name is Zachary\n"
    )
    await writeMemoryFile(
      root,
      "memory-harness-test.md",
      "# Memory Harness Test\n\n- Value: the blue heron keeps the cedar key\n"
    )

    const registeredTools: Array<{
      execute: (...args: Array<unknown>) => Promise<{
        content: Array<{ text: string }>
        details: {
          orphanedMemory: Array<{ path: string }>
          runtimeTools: Array<string>
        }
      }>
    }> = []

    const extensionApi = {
      registerTool: (tool: (typeof registeredTools)[number]) => {
        registeredTools.push(tool)
      },
    } as unknown as Parameters<typeof workspaceIndexExtension>[0]

    workspaceIndexExtension(extensionApi)

    const result = await registeredTools[0].execute(
      "tool-call",
      {},
      new AbortController().signal,
      () => undefined,
      { sessionManager: { getCwd: () => root } }
    )

    expect(result.content[0].text).toContain("Fleet Pi agent workspace")
    expect(result.content[0].text).toContain("Agent home")
    expect(result.content[0].text).toContain("Workspace Pi resources")
    expect(result.content[0].text).toContain("agent-workspace/pi/skills")
    expect(result.content[0].text).toContain("Orphaned project memory")
    expect(result.details.orphanedMemory[0].path).toBe(
      "agent-workspace/memory/project/memory-harness-test.md"
    )
    expect(result.details.runtimeTools).toContain("workspace_index")
    expect(result.details.runtimeTools).toContain("workspace_write")
    expect(result.details.runtimeTools).toContain("resource_install")
  })

  async function createTempWorkspace() {
    const root = await mkdtemp(join(tmpdir(), "fleet-pi-memory-index-"))
    tempRoots.push(root)
    return root
  }
})

async function writeMemoryFile(root: string, name: string, content: string) {
  await mkdir(join(root, PROJECT_MEMORY_DIR), { recursive: true })
  await writeFile(join(root, PROJECT_MEMORY_DIR, name), content, "utf8")
}
