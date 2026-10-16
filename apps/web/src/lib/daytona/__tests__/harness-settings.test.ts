import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  mergeHarnessSettingArrays,
  persistHarnessInstallSettings,
} from "../harness-settings"

vi.mock("@/lib/pi/runtime/deployed-chat-runtime", () => ({
  usesDatabaseBackedProjectSettings: () => false,
}))

describe("mergeHarnessSettingArrays", () => {
  it("appends resource paths that are not already present", () => {
    expect(
      mergeHarnessSettingArrays(
        {
          skills: ["../agent-workspace/pi/skills"],
          packages: ["npm:pi-web-access"],
        },
        {
          skills: ["../agent-workspace/pi/skills"],
          packages: ["../agent-workspace/pi/packages/helper"],
        }
      )
    ).toEqual({
      skills: ["../agent-workspace/pi/skills"],
      packages: ["npm:pi-web-access", "../agent-workspace/pi/packages/helper"],
    })
  })
})

describe("persistHarnessInstallSettings", () => {
  const roots: Array<string> = []

  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
    )
  })

  it("merges activation paths into the project settings file", async () => {
    const root = await mkdtemp(join(tmpdir(), "fleet-pi-harness-settings-"))
    roots.push(root)
    await persistHarnessInstallSettings({
      cwd: root,
      settings: {
        skills: ["../agent-workspace/pi/skills"],
        packages: ["../agent-workspace/pi/packages/helper"],
      },
    })

    const saved = JSON.parse(
      await readFile(join(root, ".pi/settings.json"), "utf8")
    ) as { packages: Array<string>; skills: Array<string> }
    expect(saved.skills).toEqual(["../agent-workspace/pi/skills"])
    expect(saved.packages).toEqual(["../agent-workspace/pi/packages/helper"])
  })
})
