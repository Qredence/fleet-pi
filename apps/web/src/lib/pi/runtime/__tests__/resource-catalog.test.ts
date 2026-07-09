import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { loadWorkspaceResourceOverlay } from "../../workspace-resource-catalog"
import type { AppRuntimeContext } from "@/lib/app-runtime"

const tempRoots: Array<string> = []

describe("workspace resource overlay", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots
        .splice(0)
        .map((root) => rm(root, { force: true, recursive: true }))
    )
  })

  it("returns staged extensions and unstaged packages only", async () => {
    const root = await createTempProject()
    await mkdir(join(root, "agent-workspace/pi/extensions/staged"), {
      recursive: true,
    })
    await mkdir(join(root, "agent-workspace/pi/extensions/enabled"), {
      recursive: true,
    })
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
    await mkdir(join(root, "agent-workspace/pi/packages/staged-pack"), {
      recursive: true,
    })
    await mkdir(join(root, ".pi"), { recursive: true })
    await writeFile(
      join(root, ".pi/settings.json"),
      JSON.stringify({
        packages: [
          "../agent-workspace/pi/packages/example",
          { source: "npm:team-pack", skills: ["brave-search"] },
        ],
      })
    )

    const overlay = await loadWorkspaceResourceOverlay(contextFor(root))

    expect(overlay.skills).toEqual([])
    expect(overlay.prompts).toEqual([])
    expect(overlay.extensions).toEqual([
      expect.objectContaining({
        activationStatus: "staged",
        name: "draft-tool",
      }),
    ])
    expect(overlay.packages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activationStatus: "active",
          name: "example",
        }),
        expect.objectContaining({
          activationStatus: "staged",
          name: "staged-pack",
        }),
      ])
    )
  })
})

async function createTempProject() {
  const root = await mkdtemp(join(tmpdir(), "fleet-pi-overlay-"))
  tempRoots.push(root)
  return root
}

function contextFor(projectRoot: string): AppRuntimeContext {
  return { projectRoot } as AppRuntimeContext
}
