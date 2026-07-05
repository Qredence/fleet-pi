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
      defaultProvider: "google",
      defaultModel: "gemini-3.5-flash",
    })
  })

  it("detects tool allowlist drift", async () => {
    const { collectDiagnostics } = await import("./server-shared")
    const mockServices = {
      diagnostics: [],
      modelRegistry: { getError: () => undefined },
      settingsManager: { drainErrors: () => [] },
      resourceLoader: {
        getSkills: () => ({ diagnostics: [] }),
        getPrompts: () => ({ diagnostics: [] }),
        getThemes: () => ({ diagnostics: [] }),
        getExtensions: () => ({
          errors: [],
          extensions: [
            {
              path: "/some/path/unlisted-extension.ts",
              tools: new Map([["unlisted_tool", {} as any]]),
            },
          ],
        }),
      },
    } as any

    const diagnostics = collectDiagnostics(mockServices)
    expect(diagnostics).toContain(
      '[Tool Drift] Registered tool "unlisted_tool" is not present in CHAT_TOOL_ALLOWLIST.'
    )
    expect(diagnostics).toContain(
      '[Tool Drift] Allowed tool "subagent" is not registered by any loaded extension.'
    )
  })

  it("detects database sync mirror health warnings", async () => {
    const { collectDiagnostics } = await import("./server-shared")
    const { mirrorMetrics } = await import("../db/pi-session-mirror")

    mirrorMetrics.failures = 2
    mirrorMetrics.lastFailureReason = "Connection timed out"

    try {
      const mockServices = createMockSessionServices()
      const diagnostics = collectDiagnostics(mockServices as any)
      expect(diagnostics).toContain(
        "[Mirror Health] Database synchronization has failed 2 times. Last error: Connection timed out"
      )
    } finally {
      mirrorMetrics.failures = 0
      mirrorMetrics.lastFailureReason = undefined
    }
  })

  it("implements self-healing retry with exponential backoff on bootstrap failure", async () => {
    const projectRoot = createProjectRoot(roots)
    const agentWorkspacePath = join(projectRoot, "agent-workspace")

    // 1. Block workspace to force bootstrap failure/degradation
    writeFileSync(agentWorkspacePath, "blocked")
    const { createSessionServices } = await import("./server-shared")
    const context = contextFor(projectRoot)

    let nowTime = 1000000000000
    const dateSpy = vi.spyOn(Date, "now").mockImplementation(() => nowTime)

    // First attempt - fails and records failure
    const services1 = await createSessionServices(context)
    expect(services1.workspaceBootstrap?.status).toBe("degraded")

    // 2. Call again immediately at the same timestamp (within 1s backoff window)
    // We unblock the workspace first to see if it would have succeeded if it tried
    rmSync(agentWorkspacePath)

    const services2 = await createSessionServices(context)
    // Even though it is now unblocked, it should return the cached failure because we're inside the backoff window
    expect(services2.workspaceBootstrap?.status).toBe("degraded")

    // 3. Move time forward past the 1s backoff window (e.g. 1500ms)
    nowTime += 1500

    // Now it should retry, and since it is unblocked, it should succeed!
    const services3 = await createSessionServices(context)
    expect(services3.workspaceBootstrap?.status).toBe("ok")
    expect(existsSync(join(agentWorkspacePath, "manifest.json"))).toBe(true)

    dateSpy.mockRestore()
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
      getExtensions: () => ({ errors: [], extensions: [] }),
    },
  }
}
