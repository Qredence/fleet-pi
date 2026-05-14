import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AppRuntimeContext } from "@/lib/app-runtime"

const createAgentSessionServices = vi.fn()
const getAgentDir = vi.fn(() => "/tmp/pi-agent")

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSessionServices,
  getAgentDir,
}))

describe("createSessionServices", () => {
  const roots = new Set<string>()

  beforeEach(() => {
    createAgentSessionServices.mockReset()
    createAgentSessionServices.mockImplementation(() =>
      Promise.resolve(createMockSessionServices())
    )
    getAgentDir.mockClear()
  })

  afterEach(() => {
    vi.resetModules()
    for (const root of roots) {
      rmSync(root, { force: true, recursive: true })
    }
    roots.clear()
  })

  it("bootstraps the workspace before creating session services", async () => {
    const projectRoot = createProjectRoot(roots)
    const { createSessionServices } = await import("./server-shared")

    await createSessionServices(contextFor(projectRoot))

    expect(
      existsSync(join(projectRoot, "agent-workspace", "manifest.json"))
    ).toBe(true)
    expect(
      existsSync(
        join(projectRoot, "agent-workspace", "system", "tool-policy.md")
      )
    ).toBe(true)
    expect(createAgentSessionServices).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: projectRoot,
        agentDir: "/tmp/pi-agent",
      })
    )
  })

  it("keeps service creation non-fatal when workspace bootstrap degrades", async () => {
    const projectRoot = createProjectRoot(roots)
    writeFileSync(join(projectRoot, "agent-workspace"), "blocked")
    const { collectDiagnostics, createSessionServices } =
      await import("./server-shared")

    const services = await createSessionServices(contextFor(projectRoot))

    expect(createAgentSessionServices).toHaveBeenCalledTimes(1)
    expect(collectDiagnostics(services)).toEqual(
      expect.arrayContaining(["agent-workspace exists but is not a directory."])
    )
  })

  it("applies the shared default model fallback when settings are unset", async () => {
    const { resolveDefaultModelSelection } = await import("./server-shared")

    expect(
      resolveDefaultModelSelection({
        getDefaultModel: () => undefined,
        getDefaultProvider: () => undefined,
      })
    ).toEqual({
      defaultProvider: "amazon-bedrock",
      defaultModel: "us.anthropic.claude-sonnet-4-6",
    })
  })
})

function createProjectRoot(roots: Set<string>) {
  const root = mkdtempSync(join(tmpdir(), "fleet-pi-runtime-bootstrap-"))
  roots.add(root)
  return root
}

function contextFor(projectRoot: string): AppRuntimeContext {
  return {
    projectRoot,
    workspaceRoot: join(projectRoot, "agent-workspace"),
  }
}

function createMockSessionServices() {
  return {
    diagnostics: [],
    modelRegistry: {
      getError: () => undefined,
    },
    settingsManager: {
      drainErrors: () => [],
    },
    resourceLoader: {
      getSkills: () => ({ diagnostics: [] }),
      getPrompts: () => ({ diagnostics: [] }),
      getThemes: () => ({ diagnostics: [] }),
      getExtensions: () => ({ errors: [] }),
    },
  }
}
