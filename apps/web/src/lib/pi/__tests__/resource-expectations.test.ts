import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"
import { FLEET_PI_SHARED_PROJECT_SETTINGS } from "../runtime/fleet-default-project-settings"
import { mergeProjectSettingsRecords } from "../runtime/project-settings-merge"
import {
  EXPECTED_PROJECT_EXTENSION_NAMES,
  collectResourceExpectationDiagnostics,
} from "../resource-expectations"

describe("resource expectations", () => {
  it("accepts all expected project extensions", () => {
    const diagnostics = collectResourceExpectationDiagnostics({
      extensions: EXPECTED_PROJECT_EXTENSION_NAMES.map((name) => ({ name })),
    })

    expect(diagnostics).toEqual([])
  })

  it("reports missing expected project extensions", () => {
    const diagnostics = collectResourceExpectationDiagnostics({
      extensions: [{ name: "project-inventory" }],
    })

    expect(diagnostics).toContain(
      "Missing expected Pi extension: workspace-index"
    )
    expect(diagnostics).toContain(
      "Missing expected Pi extension: workspace-write"
    )
    expect(diagnostics).toContain(
      "Missing expected Pi extension: workspace-context"
    )
    expect(diagnostics).toContain("Missing expected Pi extension: web-fetch")
    expect(diagnostics).toContain(
      "Missing expected Pi extension: resource-install"
    )
    expect(diagnostics).toContain(
      "Missing expected Pi extension: daytona-sandbox"
    )
  })

  it("keeps .pi/settings.json out of version control", () => {
    // The file is machine-local (it holds user model choices) and must stay
    // gitignored. It is read from disk by no test, so a clean checkout has no
    // copy to read.
    expect(() =>
      execFileSync("git", ["ls-files", "--error-unmatch", ".pi/settings.json"], {
        cwd: new URL("../../../../../../", import.meta.url),
        stdio: "ignore",
      })
    ).toThrow()
  })

  it("keeps expected project extensions registered in merged Pi settings", () => {
    const settings = mergeProjectSettingsRecords(
      FLEET_PI_SHARED_PROJECT_SETTINGS,
      {}
    ) as { extensions?: Array<string> }

    expect(settings.extensions).toEqual(
      expect.arrayContaining(["../agent-workspace/pi/extensions/enabled"])
    )
  })

  it("ships no provider or model in the Fleet shared defaults", () => {
    const settings = FLEET_PI_SHARED_PROJECT_SETTINGS as Record<string, unknown>

    expect(settings).not.toHaveProperty("enabledModels")
    expect(settings).not.toHaveProperty("defaultProvider")
    expect(settings).not.toHaveProperty("defaultModel")
  })
})
