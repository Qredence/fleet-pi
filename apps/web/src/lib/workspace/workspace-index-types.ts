export const WORKSPACE_INDEX_CATEGORY_VALUES = [
  "manifest",
  "memory",
  "plan",
  "skill",
  "eval",
  "artifact",
  "policy",
  "pi-resource",
  "scratch",
  "unknown",
] as const

export const WORKSPACE_INDEX_SOURCE_OF_TRUTH_VALUES = [
  "canonical-files",
  "temporary-files",
] as const

export const WORKSPACE_SEMANTIC_RECORD_TYPE_VALUES = [
  "document",
  "section",
  "manifest-section",
  "manifest-policy",
  "json-entry",
] as const

export const WORKSPACE_SEMANTIC_PARSER_VERSION = 1

export type WorkspaceIndexCategory =
  (typeof WORKSPACE_INDEX_CATEGORY_VALUES)[number]
export type WorkspaceIndexSourceOfTruth =
  (typeof WORKSPACE_INDEX_SOURCE_OF_TRUTH_VALUES)[number]
export type WorkspaceSemanticRecordType =
  (typeof WORKSPACE_SEMANTIC_RECORD_TYPE_VALUES)[number]

export type WorkspaceParserKind =
  | "manifest-json"
  | "json"
  | "jsonl"
  | "markdown"
  | "text"

export type WorkspacePathType =
  | "workspace-manifest"
  | "workspace-index"
  | "workspace-readme"
  | "instruction"
  | "project-memory-canonical"
  | "project-memory-orphan"
  | "daily-memory"
  | "research-memory"
  | "plan"
  | "skill-definition"
  | "skill-support"
  | "eval"
  | "artifact"
  | "policy"
  | "workspace-pi-resource"
  | "scratch"
  | "workspace-system"
  | "workspace-unknown"

export type WorkspacePathClassification = {
  canonicalPath: string
  workspaceRelativePath: string
  category: WorkspaceIndexCategory
  pathType: WorkspacePathType
  sourceOfTruth: WorkspaceIndexSourceOfTruth
  parserKind: WorkspaceParserKind
}

export type WorkspaceSemanticRecord = {
  stableKey: string
  recordType: WorkspaceSemanticRecordType
  title: string | null
  content: string
  searchText: string
  order: number
  metadata: Record<string, unknown>
}

export type WorkspaceSemanticParseResult = {
  parserVersion: number
  parserKind: WorkspaceParserKind
  title: string | null
  summary: string | null
  contentText: string
  metadata: Record<string, unknown>
  records: Array<WorkspaceSemanticRecord>
}
