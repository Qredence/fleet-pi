import { rmSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createSandboxResourceSettings } from "../sandbox-resource-settings"
import type { SettingsManager } from "@earendil-works/pi-coding-agent"

const { rmMock } = vi.hoisted(() => ({
  rmMock: vi.fn(),
}))

vi.mock("node:fs/promises", async () => {
  const actual =
    await vi.importActual<Record<string, unknown>>("node:fs/promises")
  return {
    ...actual,
    rm: (...args: Array<unknown>) => rmMock(...args),
  }
})

describe("createSandboxResourceSettings", () => {
  const roots: Array<string> = []

  afterEach(() => {
    vi.unstubAllEnvs()
    rmMock.mockReset()
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("ignores a missing pi cache when Workers rm has no force option", async () => {
    vi.stubEnv("FLEET_PI_DEPLOYMENT", "cloudflare")
    rmMock.mockImplementation((path: unknown) => {
      const error = new Error(
        `ENOENT: no such file or directory, rm '${String(path)}'`
      )
      Object.assign(error, { code: "ENOENT" })
      return Promise.reject(error)
    })
    const manager = {
      getProjectSettings: () => ({
        skills: ["../agent-workspace/pi/skills"],
        prompts: [],
        extensions: [],
        themes: [],
        packages: [],
      }),
    } as unknown as SettingsManager

    await expect(
      createSandboxResourceSettings(manager, "user-hosted").prepare()
    ).resolves.toBeUndefined()

    const removed = rmMock.mock.calls.map((call) => String(call[0]))
    const cache = removed.find(
      (path) => path.endsWith("/pi") || path.endsWith("\\pi")
    )
    expect(cache).toBeDefined()
    if (cache) roots.push(cache.slice(0, -3))
  })
})
