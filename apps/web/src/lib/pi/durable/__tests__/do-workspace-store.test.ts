import { describe, expect, it } from "vitest"

import { SEED_TEMPLATE_VERSION } from "@/lib/workspace/workspace-contract"

import {
  DO_WORKSPACE_EXEC_UNAVAILABLE,
  DO_WORKSPACE_LIMITS,
  createDoWorkspaceStore,
  handleWorkspaceFsRequest,
  normalizeStorePath,
} from "../do-workspace-store"
import { createHostedTrace, createScriptedSandboxPort } from "../hosted-harness"
import {
  createHostedWorkspaceContext,
  hostedWorkspaceReader,
} from "../hosted-workspace-context"
import { bundledSeedTemplate } from "../seed-template-bundle"

import { nodeWorkspaceSql as nodeSql } from "./node-workspace-sql"

import type { TemplateBundle } from "../do-workspace-store"

function template(
  version: number,
  files: Record<string, string>
): TemplateBundle {
  return { version, files, directories: [] }
}

describe("DO workspace store paths", () => {
  it("normalizes tool, volume, and agent-workspace paths", () => {
    expect(normalizeStorePath("memory/project/a.md")).toBe(
      "memory/project/a.md"
    )
    expect(normalizeStorePath("./AGENTS.md")).toBe("AGENTS.md")
    expect(normalizeStorePath("agent-workspace/plans/x.md")).toBe("plans/x.md")
    expect(
      normalizeStorePath("/home/daytona/agent-workspace/system/identity.md")
    ).toBe("system/identity.md")
    expect(normalizeStorePath("/home/daytona/agent-workspace")).toBe("")
  })

  it("rejects traversal and outside absolute paths", () => {
    expect(() => normalizeStorePath("../etc/passwd")).toThrow(/outside/)
    expect(() => normalizeStorePath("memory/../../x")).toThrow(/outside/)
    expect(() => normalizeStorePath("/etc/passwd")).toThrow(/outside/)
  })
})

describe("DO workspace store", () => {
  it("seeds the bundled template once and never overwrites user edits", () => {
    const store = createDoWorkspaceStore(nodeSql())
    const bundle = bundledSeedTemplate()
    expect(bundle.version).toBe(SEED_TEMPLATE_VERSION)
    expect(store.seed(bundle).version).toBe(SEED_TEMPLATE_VERSION)

    const paths = store.entries().map((entry) => entry.path)
    expect(paths).toContain("AGENTS.md")
    expect(paths).toContain("memory/project/preferences.md")
    expect(paths).toContain("pi/skills/execution-plan/SKILL.md")
    expect(paths).not.toContain("template.json")
    expect(store.stat("memory/daily")).toEqual({ kind: "dir" })
    expect(store.templateVersion()).toBe(SEED_TEMPLATE_VERSION)
  })

  it("stages changed template files for review instead of overwriting", async () => {
    const store = createDoWorkspaceStore(nodeSql())
    store.seed(
      template(1, { "AGENTS.md": "v1", "system/identity.md": "id v1" })
    )
    await store.write("AGENTS.md", "my rules")

    store.seed(
      template(2, {
        "AGENTS.md": "v2",
        "system/identity.md": "id v1",
        "plans/backlog.md": "# Backlog",
      })
    )

    await expect(store.read("AGENTS.md")).resolves.toBe("my rules")
    await expect(
      store.read(".fleet/template-updates/2/AGENTS.md")
    ).resolves.toBe("v2")
    await expect(store.read("plans/backlog.md")).resolves.toBe("# Backlog")
    // Unchanged template file: no update copy.
    await expect(
      store.read(".fleet/template-updates/2/system/identity.md")
    ).rejects.toMatchObject({ code: "ENOENT" })
    // Same version again is a no-op.
    store.seed(template(2, { "AGENTS.md": "v2-other" }))
    await expect(
      store.read(".fleet/template-updates/2/AGENTS.md")
    ).resolves.toBe("v2")
  })

  it("lets the agent write every policy area and nothing else", async () => {
    const store = createDoWorkspaceStore(nodeSql())
    for (const path of [
      "memory/project/preferences.md",
      "scratch/tmp/notes.txt",
      "artifacts/reports/run.md",
      "artifacts/traces/t.json",
      "evals/checklist.md",
      "instructions/notes.md",
    ]) {
      await store.write(path, "content")
    }
    for (const path of [
      "src/app.ts",
      "memory/project/run.sh",
      "manifest.json",
      ".fleet/template-version",
      "indexes/projection.sqlite",
    ]) {
      await expect(store.write(path, "x")).rejects.toMatchObject({
        code: "EACCES",
      })
    }
    await expect(store.write("../outside.md", "x")).rejects.toMatchObject({
      code: "EACCES",
    })
  })

  it("enforces per-file and total size caps", async () => {
    const store = createDoWorkspaceStore(nodeSql())
    await expect(
      store.write(
        "scratch/big.md",
        "x".repeat(DO_WORKSPACE_LIMITS.fileBytes + 1)
      )
    ).rejects.toMatchObject({ code: "EFBIG" })

    const chunk = "y".repeat(DO_WORKSPACE_LIMITS.fileBytes)
    const fits = Math.floor(
      DO_WORKSPACE_LIMITS.totalBytes / DO_WORKSPACE_LIMITS.fileBytes
    )
    for (let index = 0; index < fits; index += 1) {
      await store.write(`scratch/chunk-${index}.md`, chunk)
    }
    await expect(
      store.write("scratch/one-more.md", chunk)
    ).rejects.toMatchObject({ code: "EFBIG" })
    // Rewriting an existing file at the same size still fits.
    await store.write("scratch/chunk-0.md", chunk)
  })

  it("lists direct children and refuses shell commands", async () => {
    const store = createDoWorkspaceStore(nodeSql())
    await store.write("pi/skills/plan/SKILL.md", "s")
    await store.write("pi/prompts/review.md", "p")
    store.mkdir("pi/packages")

    await expect(store.list("pi")).resolves.toEqual([
      { name: "packages", isDirectory: true },
      { name: "prompts", isDirectory: true },
      { name: "skills", isDirectory: true },
    ])
    await expect(store.list("pi/prompts")).resolves.toEqual([
      { name: "review.md", isDirectory: false },
    ])
    await expect(store.exec("ls")).resolves.toEqual({
      exitCode: 1,
      output: DO_WORKSPACE_EXEC_UNAVAILABLE,
    })
  })

  it("keeps the panel out of bookkeeping but lets it edit workspace files", async () => {
    const store = createDoWorkspaceStore(nodeSql())
    store.writeSystem("instructions/README.md", "edited")
    store.writeSystem("manifest.json", "{}")
    for (const path of [".fleet/template-version", "indexes/db.json"]) {
      expect(() => store.writeSystem(path, "x")).toThrow(
        expect.objectContaining({ code: "EACCES" }) as Error
      )
    }
  })

  it("supports exclusive system writes for the panel bootstrap", () => {
    const store = createDoWorkspaceStore(nodeSql())
    store.writeSystem("manifest.json", "{}", { exclusive: true })
    expect(() =>
      store.writeSystem("manifest.json", "{}", { exclusive: true })
    ).toThrow(expect.objectContaining({ code: "EEXIST" }) as Error)
    expect(store.stat("manifest.json")).toEqual({ kind: "file", size: 2 })
  })

  it("feeds hosted workspace context like a volume does", async () => {
    const store = createDoWorkspaceStore(nodeSql())
    store.seed(bundledSeedTemplate())
    await store.write(
      "memory/project/preferences.md",
      "# Preferences\n\n- The user prefers green tea.\n"
    )
    const context = createHostedWorkspaceContext(hostedWorkspaceReader(store))
    context.beginTurn("what tea do I like?")
    const sections = context.extension.sections as unknown as Array<{
      key: string
      render: (input: never, context: never) => Promise<string | undefined>
    }>
    const rendered = Object.fromEntries(
      await Promise.all(
        sections.map(async (section) => [
          section.key,
          await section.render({} as never, {} as never),
        ])
      )
    ) as Record<string, string | undefined>

    expect(rendered.workspace).toContain("--- AGENTS.md ---")
    expect(rendered["project-memory"]).toContain("green tea")
    expect(rendered["workspace-skills"]).toContain("execution-plan")
  })
})

describe("DO workspace store sync to a volume", () => {
  it("copies agent-written files, stages conflicts, and runs once", async () => {
    const store = createDoWorkspaceStore(nodeSql())
    store.seed(template(1, { "AGENTS.md": "template" }))
    await store.write("memory/project/preferences.md", "- tea")
    await store.write("plans/backlog.md", "- my backlog")
    await store.write("scratch/same.md", "same")

    const trace = createHostedTrace()
    const volume = createScriptedSandboxPort(trace, {
      "plans/backlog.md": "- volume backlog",
      "scratch/same.md": "same",
    })
    const result = await store.syncToVolume(volume)

    expect(result.copied).toEqual(["memory/project/preferences.md"])
    expect(result.conflicts).toEqual([".fleet/do-import/plans/backlog.md"])
    expect(result.failed).toEqual([])
    await expect(volume.read("memory/project/preferences.md")).resolves.toBe(
      "- tea"
    )
    await expect(volume.read("plans/backlog.md")).resolves.toBe(
      "- volume backlog"
    )
    await expect(
      volume.read(".fleet/do-import/plans/backlog.md")
    ).resolves.toBe("- my backlog")
    // Template files are never pushed; the volume gets its own seed.
    await expect(volume.read("AGENTS.md")).resolves.toBe("")

    const writes = trace.writes
    const again = await store.syncToVolume(volume)
    expect(again.copied).toEqual([])
    expect(trace.writes).toBe(writes)
  })

  it("stages a conflict when the volume already differs or is empty", async () => {
    const store = createDoWorkspaceStore(nodeSql())
    await store.write("scratch/a.md", "store copy")
    await store.write("scratch/empty.md", "store copy")
    const volume = createScriptedSandboxPort(createHostedTrace(), {
      "scratch/a.md": "edited on the volume",
      "scratch/empty.md": "",
    })

    const result = await store.syncToVolume(volume)

    expect(result.conflicts).toEqual([
      ".fleet/do-import/scratch/a.md",
      ".fleet/do-import/scratch/empty.md",
    ])
    expect(result.copied).toEqual([])
    await expect(volume.read("scratch/a.md")).resolves.toBe(
      "edited on the volume"
    )
    // An existing empty file is still the user's file.
    await expect(volume.read("scratch/empty.md")).resolves.toBe("")
  })

  it("syncs a file written through the Workspace panel", async () => {
    const store = createDoWorkspaceStore(nodeSql())
    const response = await handleWorkspaceFsRequest(store, {
      op: "write",
      path: "memory/project/preferences.md",
      content: "- panel edit",
    })
    expect(response.status).toBe(200)

    const volume = createScriptedSandboxPort(createHostedTrace())
    expect((await store.syncToVolume(volume)).copied).toEqual([
      "memory/project/preferences.md",
    ])
    await expect(volume.read("memory/project/preferences.md")).resolves.toBe(
      "- panel edit"
    )
  })

  it("goes read-only once the volume is canonical", async () => {
    const store = createDoWorkspaceStore(nodeSql())
    await store.write("scratch/a.md", "one")
    expect(store.isSuperseded()).toBe(false)
    await store.syncToVolume(createScriptedSandboxPort(createHostedTrace()))
    expect(store.isSuperseded()).toBe(true)

    await expect(store.write("scratch/b.md", "two")).rejects.toMatchObject({
      code: "EACCES",
    })
    await expect(store.read("scratch/a.md")).resolves.toBe("one")
    // The bootstrap may still create a file the store lacks.
    store.writeSystem("scratch/README.md", "notes")
    expect(() => store.writeSystem("scratch/a.md", "overwrite")).toThrow(
      expect.objectContaining({ code: "EACCES" }) as Error
    )
  })

  it("keeps a file pending when the volume write fails", async () => {
    const store = createDoWorkspaceStore(nodeSql())
    await store.write("scratch/a.md", "one")
    const failing = {
      ...createScriptedSandboxPort(createHostedTrace()),
      write: () => Promise.reject(new Error("volume offline")),
    }
    expect((await store.syncToVolume(failing)).failed).toEqual(["scratch/a.md"])
    expect(store.entries().find((e) => e.path === "scratch/a.md")?.synced).toBe(
      false
    )
    // Nothing reached a volume, so the store stays writable.
    expect(store.isSuperseded()).toBe(false)
    await store.write("scratch/a.md", "retry")
  })
})
