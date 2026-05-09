import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import resourceInstallExtension from "../../../../../.pi/extensions/resource-install"
import {
  ensureWorkspaceResourceDirectories,
  installWorkspaceResource,
} from "../../../../../.pi/extensions/lib/resource-install"

describe("resource_install workspace installer", () => {
  const tempRoots: Array<string> = []

  afterEach(async () => {
    vi.unstubAllGlobals()
    await Promise.all(
      tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
    )
  })

  it("creates the canonical workspace pi directories", async () => {
    const root = await createTempProject()

    await ensureWorkspaceResourceDirectories(root)

    await expect(
      readFile(join(root, "agent-workspace/pi/skills/.gitkeep"))
    ).rejects.toMatchObject({ code: "ENOENT" })
    await expect(
      mkdir(join(root, "agent-workspace/pi/extensions/enabled"))
    ).rejects.toMatchObject({ code: "EEXIST" })
  })

  it("installs pasted skills and updates .pi compatibility settings", async () => {
    const root = await createTempProject()

    const result = await installWorkspaceResource(root, {
      kind: "skill",
      name: "Frontend Helper",
      source: "---\nname: frontend-helper\n---\n# Frontend Helper\n",
      sourceType: "content",
    })

    expect(result).toMatchObject({
      activationStatus: "reload-required",
      installedPath: "agent-workspace/pi/skills/frontend-helper/SKILL.md",
      settingsUpdated: true,
    })
    await expect(
      readFile(
        join(root, "agent-workspace/pi/skills/frontend-helper/SKILL.md"),
        "utf8"
      )
    ).resolves.toContain("Frontend Helper")
    await expect(readFile(join(root, ".pi/settings.json"), "utf8")).resolves
      .toContain("../agent-workspace/pi/skills")
  })

  it("fetches URL sources for prompts", async () => {
    const root = await createTempProject()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        return new Response("# Prompt\n\nDo the thing.\n", {
          headers: { "content-type": "text/markdown" },
          status: 200,
        })
      })
    )

    const result = await installWorkspaceResource(root, {
      kind: "prompt",
      name: "Daily Brief",
      source: "https://example.com/prompt.md",
      sourceType: "url",
    })

    expect(result.installedPath).toBe("agent-workspace/pi/prompts/daily-brief.md")
    await expect(
      readFile(join(root, "agent-workspace/pi/prompts/daily-brief.md"), "utf8")
    ).resolves.toContain("Do the thing")
  })

  it("stages extensions unless explicitly activated", async () => {
    const root = await createTempProject()
    const extensionSource =
      'export default function sample(pi) { pi.registerTool({ name: "x" }) }\n'

    const staged = await installWorkspaceResource(root, {
      kind: "extension",
      name: "Sample Tool",
      source: extensionSource,
      sourceType: "content",
    })
    const active = await installWorkspaceResource(root, {
      activate: true,
      kind: "extension",
      name: "Active Tool",
      source: extensionSource,
      sourceType: "content",
    })

    expect(staged).toMatchObject({
      activationStatus: "staged",
      installedPath: "agent-workspace/pi/extensions/staged/sample-tool.ts",
    })
    expect(active).toMatchObject({
      activationStatus: "reload-required",
      installedPath: "agent-workspace/pi/extensions/enabled/active-tool.ts",
    })
  })

  it("activates local Pi package bundles by adding their package path", async () => {
    const root = await createTempProject()
    await mkdir(join(root, "fixtures/example-package"), { recursive: true })
    await writeFile(
      join(root, "fixtures/example-package/package.json"),
      JSON.stringify({
        keywords: ["pi-package"],
        name: "example-package",
        pi: { skills: ["./skills"] },
      })
    )

    const result = await installWorkspaceResource(root, {
      activate: true,
      kind: "package",
      name: "Example Package",
      source: "fixtures/example-package",
      sourceType: "path",
    })

    expect(result.installedPath).toBe("agent-workspace/pi/packages/example-package")
    await expect(readFile(join(root, ".pi/settings.json"), "utf8")).resolves
      .toContain("../agent-workspace/pi/packages/example-package")
  })

  it("rejects source paths that escape the project", async () => {
    const root = await createTempProject()

    await expect(
      installWorkspaceResource(root, {
        kind: "skill",
        name: "Bad",
        source: "../outside/SKILL.md",
        sourceType: "path",
      })
    ).rejects.toThrow("must not contain '..'")
  })

  it("registers the resource_install Pi tool", () => {
    const registeredTools: Array<{ name: string }> = []
    const extensionApi = {
      registerTool: (tool: { name: string }) => registeredTools.push(tool),
    } as unknown as Parameters<typeof resourceInstallExtension>[0]

    resourceInstallExtension(extensionApi)

    expect(registeredTools[0]).toMatchObject({ name: "resource_install" })
  })

  async function createTempProject() {
    const root = await mkdtemp(join(tmpdir(), "fleet-pi-resource-install-"))
    tempRoots.push(root)
    await mkdir(join(root, ".pi"), { recursive: true })
    await writeFile(
      join(root, ".pi/settings.json"),
      JSON.stringify({ packages: ["npm:pi-autocontext"], extensions: [] })
    )
    return root
  }
})
