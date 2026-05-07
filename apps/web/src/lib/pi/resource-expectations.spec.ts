import { describe, expect, it } from "vitest"
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
  })
})
