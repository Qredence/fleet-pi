import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { loadWorkspaceResourceCatalog } from "./workspace-resource-catalog"
import type { AppRuntimeContext } from "@/lib/app-runtime"

describe("workspace resource catalog", () => {
  const tempRoots: Array<string> = []

  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
    )
  })

  it("reports workspace-installed active and staged resources", async () => {
    const root = await createTempProject()
    await writeFile(
      join(root, "agent-workspace/pi/skills/frontend-helper/SKILL.md"),
      "---\nname: frontend-helper\n---\n# Frontend Helper\n"
    )
    await writeFile(
      join(root, "agent-workspace/pi/prompts/daily-brief.md"),
      "# Daily Brief\n"
    )
    await writeFile(
      join(root, "agent-workspace/pi/extensions/staged/draft-tool.ts"),
      "export default function draftTool() {}\n"
    )
    await writeFile(
      join(root, "agent-workspace/pi/extensions/enabled/live-tool.ts"),
      "export default function liveTool() {}\n"
    )
    await mkdir(join(root, "agent-workspace/pi/packages/example"), {
      recursive: true,
    })
    await writeFile(
      join(root, ".pi/settings.json"),
      JSON.stringify({
        packages: ["../agent-workspace/pi/packages/example"],
      })
    )

    const catalog = await loadWorkspaceResourceCatalog(contextFor(root))

    expect(catalog.skills[0]).toMatchObject({
      activationStatus: "active",
      installedInWorkspace: true,
      name: "frontend-helper",
    })
    expect(catalog.prompts[0]).toMatchObject({
      activationStatus: "active",
      name: "daily-brief",
    })
    expect(catalog.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activationStatus: "active",
          name: "live-tool",
        }),
        expect.objectContaining({
          activationStatus: "staged",
          name: "draft-tool",
        }),
      ])
    )
    expect(catalog.packages[0]).toMatchObject({
      activationStatus: "active",
      name: "example",
    })
  })

  async function createTempProject() {
    const root = await mkdtemp(join(tmpdir(), "fleet-pi-resource-catalog-"))
    tempRoots.push(root)
    await mkdir(join(root, ".pi"), { recursive: true })
    await mkdir(join(root, "agent-workspace/pi/skills/frontend-helper"), {
      recursive: true,
    })
    await mkdir(join(root, "agent-workspace/pi/prompts"), { recursive: true })
    await mkdir(join(root, "agent-workspace/pi/extensions/staged"), {
      recursive: true,
    })
    await mkdir(join(root, "agent-workspace/pi/extensions/enabled"), {
      recursive: true,
    })
    return root
  }
})

function contextFor(root: string): AppRuntimeContext {
  return {
    projectRoot: root,
    workspaceRoot: join(root, "agent-workspace"),
  }
}
