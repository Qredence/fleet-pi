import { describe, expect, it } from "vitest"
import { createDefaultWorkspaceManifest } from "./workspace-contract"
import {
  classifyWorkspacePath,
  parseWorkspaceFile,
} from "./workspace-semantic-parsers"

describe("workspace semantic parsers", () => {
  it("classifies supported workspace paths into stable categories", () => {
    expect(
      classifyWorkspacePath("agent-workspace/manifest.json")
    ).toMatchObject({
      category: "manifest",
      pathType: "workspace-manifest",
      sourceOfTruth: "canonical-files",
    })
    expect(
      classifyWorkspacePath("agent-workspace/memory/project/preferences.md")
    ).toMatchObject({
      category: "memory",
      pathType: "project-memory-canonical",
      sourceOfTruth: "canonical-files",
    })
    expect(
      classifyWorkspacePath("agent-workspace/plans/active/reindex-plan.md")
    ).toMatchObject({
      category: "plan",
      pathType: "plan",
      sourceOfTruth: "canonical-files",
    })
    expect(
      classifyWorkspacePath("agent-workspace/skills/execution-plan/SKILL.md")
    ).toMatchObject({
      category: "skill",
      pathType: "skill-definition",
      sourceOfTruth: "canonical-files",
    })
    expect(
      classifyWorkspacePath("agent-workspace/evals/regression-checks.md")
    ).toMatchObject({
      category: "eval",
      pathType: "eval",
      sourceOfTruth: "canonical-files",
    })
    expect(
      classifyWorkspacePath(
        "agent-workspace/artifacts/reports/workspace-review.md"
      )
    ).toMatchObject({
      category: "artifact",
      pathType: "artifact",
      sourceOfTruth: "canonical-files",
    })
    expect(
      classifyWorkspacePath("agent-workspace/policies/constraints.md")
    ).toMatchObject({
      category: "policy",
      pathType: "policy",
      sourceOfTruth: "canonical-files",
    })
    expect(
      classifyWorkspacePath("agent-workspace/pi/skills/my-skill/SKILL.md")
    ).toMatchObject({
      category: "pi-resource",
      pathType: "workspace-pi-resource",
      sourceOfTruth: "canonical-files",
    })
    expect(
      classifyWorkspacePath(
        "agent-workspace/pi/packages/resource-manifest.json"
      )
    ).toMatchObject({
      category: "pi-resource",
      parserKind: "json",
    })
    expect(
      classifyWorkspacePath("agent-workspace/scratch/tmp/transient-note.md")
    ).toMatchObject({
      category: "scratch",
      pathType: "scratch",
      sourceOfTruth: "temporary-files",
    })
    expect(
      classifyWorkspacePath("agent-workspace/system/identity.md")
    ).toMatchObject({
      category: "unknown",
      pathType: "workspace-system",
      sourceOfTruth: "canonical-files",
    })
  })

  it("ignores projection storage and housekeeping files", () => {
    expect(
      classifyWorkspacePath(
        "agent-workspace/indexes/workspace-projection.sqlite"
      )
    ).toBeNull()
    expect(
      classifyWorkspacePath("agent-workspace/scratch/tmp/.gitkeep")
    ).toBeNull()
    expect(
      classifyWorkspacePath("agent-workspace/pi/packages/.gitignore")
    ).toBeNull()
  })

  it("parses the workspace manifest into stable semantic records", () => {
    const classification = classifyWorkspacePath(
      "agent-workspace/manifest.json"
    )
    if (!classification) {
      throw new Error("Expected manifest classification to exist.")
    }

    const parsed = parseWorkspaceFile(
      classification,
      JSON.stringify(createDefaultWorkspaceManifest(), null, 2)
    )

    expect(parsed.title).toBe("Agent Workspace Manifest")
    expect(parsed.metadata).toMatchObject({
      valid: true,
      manifestVersion: 1,
      sectionCount: 10,
      policyCount: 4,
    })
    expect(parsed.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stableKey: "document",
          recordType: "document",
        }),
        expect.objectContaining({
          stableKey: "section:memory",
          recordType: "manifest-section",
          title: "memory",
        }),
        expect.objectContaining({
          stableKey: "policy:workspace-policy",
          recordType: "manifest-policy",
          title: "workspace-policy",
        }),
      ])
    )
  })

  it("parses markdown workspace files with headings and durable-content metadata", () => {
    const classification = classifyWorkspacePath(
      "agent-workspace/memory/project/preferences.md"
    )
    if (!classification) {
      throw new Error("Expected preferences classification to exist.")
    }

    const parsed = parseWorkspaceFile(
      classification,
      [
        "# Preferences",
        "",
        "## User Identity",
        "",
        "- Preference: User's name is Zachary",
        "- Applies to: future sessions",
      ].join("\n")
    )

    expect(parsed.title).toBe("Preferences")
    expect(parsed.metadata).toMatchObject({
      hasDurableContent: true,
      pathType: "project-memory-canonical",
    })
    expect(parsed.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stableKey: "document",
          recordType: "document",
          title: "Preferences",
        }),
        expect.objectContaining({
          stableKey: "section:user-identity",
          recordType: "section",
          title: "User Identity",
        }),
      ])
    )
  })

  it("records manifest parser failures without dropping the file", () => {
    const classification = classifyWorkspacePath(
      "agent-workspace/manifest.json"
    )
    if (!classification) {
      throw new Error("Expected manifest classification to exist.")
    }

    const parsed = parseWorkspaceFile(classification, "{ not-json")

    expect(parsed.metadata).toMatchObject({
      valid: false,
      parseError: expect.any(String),
    })
    expect(parsed.records).toEqual([
      expect.objectContaining({
        stableKey: "document",
        recordType: "document",
      }),
    ])
  })

  it("parses jsonl workspace files as line-delimited semantic records", () => {
    const classification = classifyWorkspacePath(
      "agent-workspace/artifacts/traces/run-events.jsonl"
    )
    if (!classification) {
      throw new Error("Expected jsonl classification to exist.")
    }

    const parsed = parseWorkspaceFile(
      classification,
      ['{"event":"start","step":1}', '{"event":"finish","step":2}'].join("\n")
    )

    expect(parsed.parserKind).toBe("jsonl")
    expect(parsed.metadata).toMatchObject({
      lineCount: 2,
      parsedLineCount: 2,
    })
    expect(parsed.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stableKey: "line:1",
          recordType: "json-entry",
          title: "Line 1",
        }),
        expect.objectContaining({
          stableKey: "line:2",
          recordType: "json-entry",
          title: "Line 2",
        }),
      ])
    )
  })
})
