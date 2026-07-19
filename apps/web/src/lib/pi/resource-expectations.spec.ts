import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { FLEET_PI_BASE_PROJECT_SETTINGS } from "./runtime/fleet-default-project-settings"
import { mergeProjectSettingsRecords } from "./runtime/project-settings-merge"
import {
  EXPECTED_PROJECT_EXTENSION_NAMES,
  collectResourceExpectationDiagnostics,
} from "./resource-expectations"

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

  it("keeps expected project extensions registered in merged Pi settings", async () => {
    const overrides = JSON.parse(
      await readFile(
        new URL("../../../../../.pi/settings.json", import.meta.url),
        "utf8"
      )
    ) as Record<string, unknown>
    const settings = mergeProjectSettingsRecords(
      FLEET_PI_BASE_PROJECT_SETTINGS,
      overrides
    ) as { extensions?: Array<string> }

    expect(settings.extensions).toEqual(
      expect.arrayContaining(["../agent-workspace/pi/extensions/enabled"])
    )
  })
})
