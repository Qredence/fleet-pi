import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createSessionServices } from "../session-factory"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import type { AppRuntimeContext } from "../../../app-runtime"

vi.mock("node:child_process", () => {
  const denied = () => {
    throw new Error("operation not permitted")
  }
  return {
    spawn: denied,
    spawnSync: denied,
    execFile: denied,
    execFileSync: denied,
    fork: denied,
  }
})

vi.mock("child_process", () => {
  const denied = () => {
    throw new Error("operation not permitted")
  }
  return {
    spawn: denied,
    spawnSync: denied,
    execFile: denied,
    execFileSync: denied,
    fork: denied,
  }
})

vi.mock("../../../workspace/bootstrap-agent-workspace", () => ({
  bootstrapAgentWorkspace: vi.fn(() =>
    Promise.resolve({
      status: "ok",
      workspace: { available: true },
      warnings: [],
      diagnostics: [],
    })
  ),
  createWorkspaceHealthFailure: vi.fn(),
}))

describe("hosted package install", () => {
  let root: string

  afterEach(async () => {
    vi.unstubAllEnvs()
    if (root) await rm(root, { recursive: true, force: true })
  })

  it("starts session services when npm spawn is forbidden", async () => {
    vi.stubEnv("FLEET_PI_DEPLOYMENT", "cloudflare")
    vi.stubEnv("FLEET_PI_CHAT_DATABASE_URL", "")
    root = await mkdtemp(join(tmpdir(), "fleet-pi-hosted-packages-"))
    const services = await createSessionServices(
      { projectRoot: root } as AppRuntimeContext,
      {
        agentDir: join(root, "agent"),
        cwd: root,
        modelRuntime: {
          refresh: vi.fn(() => Promise.resolve()),
          unregisterProvider: vi.fn(),
          getRegisteredProviderIds: vi.fn(() => []),
          registerProvider: vi.fn(),
          registerNativeProvider: vi.fn(),
          registerVirtualModel: vi.fn(),
        } as unknown as AgentSessionServices["modelRuntime"],
      },
      { userId: "user-hosted" }
    )

    expect(services.settingsManager.getProjectSettings().packages).toEqual(
      expect.arrayContaining(["npm:pi-autoresearch", "npm:pi-web-access"])
    )
  })
})
