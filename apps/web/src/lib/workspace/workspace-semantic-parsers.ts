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
  const context: ClassificationContext = {
    segments,
    workspaceRelativePath,
    fileName,
  }

  const rule = CLASSIFICATION_RULES.find((entry) => entry.match(context))
  if (!rule) {
    return null
  }

  const details = rule.classify(context)
  if (!details) {
    return null
  }

  return createClassification(
    normalizedPath,
    workspaceRelativePath,
    details.category,
    details.pathType,
    details.sourceOfTruth,
    resolveParserKind(fileName, normalizedPath)
  )
}

type ClassificationDetails = {
  category: WorkspacePathClassification["category"]
  pathType: WorkspacePathClassification["pathType"]
  sourceOfTruth: WorkspacePathClassification["sourceOfTruth"]
}

interface ClassificationContext {
  segments: Array<string>
  workspaceRelativePath: string
  fileName: string
}

interface ClassificationRule {
  match: (context: ClassificationContext) => boolean
  classify: (context: ClassificationContext) => ClassificationDetails | null
}

function matchTopLevel(topLevel: string) {
  return (context: ClassificationContext) => context.segments[1] === topLevel
}

function matchWorkspacePath(workspaceRelativePath: string) {
  return (context: ClassificationContext) =>
    context.workspaceRelativePath === workspaceRelativePath
}

function simpleRule(
  match: ClassificationRule["match"],
  details: ClassificationDetails
): ClassificationRule {
  return { match, classify: () => details }
}

const CLASSIFICATION_RULES: Array<ClassificationRule> = [
  { match: matchTopLevel("indexes"), classify: () => null },
  simpleRule(matchWorkspacePath("manifest.json"), {
    category: "manifest",
    pathType: "workspace-manifest",
    sourceOfTruth: "canonical-files",
  }),
  {
    match: matchTopLevel("memory"),
    classify: (context) => ({
      category: "memory",
      pathType: resolveMemoryPathType(context.segments, context.fileName),
      sourceOfTruth: "canonical-files",
    }),
  },
  simpleRule(matchTopLevel("plans"), {
    category: "plan",
    pathType: "plan",
    sourceOfTruth: "canonical-files",
  }),
  {
    match: matchTopLevel("skills"),
    classify: (context) => ({
      category: "skill",
      pathType: resolveSkillPathType(context.fileName),
      sourceOfTruth: "canonical-files",
    }),
  },
  simpleRule(matchTopLevel("evals"), {
    category: "eval",
    pathType: "eval",
    sourceOfTruth: "canonical-files",
  }),
  simpleRule(matchTopLevel("artifacts"), {
    category: "artifact",
    pathType: "artifact",
    sourceOfTruth: "canonical-files",
  }),
  simpleRule(matchTopLevel("pi"), {
    category: "pi-resource",
    pathType: "workspace-pi-resource",
    sourceOfTruth: "canonical-files",
  }),
  simpleRule(matchTopLevel("scratch"), {
    category: "scratch",
    pathType: "scratch",
    sourceOfTruth: "temporary-files",
  }),
  { match: matchTopLevel("system"), classify: resolveSystemClassification },
  { match: matchTopLevel("policies"), classify: () => null },
  simpleRule(matchTopLevel("instructions"), {
    category: "unknown",
    pathType: "instruction",
    sourceOfTruth: "canonical-files",
  }),
  simpleRule(matchWorkspacePath("README.md"), {
    category: "unknown",
    pathType: "workspace-readme",
    sourceOfTruth: "canonical-files",
  }),
  simpleRule(matchWorkspacePath("index.md"), {
    category: "unknown",
    pathType: "workspace-index",
    sourceOfTruth: "canonical-files",
  }),
  simpleRule(() => true, {
    category: "unknown",
    pathType: "workspace-unknown",
    sourceOfTruth: "canonical-files",
  }),
]

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

function resolveSkillPathType(fileName: string): WorkspacePathType {
  return fileName === "SKILL.md" ? "skill-definition" : "skill-support"
}

function resolveSystemClassification(
  context: ClassificationContext
): ClassificationDetails {
  if (
    context.segments.length === 3 &&
    CANONICAL_SYSTEM_POLICY_FILES.has(context.fileName)
  ) {
    return {
      category: "policy",
      pathType: "policy",
      sourceOfTruth: "canonical-files",
    }
  }

  return {
    category: "unknown",
    pathType: "workspace-system",
    sourceOfTruth: "canonical-files",
  }
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

type WorkspaceParseBaseMetadata = {
  category: WorkspacePathClassification["category"]
  canonicalPath: string
  pathType: WorkspacePathClassification["pathType"]
  sourceOfTruth: WorkspacePathClassification["sourceOfTruth"]
}

interface WorkspaceParseSpec {
  title: string
  buildSuccess: (
    baseMetadata: WorkspaceParseBaseMetadata
  ) => WorkspaceSemanticParseResult
}

export function parseWithFallback(
  classification: WorkspacePathClassification,
  content: string,
  spec: WorkspaceParseSpec
): WorkspaceSemanticParseResult {
  const baseMetadata = createParseBaseMetadata(classification)

  try {
    return spec.buildSuccess(baseMetadata)
  } catch (error) {
    const parseError = error instanceof Error ? error.message : String(error)
    const metadata = { ...baseMetadata, valid: false, parseError }
    return {
      parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
      parserKind: classification.parserKind,
      title: spec.title,
      summary: createSummary(content),
      contentText: content,
      metadata,
      records: [
        createRecord("document", "document", spec.title, content, metadata, 0),
      ],
    }
  }
}

function createParseBaseMetadata(
  classification: WorkspacePathClassification
): WorkspaceParseBaseMetadata {
  return {
    category: classification.category,
    canonicalPath: classification.canonicalPath,
    pathType: classification.pathType,
    sourceOfTruth: classification.sourceOfTruth,
  }
}

function parseManifestWorkspaceFile(
  classification: WorkspacePathClassification,
  content: string
): WorkspaceSemanticParseResult {
  return parseWithFallback(classification, content, {
    title: "Agent Workspace Manifest",
    buildSuccess(baseMetadata) {
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
    },
  })
}

function parseJsonWorkspaceFile(
  classification: WorkspacePathClassification,
  content: string
): WorkspaceSemanticParseResult {
  const title = titleFromPath(classification.canonicalPath)

  return parseWithFallback(classification, content, {
    title,
    buildSuccess(baseMetadata) {
      const parsed = JSON.parse(content) as unknown
      const topLevelEntries = isRecord(parsed)
        ? Object.entries(parsed).slice(0, 12)
        : []
      const records: Array<WorkspaceSemanticRecord> = [
        createRecord(
          "document",
          "document",
          title,
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
        title,
        summary: createSummary(content),
        contentText: content,
        metadata: {
          ...baseMetadata,
          valid: true,
          topLevelKeys: topLevelEntries.map(([key]) => key),
        },
        records,
      }
    },
  })
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
