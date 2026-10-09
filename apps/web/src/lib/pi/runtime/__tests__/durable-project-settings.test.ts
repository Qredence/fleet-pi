import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { hydrateSessionServicesSettings } from "../durable-project-settings"
import { getFleetBaseProjectSettings } from "../fleet-default-project-settings"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"

const roots = new Set<string>()

function createProjectRoot() {
  const root = mkdtempSync(join(tmpdir(), "fleet-pi-durable-settings-"))
  roots.add(root)
  return root
}

function committedStyleSource(defaultThinkingLevel = "high") {
  const base = getFleetBaseProjectSettings()
  const packages = (base.packages as Array<string>)
    .map(
      (source, index, list) =>
        `    "${source}"${index < list.length - 1 ? "," : ""}`
    )
    .join("\n")
  const inline = (values: Array<string>) =>
    values.map((value) => `"${value}"`).join(", ")
  return `{
  "packages": [
${packages}
  ],
  "skills": [${inline(base.skills as Array<string>)}],
  "extensions": [${inline(base.extensions as Array<string>)}],
  "prompts": [${inline(base.prompts as Array<string>)}],
  "defaultThinkingLevel": "${defaultThinkingLevel}"
}
`
}

/**
 * File-backed SettingsManager stub that mimics Pi's behavior: project-scope
 * writes re-serialize `.pi/settings.json` with normalized formatting
 * (wrapped arrays, no trailing newline).
 */
function createFileBackedManager(settingsPath: string) {
  const state = {
    project: JSON.parse(readFileSync(settingsPath, "utf8")) as Record<
      string,
      unknown
    >,
  }
  const writeNormalized = () => {
    writeFileSync(settingsPath, JSON.stringify(state.project, null, 2), "utf8")
  }
  return {
    getProjectSettings: vi.fn(() => structuredClone(state.project)),
    updateProjectSettings: vi.fn(
      (_field: string, update: (settings: Record<string, unknown>) => void) => {
        const next = structuredClone(state.project)
        update(next)
        state.project = next
        writeNormalized()
      }
    ),
    setProjectPackages: vi.fn((value: Array<string>) => {
      state.project.packages = [...value]
      writeNormalized()
    }),
    setProjectSkillPaths: vi.fn((value: Array<string>) => {
      state.project.skills = [...value]
      writeNormalized()
    }),
    setProjectExtensionPaths: vi.fn((value: Array<string>) => {
      state.project.extensions = [...value]
      writeNormalized()
    }),
    setProjectPromptTemplatePaths: vi.fn((value: Array<string>) => {
      state.project.prompts = [...value]
      writeNormalized()
    }),
    setProjectThemePaths: vi.fn((value: Array<string>) => {
      state.project.themes = [...value]
      writeNormalized()
    }),
    setEnableSkillCommands: vi.fn(),
    flush: vi.fn(() => Promise.resolve()),
  }
}

function servicesFor(manager: ReturnType<typeof createFileBackedManager>) {
  return {
    settingsManager: manager,
    resourceLoader: { reload: vi.fn(() => Promise.resolve()) },
  } as unknown as AgentSessionServices
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { force: true, recursive: true })
  }
  roots.clear()
})

describe("hydrateSessionServicesSettings formatting stability", () => {
  it("leaves .pi/settings.json byte-identical when merged content is unchanged", async () => {
    const projectRoot = createProjectRoot()
    mkdirSync(join(projectRoot, ".pi"), { recursive: true })
    const settingsPath = join(projectRoot, ".pi/settings.json")
    const source = committedStyleSource()
    writeFileSync(settingsPath, source, "utf8")

    const manager = createFileBackedManager(settingsPath)
    await hydrateSessionServicesSettings(servicesFor(manager), { projectRoot })

    expect(readFileSync(settingsPath, "utf8")).toBe(source)
    expect(manager.updateProjectSettings).not.toHaveBeenCalled()
    expect(manager.setProjectPackages).not.toHaveBeenCalled()
    expect(manager.setProjectSkillPaths).not.toHaveBeenCalled()
    expect(manager.setProjectExtensionPaths).not.toHaveBeenCalled()
    expect(manager.setProjectPromptTemplatePaths).not.toHaveBeenCalled()
  })

  it("applies a semantic change while preserving the file's formatting style", async () => {
    const projectRoot = createProjectRoot()
    mkdirSync(join(projectRoot, ".pi"), { recursive: true })
    const settingsPath = join(projectRoot, ".pi/settings.json")
    // Drop the `prompts` key: hydration merges the Fleet base default back
    // in, which is a genuine semantic change to the file.
    const full = committedStyleSource()
    const source = full.replace(/\n {2}"prompts": [^\n]+,/, "")
    const promptsValue = full.match(/\n {2}"prompts": ([^\n]+),/)?.[1]
    expect(promptsValue).toBeDefined()
    writeFileSync(settingsPath, source, "utf8")

    const manager = createFileBackedManager(settingsPath)
    await hydrateSessionServicesSettings(servicesFor(manager), { projectRoot })

    expect(manager.setProjectPromptTemplatePaths).toHaveBeenCalledTimes(1)
    expect(manager.setProjectPackages).not.toHaveBeenCalled()
    expect(manager.updateProjectSettings).not.toHaveBeenCalled()

    const after = readFileSync(settingsPath, "utf8")
    // The re-added key appends after the existing entries, keeping style.
    const expected = source.replace(
      /\n\}\n$/,
      `,\n  "prompts": ${promptsValue}\n}\n`
    )
    expect(after).toBe(expected)
    expect(after.endsWith("\n")).toBe(true)
    expect(after).toContain('"skills": ["../agent-workspace/pi/skills"]')
  })
})
