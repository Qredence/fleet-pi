import { basename, extname } from "node:path"
import { workspaceManifestSchema } from "./workspace-contract"
import { WORKSPACE_SEMANTIC_PARSER_VERSION } from "./workspace-index-types"
import type {
  WorkspacePathClassification,
  WorkspacePathType,
  WorkspaceSemanticParseResult,
  WorkspaceSemanticRecord,
} from "./workspace-index-types"

const AGENT_WORKSPACE_PREFIX = "agent-workspace/"
const IGNORED_BASENAMES = new Set([".gitkeep", ".gitignore", ".DS_Store"])
const CANONICAL_PROJECT_MEMORY_KEYS = new Set([
  "architecture",
  "decisions",
  "preferences",
  "open-questions",
  "known-issues",
])
const CANONICAL_SYSTEM_POLICY_FILES = new Set([
  "constraints.md",
  "self-improvement-policy.md",
  "tool-policy.md",
  "workspace-policy.md",
])
const MEMORY_STUB_MARKER = "Seeded stub."

export function classifyWorkspacePath(
  canonicalPath: string
): WorkspacePathClassification | null {
  const normalizedPath = normalizePath(canonicalPath)
  if (
    normalizedPath === "agent-workspace" ||
    !normalizedPath.startsWith(AGENT_WORKSPACE_PREFIX)
  ) {
    return null
  }

  const segments = normalizedPath.split("/")
  const fileName = segments.at(-1) ?? ""
  if (IGNORED_BASENAMES.has(fileName)) {
    return null
  }

  const workspaceRelativePath = normalizedPath.slice(
    AGENT_WORKSPACE_PREFIX.length
  )
  const topLevel = segments[1]
  if (topLevel === "indexes") {
    return null
  }

  const parserKind = resolveParserKind(fileName, normalizedPath)

  if (workspaceRelativePath === "manifest.json") {
    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "manifest",
      "workspace-manifest",
      "canonical-files",
      "manifest-json"
    )
  }

  if (topLevel === "memory") {
    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "memory",
      resolveMemoryPathType(segments, fileName),
      "canonical-files",
      parserKind
    )
  }

  if (topLevel === "plans") {
    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "plan",
      "plan",
      "canonical-files",
      parserKind
    )
  }

  if (topLevel === "skills") {
    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "skill",
      fileName === "SKILL.md" ? "skill-definition" : "skill-support",
      "canonical-files",
      parserKind
    )
  }

  if (topLevel === "evals") {
    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "eval",
      "eval",
      "canonical-files",
      parserKind
    )
  }

  if (topLevel === "artifacts") {
    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "artifact",
      "artifact",
      "canonical-files",
      parserKind
    )
  }

  if (topLevel === "pi") {
    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "pi-resource",
      "workspace-pi-resource",
      "canonical-files",
      parserKind
    )
  }

  if (topLevel === "scratch") {
    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "scratch",
      "scratch",
      "temporary-files",
      parserKind
    )
  }

  if (topLevel === "system") {
    if (segments.length === 3 && CANONICAL_SYSTEM_POLICY_FILES.has(fileName)) {
      return createClassification(
        normalizedPath,
        workspaceRelativePath,
        "policy",
        "policy",
        "canonical-files",
        parserKind
      )
    }

    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "unknown",
      "workspace-system",
      "canonical-files",
      parserKind
    )
  }

  if (topLevel === "policies") {
    return null
  }

  if (topLevel === "instructions") {
    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "unknown",
      "instruction",
      "canonical-files",
      parserKind
    )
  }

  if (workspaceRelativePath === "README.md") {
    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "unknown",
      "workspace-readme",
      "canonical-files",
      parserKind
    )
  }

  if (workspaceRelativePath === "index.md") {
    return createClassification(
      normalizedPath,
      workspaceRelativePath,
      "unknown",
      "workspace-index",
      "canonical-files",
      parserKind
    )
  }

  return createClassification(
    normalizedPath,
    workspaceRelativePath,
    "unknown",
    "workspace-unknown",
    "canonical-files",
    parserKind
  )
}

export function parseWorkspaceFile(
  classification: WorkspacePathClassification,
  rawContent: string
): WorkspaceSemanticParseResult {
  const content = normalizeNewlines(rawContent)

  switch (classification.parserKind) {
    case "manifest-json":
      return parseManifestWorkspaceFile(classification, content)
    case "json":
      return parseJsonWorkspaceFile(classification, content)
    case "jsonl":
      return parseJsonlWorkspaceFile(classification, content)
    case "markdown":
      return parseMarkdownWorkspaceFile(classification, content)
    default:
      return parseTextWorkspaceFile(classification, content)
  }
}

function createClassification(
  canonicalPath: string,
  workspaceRelativePath: string,
  category: WorkspacePathClassification["category"],
  pathType: WorkspacePathType,
  sourceOfTruth: WorkspacePathClassification["sourceOfTruth"],
  parserKind: WorkspacePathClassification["parserKind"]
): WorkspacePathClassification {
  return {
    canonicalPath,
    workspaceRelativePath,
    category,
    pathType,
    sourceOfTruth,
    parserKind,
  }
}

function resolveMemoryPathType(segments: Array<string>, fileName: string) {
  if (segments[2] === "project") {
    const memoryKey = basename(fileName, ".md")
    return CANONICAL_PROJECT_MEMORY_KEYS.has(memoryKey)
      ? "project-memory-canonical"
      : "project-memory-orphan"
  }
  if (segments[2] === "daily") {
    return "daily-memory"
  }
  if (segments[2] === "research") {
    return "research-memory"
  }
  return "workspace-unknown"
}

function resolveParserKind(
  fileName: string,
  canonicalPath: string
): WorkspacePathClassification["parserKind"] {
  const extension = extname(fileName).toLowerCase()
  if (canonicalPath === "agent-workspace/manifest.json") {
    return "manifest-json"
  }
  if (extension === ".md") {
    return "markdown"
  }
  if (extension === ".json") {
    return "json"
  }
  if (extension === ".jsonl") {
    return "jsonl"
  }
  return "text"
}

function parseManifestWorkspaceFile(
  classification: WorkspacePathClassification,
  content: string
): WorkspaceSemanticParseResult {
  const baseMetadata = {
    category: classification.category,
    canonicalPath: classification.canonicalPath,
    pathType: classification.pathType,
    sourceOfTruth: classification.sourceOfTruth,
  }

  try {
    const manifest = workspaceManifestSchema.parse(JSON.parse(content))
    const records: Array<WorkspaceSemanticRecord> = [
      createRecord(
        "document",
        "document",
        "Agent Workspace Manifest",
        content,
        {
          ...baseMetadata,
          manifestVersion: manifest.version,
          workspaceRoot: manifest.workspaceRoot,
          sectionCount: manifest.sections.length,
          policyCount: manifest.policies.length,
        },
        0
      ),
      ...manifest.sections.map((section, index) =>
        createRecord(
          `section:${section.name}`,
          "manifest-section",
          section.name,
          `${section.path} (${section.kind})`,
          {
            ...baseMetadata,
            name: section.name,
            path: section.path,
            kind: section.kind,
          },
          index + 1
        )
      ),
      ...manifest.policies.map((policy, index) =>
        createRecord(
          `policy:${policy.key}`,
          "manifest-policy",
          policy.key,
          policy.path,
          {
            ...baseMetadata,
            key: policy.key,
            path: policy.path,
          },
          manifest.sections.length + index + 1
        )
      ),
    ]

    return {
      parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
      parserKind: classification.parserKind,
      title: "Agent Workspace Manifest",
      summary: `Workspace manifest with ${manifest.sections.length} sections and ${manifest.policies.length} policies.`,
      contentText: content,
      metadata: {
        ...baseMetadata,
        valid: true,
        manifestVersion: manifest.version,
        workspaceRoot: manifest.workspaceRoot,
        sectionCount: manifest.sections.length,
        policyCount: manifest.policies.length,
      },
      records,
    }
  } catch (error) {
    return {
      parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
      parserKind: classification.parserKind,
      title: "Agent Workspace Manifest",
      summary: createSummary(content),
      contentText: content,
      metadata: {
        ...baseMetadata,
        valid: false,
        parseError: error instanceof Error ? error.message : String(error),
      },
      records: [
        createRecord(
          "document",
          "document",
          "Agent Workspace Manifest",
          content,
          {
            ...baseMetadata,
            valid: false,
            parseError: error instanceof Error ? error.message : String(error),
          },
          0
        ),
      ],
    }
  }
}

function parseJsonWorkspaceFile(
  classification: WorkspacePathClassification,
  content: string
): WorkspaceSemanticParseResult {
  const baseMetadata = {
    category: classification.category,
    canonicalPath: classification.canonicalPath,
    pathType: classification.pathType,
    sourceOfTruth: classification.sourceOfTruth,
  }

  try {
    const parsed = JSON.parse(content) as unknown
    const topLevelEntries = isRecord(parsed)
      ? Object.entries(parsed).slice(0, 12)
      : []
    const records: Array<WorkspaceSemanticRecord> = [
      createRecord(
        "document",
        "document",
        titleFromPath(classification.canonicalPath),
        content,
        {
          ...baseMetadata,
          valid: true,
          topLevelType: Array.isArray(parsed) ? "array" : typeof parsed,
        },
        0
      ),
      ...topLevelEntries.map(([key, value], index) =>
        createRecord(
          `key:${key}`,
          "json-entry",
          key,
          summarizeJsonValue(value),
          {
            ...baseMetadata,
            key,
          },
          index + 1
        )
      ),
    ]

    return {
      parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
      parserKind: classification.parserKind,
      title: titleFromPath(classification.canonicalPath),
      summary: createSummary(content),
      contentText: content,
      metadata: {
        ...baseMetadata,
        valid: true,
        topLevelKeys: topLevelEntries.map(([key]) => key),
      },
      records,
    }
  } catch (error) {
    return {
      parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
      parserKind: classification.parserKind,
      title: titleFromPath(classification.canonicalPath),
      summary: createSummary(content),
      contentText: content,
      metadata: {
        ...baseMetadata,
        valid: false,
        parseError: error instanceof Error ? error.message : String(error),
      },
      records: [
        createRecord(
          "document",
          "document",
          titleFromPath(classification.canonicalPath),
          content,
          {
            ...baseMetadata,
            valid: false,
            parseError: error instanceof Error ? error.message : String(error),
          },
          0
        ),
      ],
    }
  }
}

function parseJsonlWorkspaceFile(
  classification: WorkspacePathClassification,
  content: string
): WorkspaceSemanticParseResult {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const title = titleFromPath(classification.canonicalPath)
  const baseMetadata = {
    category: classification.category,
    canonicalPath: classification.canonicalPath,
    pathType: classification.pathType,
    sourceOfTruth: classification.sourceOfTruth,
  }
  const lineRecords = lines.slice(0, 20).map((line, index) => {
    try {
      const parsed = JSON.parse(line) as unknown
      return createRecord(
        `line:${index + 1}`,
        "json-entry",
        `Line ${index + 1}`,
        summarizeJsonValue(parsed),
        {
          ...baseMetadata,
          line: index + 1,
          valid: true,
        },
        index + 1
      )
    } catch (error) {
      return createRecord(
        `line:${index + 1}`,
        "json-entry",
        `Line ${index + 1}`,
        line,
        {
          ...baseMetadata,
          line: index + 1,
          valid: false,
          parseError: error instanceof Error ? error.message : String(error),
        },
        index + 1
      )
    }
  })

  return {
    parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
    parserKind: classification.parserKind,
    title,
    summary: createSummary(content),
    contentText: content,
    metadata: {
      ...baseMetadata,
      lineCount: lines.length,
      parsedLineCount: lineRecords.filter(
        (record) => record.metadata.valid === true
      ).length,
    },
    records: [
      createRecord("document", "document", title, content, baseMetadata, 0),
      ...lineRecords,
    ],
  }
}

function parseMarkdownWorkspaceFile(
  classification: WorkspacePathClassification,
  content: string
): WorkspaceSemanticParseResult {
  const headings = extractMarkdownHeadings(content)
  const title =
    headings.find((heading) => heading.depth === 1)?.text ??
    titleFromPath(classification.canonicalPath)
  const sectionRecords = buildMarkdownSectionRecords(
    classification,
    content,
    headings
  )
  const metadata = {
    category: classification.category,
    canonicalPath: classification.canonicalPath,
    pathType: classification.pathType,
    sourceOfTruth: classification.sourceOfTruth,
    headings: headings.map((heading) => heading.text),
    hasDurableContent:
      classification.category === "memory"
        ? hasDurableMemoryContent(content)
        : undefined,
    planStatus:
      classification.category === "plan"
        ? resolvePlanStatus(classification.workspaceRelativePath)
        : undefined,
  }

  return {
    parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
    parserKind: classification.parserKind,
    title,
    summary: createSummary(content),
    contentText: content,
    metadata,
    records: [
      createRecord("document", "document", title, content, metadata, 0),
      ...sectionRecords,
    ],
  }
}

function parseTextWorkspaceFile(
  classification: WorkspacePathClassification,
  content: string
): WorkspaceSemanticParseResult {
  const title = titleFromPath(classification.canonicalPath)
  const metadata = {
    category: classification.category,
    canonicalPath: classification.canonicalPath,
    pathType: classification.pathType,
    sourceOfTruth: classification.sourceOfTruth,
  }

  return {
    parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
    parserKind: classification.parserKind,
    title,
    summary: createSummary(content),
    contentText: content,
    metadata,
    records: [
      createRecord("document", "document", title, content, metadata, 0),
    ],
  }
}

function buildMarkdownSectionRecords(
  classification: WorkspacePathClassification,
  content: string,
  headings: Array<{ depth: number; text: string; lineIndex: number }>
) {
  const lines = content.split("\n")
  const slugCounts = new Map<string, number>()

  return headings.map((heading, index) => {
    const nextHeading = headings.at(index + 1)
    const sectionLines = lines
      .slice(heading.lineIndex + 1, nextHeading?.lineIndex)
      .join("\n")
      .trim()
    const slug = slugify(heading.text)
    const seenCount = slugCounts.get(slug) ?? 0
    slugCounts.set(slug, seenCount + 1)
    const stableKey =
      seenCount === 0 ? `section:${slug}` : `section:${slug}-${seenCount + 1}`

    return createRecord(
      stableKey,
      "section",
      heading.text,
      sectionLines,
      {
        category: classification.category,
        canonicalPath: classification.canonicalPath,
        depth: heading.depth,
        pathType: classification.pathType,
      },
      index + 1
    )
  })
}

function extractMarkdownHeadings(content: string) {
  return content
    .split("\n")
    .map((line, lineIndex) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (!match) {
        return null
      }
      return {
        depth: match[1].length,
        text: match[2].trim(),
        lineIndex,
      }
    })
    .filter(
      (
        heading
      ): heading is { depth: number; text: string; lineIndex: number } =>
        Boolean(heading)
    )
}

function createRecord(
  stableKey: string,
  recordType: WorkspaceSemanticRecord["recordType"],
  title: string | null,
  content: string,
  metadata: Record<string, unknown>,
  order: number
): WorkspaceSemanticRecord {
  return {
    stableKey,
    recordType,
    title,
    content,
    searchText: normalizeSearchText(
      [title, content, metadataText(metadata)].filter(Boolean).join("\n")
    ),
    order,
    metadata,
  }
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/")
}

function normalizeNewlines(content: string) {
  return content.replace(/\r\n?/g, "\n")
}

function normalizeSearchText(content: string) {
  return content.toLowerCase().replace(/\s+/g, " ").trim()
}

function createSummary(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return null
  }
  return normalized.slice(0, 240)
}

function hasDurableMemoryContent(content: string) {
  if (content.includes(MEMORY_STUB_MARKER)) {
    return false
  }

  return content
    .split("\n")
    .map((line) => line.trim())
    .some((line) => line.startsWith("- ") && line.slice(2).trim().length > 0)
}

function resolvePlanStatus(workspaceRelativePath: string) {
  const segments = workspaceRelativePath.split("/")
  return segments[1] ?? "unknown"
}

function titleFromPath(path: string) {
  return basename(path)
    .replace(/\.[^.]+$/, "")
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "section"
}

function summarizeJsonValue(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map((entry) => summarizeJsonValue(entry)).join(", ")
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .slice(0, 6)
      .map(([key, entry]) => `${key}: ${summarizeJsonValue(entry)}`)
      .join(", ")
  }
  return JSON.stringify(value)
}

function metadataText(metadata: Record<string, unknown>) {
  return Object.entries(metadata)
    .filter(
      ([, value]) => typeof value === "string" || typeof value === "number"
    )
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
