import { describe, expect, it } from "vitest"
import { createDefaultWorkspaceManifest } from "./workspace-contract"
import { WORKSPACE_SEMANTIC_PARSER_VERSION } from "./workspace-index-types"
import {
  classifyWorkspacePath,
  parseWithFallback,
  parseWorkspaceFile,
} from "./workspace-semantic-parsers"
import type { WorkspacePathClassification } from "./workspace-index-types"

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
      classifyWorkspacePath("agent-workspace/system/constraints.md")
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
      classifyWorkspacePath("agent-workspace/policies/constraints.md")
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

describe("classifyWorkspacePath table-driven parity", () => {
  type ExpectedClassification = Pick<
    WorkspacePathClassification,
    "category" | "pathType" | "sourceOfTruth" | "parserKind"
  >

  const nullCases = [
    "agent-workspace",
    "agent-workspace-extra/file.md",
    "apps/web/package.json",
    "packages/hax-design/package.json",
    "agent-workspace/indexes/workspace-projection.sqlite",
    "agent-workspace/indexes/nested/doc.md",
    "agent-workspace/policies/constraints.md",
    "agent-workspace/policies/nested/tool-policy.md",
    "agent-workspace/scratch/tmp/.gitkeep",
    "agent-workspace/pi/packages/.gitignore",
    "agent-workspace/.DS_Store",
  ]

  it.each(nullCases)("returns null for %s", (path) => {
    expect(classifyWorkspacePath(path)).toBeNull()
  })

  const canonicalMemory: ExpectedClassification = {
    category: "memory",
    pathType: "project-memory-canonical",
    sourceOfTruth: "canonical-files",
    parserKind: "markdown",
  }
  const orphanMemory: ExpectedClassification = {
    category: "memory",
    pathType: "project-memory-orphan",
    sourceOfTruth: "canonical-files",
    parserKind: "markdown",
  }
  const canonicalFiles = (
    category: WorkspacePathClassification["category"],
    pathType: WorkspacePathClassification["pathType"],
    parserKind: WorkspacePathClassification["parserKind"] = "markdown"
  ): ExpectedClassification => ({
    category,
    pathType,
    sourceOfTruth: "canonical-files",
    parserKind,
  })

  const cases: Array<[string, ExpectedClassification]> = [
    [
      "agent-workspace/manifest.json",
      {
        category: "manifest",
        pathType: "workspace-manifest",
        sourceOfTruth: "canonical-files",
        parserKind: "manifest-json",
      },
    ],
    ["agent-workspace/memory/project/architecture.md", canonicalMemory],
    ["agent-workspace/memory/project/decisions.md", canonicalMemory],
    ["agent-workspace/memory/project/preferences.md", canonicalMemory],
    ["agent-workspace/memory/project/open-questions.md", canonicalMemory],
    ["agent-workspace/memory/project/known-issues.md", canonicalMemory],
    ["agent-workspace/memory/project/ad-hoc-notes.md", orphanMemory],
    [
      "agent-workspace/memory/project/decisions.txt",
      { ...orphanMemory, parserKind: "text" },
    ],
    [
      "agent-workspace/memory/daily/2026-07-31.md",
      canonicalFiles("memory", "daily-memory"),
    ],
    [
      "agent-workspace/memory/research/competitor-scan.md",
      canonicalFiles("memory", "research-memory"),
    ],
    [
      "agent-workspace/memory/misc/loose.md",
      canonicalFiles("memory", "workspace-unknown"),
    ],
    [
      "agent-workspace/memory/loose.md",
      canonicalFiles("memory", "workspace-unknown"),
    ],
    [
      "agent-workspace/plans/active/reindex-plan.md",
      canonicalFiles("plan", "plan"),
    ],
    [
      "agent-workspace/skills/my-skill/SKILL.md",
      canonicalFiles("skill", "skill-definition"),
    ],
    [
      "agent-workspace/skills/my-skill/support.md",
      canonicalFiles("skill", "skill-support"),
    ],
    [
      "agent-workspace/skills/my-skill/assets/logo.png",
      canonicalFiles("skill", "skill-support", "text"),
    ],
    [
      "agent-workspace/evals/regression-checks.md",
      canonicalFiles("eval", "eval"),
    ],
    [
      "agent-workspace/artifacts/report.md",
      canonicalFiles("artifact", "artifact"),
    ],
    [
      "agent-workspace/artifacts/traces/run-events.jsonl",
      canonicalFiles("artifact", "artifact", "jsonl"),
    ],
    [
      "agent-workspace/pi/settings.json",
      canonicalFiles("pi-resource", "workspace-pi-resource", "json"),
    ],
    [
      "agent-workspace/pi/skills/extra/SKILL.md",
      canonicalFiles("pi-resource", "workspace-pi-resource"),
    ],
    [
      "agent-workspace/scratch/tmp/note.md",
      {
        category: "scratch",
        pathType: "scratch",
        sourceOfTruth: "temporary-files",
        parserKind: "markdown",
      },
    ],
    [
      "agent-workspace/system/constraints.md",
      canonicalFiles("policy", "policy"),
    ],
    [
      "agent-workspace/system/self-improvement-policy.md",
      canonicalFiles("policy", "policy"),
    ],
    [
      "agent-workspace/system/tool-policy.md",
      canonicalFiles("policy", "policy"),
    ],
    [
      "agent-workspace/system/workspace-policy.md",
      canonicalFiles("policy", "policy"),
    ],
    [
      "agent-workspace/system/identity.md",
      canonicalFiles("unknown", "workspace-system"),
    ],
    [
      "agent-workspace/system/policies/constraints.md",
      canonicalFiles("unknown", "workspace-system"),
    ],
    [
      "agent-workspace/instructions/AGENTS.md",
      canonicalFiles("unknown", "instruction"),
    ],
    [
      "agent-workspace/README.md",
      canonicalFiles("unknown", "workspace-readme"),
    ],
    ["agent-workspace/index.md", canonicalFiles("unknown", "workspace-index")],
    [
      "agent-workspace/docs/overview.md",
      canonicalFiles("unknown", "workspace-unknown"),
    ],
    [
      "agent-workspace/random.json",
      canonicalFiles("unknown", "workspace-unknown", "json"),
    ],
    [
      "agent-workspace/notes.txt",
      canonicalFiles("unknown", "workspace-unknown", "text"),
    ],
  ]

  it.each(cases)("classifies %s exactly", (path, expected) => {
    expect(classifyWorkspacePath(path)).toEqual({
      canonicalPath: path,
      workspaceRelativePath: path.slice("agent-workspace/".length),
      ...expected,
    })
  })

  it("normalizes windows separators before classifying", () => {
    expect(
      classifyWorkspacePath("agent-workspace\\memory\\project\\decisions.md")
    ).toEqual({
      canonicalPath: "agent-workspace/memory/project/decisions.md",
      workspaceRelativePath: "memory/project/decisions.md",
      category: "memory",
      pathType: "project-memory-canonical",
      sourceOfTruth: "canonical-files",
      parserKind: "markdown",
    })
  })
})

describe("parseWithFallback shared scaffolding", () => {
  function requireClassification(path: string) {
    const classification = classifyWorkspacePath(path)
    if (!classification) {
      throw new Error(`Expected classification for ${path}.`)
    }
    return classification
  }

  const jsonClassification = requireClassification(
    "agent-workspace/pi/settings.json"
  )
  const jsonBaseMetadata = {
    category: "pi-resource",
    canonicalPath: "agent-workspace/pi/settings.json",
    pathType: "workspace-pi-resource",
    sourceOfTruth: "canonical-files",
  }

  it("returns the success result untouched when the builder succeeds", () => {
    const success = {
      parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
      parserKind: jsonClassification.parserKind,
      title: "Settings",
      summary: "ok",
      contentText: "raw",
      metadata: { ok: true },
      records: [],
    }

    expect(
      parseWithFallback(jsonClassification, "raw", {
        title: "Settings",
        buildSuccess: () => success,
      })
    ).toBe(success)
  })

  it("builds a valid:false fallback with parseError metadata when the builder throws", () => {
    const result = parseWithFallback(jsonClassification, "{ broken", {
      title: "Settings",
      buildSuccess: () => {
        throw new SyntaxError("unexpected token")
      },
    })

    expect(result).toEqual({
      parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
      parserKind: "json",
      title: "Settings",
      summary: "{ broken",
      contentText: "{ broken",
      metadata: {
        ...jsonBaseMetadata,
        valid: false,
        parseError: "unexpected token",
      },
      records: [
        {
          stableKey: "document",
          recordType: "document",
          title: "Settings",
          content: "{ broken",
          searchText: expect.any(String),
          order: 0,
          metadata: {
            ...jsonBaseMetadata,
            valid: false,
            parseError: "unexpected token",
          },
        },
      ],
    })
  })

  it("stringifies non-Error thrown values in parseError", () => {
    const result = parseWithFallback(jsonClassification, "raw content", {
      title: "Settings",
      buildSuccess: () => {
        throw 42
      },
    })

    expect(result.metadata).toMatchObject({ valid: false, parseError: "42" })
  })

  it("falls back with a null summary for whitespace-only content", () => {
    const result = parseWithFallback(jsonClassification, "   \n  ", {
      title: "Settings",
      buildSuccess: () => {
        throw new Error("empty")
      },
    })

    expect(result.summary).toBeNull()
    expect(result.metadata).toMatchObject({ valid: false })
  })

  it("parses valid json files field-identically through the shared helper", () => {
    const content =
      '{"theme":"dark","nest":{"a":1},"list":[1,"x",true],"nil":null}'

    expect(parseWorkspaceFile(jsonClassification, content)).toEqual({
      parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
      parserKind: "json",
      title: "Settings",
      summary: content,
      contentText: content,
      metadata: {
        ...jsonBaseMetadata,
        valid: true,
        topLevelKeys: ["theme", "nest", "list", "nil"],
      },
      records: [
        {
          stableKey: "document",
          recordType: "document",
          title: "Settings",
          content,
          searchText: expect.any(String),
          order: 0,
          metadata: {
            ...jsonBaseMetadata,
            valid: true,
            topLevelType: "object",
          },
        },
        {
          stableKey: "key:theme",
          recordType: "json-entry",
          title: "theme",
          content: "dark",
          searchText: expect.any(String),
          order: 1,
          metadata: { ...jsonBaseMetadata, key: "theme" },
        },
        {
          stableKey: "key:nest",
          recordType: "json-entry",
          title: "nest",
          content: "a: 1",
          searchText: expect.any(String),
          order: 2,
          metadata: { ...jsonBaseMetadata, key: "nest" },
        },
        {
          stableKey: "key:list",
          recordType: "json-entry",
          title: "list",
          content: "1, x, true",
          searchText: expect.any(String),
          order: 3,
          metadata: { ...jsonBaseMetadata, key: "list" },
        },
        {
          stableKey: "key:nil",
          recordType: "json-entry",
          title: "nil",
          content: "null",
          searchText: expect.any(String),
          order: 4,
          metadata: { ...jsonBaseMetadata, key: "nil" },
        },
      ],
    })
  })

  it("produces a field-identical fallback for a malformed json file", () => {
    expect(parseWorkspaceFile(jsonClassification, "{ nope")).toEqual({
      parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
      parserKind: "json",
      title: "Settings",
      summary: "{ nope",
      contentText: "{ nope",
      metadata: {
        ...jsonBaseMetadata,
        valid: false,
        parseError: expect.any(String),
      },
      records: [
        {
          stableKey: "document",
          recordType: "document",
          title: "Settings",
          content: "{ nope",
          searchText: expect.any(String),
          order: 0,
          metadata: {
            ...jsonBaseMetadata,
            valid: false,
            parseError: expect.any(String),
          },
        },
      ],
    })
  })

  it("produces a field-identical fallback for a malformed manifest", () => {
    const manifestClassification = requireClassification(
      "agent-workspace/manifest.json"
    )
    const manifestBaseMetadata = {
      category: "manifest",
      canonicalPath: "agent-workspace/manifest.json",
      pathType: "workspace-manifest",
      sourceOfTruth: "canonical-files",
    }

    expect(parseWorkspaceFile(manifestClassification, "{ nope")).toEqual({
      parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
      parserKind: "manifest-json",
      title: "Agent Workspace Manifest",
      summary: "{ nope",
      contentText: "{ nope",
      metadata: {
        ...manifestBaseMetadata,
        valid: false,
        parseError: expect.any(String),
      },
      records: [
        {
          stableKey: "document",
          recordType: "document",
          title: "Agent Workspace Manifest",
          content: "{ nope",
          searchText: expect.any(String),
          order: 0,
          metadata: {
            ...manifestBaseMetadata,
            valid: false,
            parseError: expect.any(String),
          },
        },
      ],
    })
  })

  it("keeps the valid manifest success shape through the shared helper", () => {
    const manifestClassification = requireClassification(
      "agent-workspace/manifest.json"
    )

    const parsed = parseWorkspaceFile(
      manifestClassification,
      JSON.stringify(createDefaultWorkspaceManifest(), null, 2)
    )

    expect(parsed.title).toBe("Agent Workspace Manifest")
    expect(parsed.summary).toBe(
      "Workspace manifest with 10 sections and 4 policies."
    )
    expect(parsed.records).toHaveLength(15)
    expect(parsed.metadata).toMatchObject({
      valid: true,
      manifestVersion: 1,
      sectionCount: 10,
      policyCount: 4,
    })
  })
})
