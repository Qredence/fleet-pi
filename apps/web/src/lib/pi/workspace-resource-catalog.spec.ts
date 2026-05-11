import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  applyWorkspaceResourceMetadata,
  loadWorkspaceResourceCatalog,
  mergeResourceInfo,
} from "./workspace-resource-catalog"
import type { AppRuntimeContext } from "@/lib/app-runtime"

describe("workspace resource catalog", () => {
  const tempRoots: Array<string> = []

  afterEach(async () => {
    await Promise.all(
      tempRoots
        .splice(0)
        .map((root) => rm(root, { force: true, recursive: true }))
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
        extensions: ["../agent-workspace/pi/extensions/enabled"],
        packages: ["../agent-workspace/pi/packages/example"],
        prompts: ["../agent-workspace/pi/prompts"],
        skills: ["../agent-workspace/pi/skills"],
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

  it("annotates runtime-loaded workspace resources with canonical paths", () => {
    const root = "/tmp/fleet-pi-project"
    const settings = {
      extensions: ["../agent-workspace/pi/extensions/enabled"],
      packages: ["../agent-workspace/pi/packages/runtime-pack"],
      prompts: ["../agent-workspace/pi/prompts"],
      skills: ["../agent-workspace/pi/skills"],
    }

    expect(
      applyWorkspaceResourceMetadata(root, settings, {
        name: "web-fetch",
        path: `${root}/agent-workspace/pi/extensions/enabled/web-fetch/index.ts`,
        source: "local",
      })
    ).toMatchObject({
      activationStatus: "active",
      installedInWorkspace: true,
      path: "agent-workspace/pi/extensions/enabled/web-fetch/index.ts",
      source: "workspace",
      workspacePath: "agent-workspace/pi/extensions/enabled/web-fetch/index.ts",
    })

    expect(
      applyWorkspaceResourceMetadata(root, settings, {
        name: "packaged-skill",
        path: `${root}/agent-workspace/pi/packages/runtime-pack/skills/packaged-skill/SKILL.md`,
      })
    ).toMatchObject({
      activationStatus: "active",
      installedInWorkspace: true,
      path: "agent-workspace/pi/packages/runtime-pack/skills/packaged-skill/SKILL.md",
      source: "workspace",
      workspacePath:
        "agent-workspace/pi/packages/runtime-pack/skills/packaged-skill/SKILL.md",
    })
  })

  it("merges absolute runtime paths with workspace catalog metadata", () => {
    const root = "/tmp/fleet-pi-project"

    expect(
      mergeResourceInfo(
        root,
        [
          {
            description: "Loaded from the runtime bridge",
            name: "web-fetch",
            path: `${root}/agent-workspace/pi/extensions/enabled/web-fetch/index.ts`,
            source: "local",
          },
        ],
        [
          {
            activationStatus: "active",
            installedInWorkspace: true,
            name: "web-fetch",
            path: "agent-workspace/pi/extensions/enabled/web-fetch/index.ts",
            source: "workspace",
            workspacePath:
              "agent-workspace/pi/extensions/enabled/web-fetch/index.ts",
          },
        ]
      )
    ).toEqual([
      expect.objectContaining({
        activationStatus: "active",
        description: "Loaded from the runtime bridge",
        installedInWorkspace: true,
        name: "web-fetch",
        path: "agent-workspace/pi/extensions/enabled/web-fetch/index.ts",
        source: "workspace",
        workspacePath:
          "agent-workspace/pi/extensions/enabled/web-fetch/index.ts",
      }),
    ])
  })

  async function createTempProject() {
    const root = await mkdtemp(join(tmpdir(), "fleet-pi-resource-catalog-"))
    tempRoots.push(root)
    await mkdir(join(root, ".pi"), { recursive: true })
    await writeFile(
      join(root, ".pi/settings.json"),
      JSON.stringify({
        extensions: ["../agent-workspace/pi/extensions/enabled"],
        packages: ["../agent-workspace/pi/packages/example"],
        prompts: ["../agent-workspace/pi/prompts"],
        skills: ["../agent-workspace/pi/skills"],
      })
    )
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
