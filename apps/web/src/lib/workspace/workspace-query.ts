import { RequestContextError } from "../app-runtime"
import { indexWorkspaceProjection } from "../db/workspace-indexer"
import {
  getWorkspaceProjectionItemDetail,
  listWorkspaceProjectionItems,
  openWorkspaceProjection,
  searchWorkspaceProjection,
  seedWorkspaceProjectionConnection,
} from "../db/workspace-projection"
import { getErrorMessage } from "../pi/server"
import { loadAgentWorkspaceHealth } from "./bootstrap-agent-workspace"
import { AGENT_WORKSPACE_DIRECTORY } from "./workspace-contract"
import type { AppRuntimeContext } from "../app-runtime"
import type { WorkspaceHealthDiagnostic } from "./bootstrap-agent-workspace"

const WORKSPACE_QUERY_LIMIT = 25

export const WORKSPACE_PROJECTION_PROPAGATION = {
  mode: "explicit",
  trigger: {
    method: "POST",
    path: "/api/workspace/reindex",
  },
  sourceOfTruth: "canonical-files",
} as const

type WorkspaceProjectionApiDiagnostic = {
  scope?: string
  code: string
  severity?: "warning" | "error"
  message: string
  path?: string
}

type WorkspaceProjectionApiBase = {
  workspaceRoot: string
  workspacePath: typeof AGENT_WORKSPACE_DIRECTORY
  propagation: typeof WORKSPACE_PROJECTION_PROPAGATION
}

export type WorkspaceItemSummary = {
  id: string
  canonicalPath: string
  category: string
  sourceOfTruth: string
  parserKind: string
  title: string | null
  summary: string | null
  currentVersionNumber: number
  currentParserVersion: number
  lastIndexedAt: string
  lastModifiedMs: number
}

export type WorkspaceItemsResponse = WorkspaceProjectionApiBase & {
  ok: true
  total: number
  items: Array<WorkspaceItemSummary>
}

export type WorkspaceItemDetailResponse = WorkspaceProjectionApiBase & {
  ok: true
  item: WorkspaceItemSummary & {
    currentContentHash: string
    byteSize: number
    firstIndexedAt: string
    version: {
      id: string
      versionNumber: number
      parserVersion: number
      contentHash: string
      contentText: string
      metadata: Record<string, unknown>
      indexedAt: string
    }
    semanticRecords: Array<{
      id: string
      stableKey: string
      recordType: string
      title: string | null
      content: string
      searchText: string
      metadata: Record<string, unknown>
      sortOrder: number
    }>
  }
}

export type WorkspaceSearchResponse = WorkspaceProjectionApiBase & {
  ok: true
  query: string
  total: number
  hits: Array<
    WorkspaceItemSummary & {
      itemId: string
      recordType: string | null
      recordTitle: string | null
      snippet: string
    }
  >
}

export type WorkspaceQueryErrorResponse = WorkspaceProjectionApiBase & {
  ok: false
  code: string
  message: string
  diagnostics: Array<WorkspaceProjectionApiDiagnostic>
  projection?: {
    status: "degraded"
    path: string
    diagnostics: Array<WorkspaceProjectionApiDiagnostic>
  }
}

export type WorkspaceReindexResponse = WorkspaceProjectionApiBase & {
  ok: boolean
  outcome: "complete" | "degraded"
  completion: "complete" | "partial" | "failed"
  recordedAt: string
  counts: {
    scanned: number
    inserted: number
    updated: number
    unchanged: number
    deleted: number
    reactivated: number
  }
  diagnostics: Array<WorkspaceProjectionApiDiagnostic>
  code?: string
  message?: string
}

export class WorkspaceQueryApiError extends RequestContextError {
  constructor(
    status: number,
    readonly body: WorkspaceQueryErrorResponse
  ) {
    super(body.message, status)
  }
}

export function createUnexpectedWorkspaceQueryErrorResponse(
  context: AppRuntimeContext,
  error: unknown
): WorkspaceQueryErrorResponse {
  return createWorkspaceQueryFailureResponse(
    context,
    "workspace-query-failed",
    getErrorMessage(error),
    []
  )
}

export async function createWorkspaceReindexResponse(
  context: AppRuntimeContext
): Promise<{ status: number; body: WorkspaceReindexResponse }> {
  const recordedAt = new Date().toISOString()
  const health = await loadAgentWorkspaceHealth(context)

  if (!health.workspace.available || health.projection.status === "degraded") {
    const failure = createProjectionFailureResponse(
      context,
      health.projection.diagnostics,
      "Workspace projection is unavailable for reindex.",
      "workspace-projection-unavailable"
    )

    return {
      status: 503,
      body: {
        ...createWorkspaceQueryBase(context),
        ok: false,
        outcome: "degraded",
        completion: "failed",
        recordedAt,
        counts: createEmptyCounts(),
        diagnostics: failure.diagnostics,
        code: failure.code,
        message: failure.message,
      },
    }
  }

  try {
    const result = await indexWorkspaceProjection(context, { recordedAt })
    return {
      status: 200,
      body: {
        ...createWorkspaceQueryBase(context),
        ok: result.outcome === "complete",
        outcome: result.outcome,
        completion:
          result.outcome === "complete"
            ? "complete"
            : result.diagnostics.length > 0
              ? "partial"
              : "failed",
        recordedAt: result.recordedAt,
        counts: result.counts,
        diagnostics: result.diagnostics,
      },
    }
  } catch (error) {
    return {
      status: 503,
      body: {
        ...createWorkspaceQueryBase(context),
        ok: false,
        outcome: "degraded",
        completion: "failed",
        recordedAt,
        counts: createEmptyCounts(),
        diagnostics: [
          {
            code: "workspace-reindex-failed",
            severity: "error",
            message: getErrorMessage(error),
          },
        ],
        code: "workspace-reindex-failed",
        message: getErrorMessage(error),
      },
    }
  }
}

export async function createWorkspaceItemsResponse(
  context: AppRuntimeContext
): Promise<WorkspaceItemsResponse> {
  const projection = await openAvailableWorkspaceProjection(context)

  try {
    const items = listWorkspaceProjectionItems(
      projection.connection.db,
      projection.workspaceRootId
    ).map(toWorkspaceItemSummary)

    return {
      ...createWorkspaceQueryBase(context),
      ok: true,
      total: items.length,
      items,
    }
  } finally {
    projection.connection.close()
  }
}

export async function createWorkspaceItemDetailResponse(
  context: AppRuntimeContext,
  itemId: string | null
): Promise<WorkspaceItemDetailResponse> {
  if (!itemId?.trim()) {
    throw createValidationError(
      context,
      400,
      "workspace-item-id-required",
      "Missing workspace item id."
    )
  }

  const projection = await openAvailableWorkspaceProjection(context)

  try {
    const detail = getWorkspaceProjectionItemDetail(
      projection.connection.db,
      projection.workspaceRootId,
      itemId.trim()
    )

    if (!detail) {
      throw createValidationError(
        context,
        404,
        "workspace-item-not-found",
        "Workspace item was not found."
      )
    }

    return {
      ...createWorkspaceQueryBase(context),
      ok: true,
      item: {
        ...toWorkspaceItemSummary(detail.item),
        currentContentHash: detail.item.currentContentHash,
        byteSize: detail.item.byteSize,
        firstIndexedAt: detail.item.firstIndexedAt,
        version: {
          id: detail.version.id,
          versionNumber: detail.version.versionNumber,
          parserVersion: detail.version.parserVersion,
          contentHash: detail.version.contentHash,
          contentText: detail.version.contentText,
          metadata: parseJsonObject(detail.version.metadataJson),
          indexedAt: detail.version.indexedAt,
        },
        semanticRecords: detail.semanticRecords.map((record) => ({
          id: record.id,
          stableKey: record.stableKey,
          recordType: record.recordType,
          title: record.title,
          content: record.content,
          searchText: record.searchText,
          metadata: parseJsonObject(record.metadataJson),
          sortOrder: record.sortOrder,
        })),
      },
    }
  } finally {
    projection.connection.close()
  }
}

export async function createWorkspaceSearchResponse(
  context: AppRuntimeContext,
  query: string | null
): Promise<WorkspaceSearchResponse> {
  const normalizedQuery = query?.trim() ?? ""
  if (!normalizedQuery) {
    throw createValidationError(
      context,
      400,
      "workspace-search-query-required",
      "Missing workspace search query."
    )
  }

  const projection = await openAvailableWorkspaceProjection(context)

  try {
    const rows = searchWorkspaceProjection(
      projection.connection.db,
      projection.workspaceRootId,
      normalizedQuery,
      { limit: WORKSPACE_QUERY_LIMIT }
    )

    const dedupedHits = new Map<
      string,
      WorkspaceSearchResponse["hits"][number]
    >()

    for (const row of rows) {
      if (dedupedHits.has(row.itemId)) {
        continue
      }

      dedupedHits.set(row.itemId, {
        ...toWorkspaceSearchItemSummary(row),
        itemId: row.itemId,
        recordType: row.recordType,
        recordTitle: row.recordTitle,
        snippet: createSnippet(
          row.recordContent ??
            row.recordSearchText ??
            row.summary ??
            row.canonicalPath,
          normalizedQuery
        ),
      })

      if (dedupedHits.size >= WORKSPACE_QUERY_LIMIT) {
        break
      }
    }

    const hits = [...dedupedHits.values()]

    return {
      ...createWorkspaceQueryBase(context),
      ok: true,
      query: normalizedQuery,
      total: hits.length,
      hits,
    }
  } finally {
    projection.connection.close()
  }
}

function createWorkspaceQueryBase(
  context: AppRuntimeContext
): WorkspaceProjectionApiBase {
  return {
    workspaceRoot: context.workspaceRoot,
    workspacePath: AGENT_WORKSPACE_DIRECTORY,
    propagation: WORKSPACE_PROJECTION_PROPAGATION,
  }
}

async function openAvailableWorkspaceProjection(context: AppRuntimeContext) {
  const health = await loadAgentWorkspaceHealth(context)

  if (!health.workspace.available) {
    throw new WorkspaceQueryApiError(
      503,
      createWorkspaceQueryFailureResponse(
        context,
        "workspace-unavailable",
        "Workspace is unavailable.",
        health.diagnostics
      )
    )
  }

  if (health.projection.status === "degraded") {
    throw new WorkspaceQueryApiError(
      503,
      createProjectionFailureResponse(
        context,
        health.projection.diagnostics,
        "Workspace projection is degraded.",
        "workspace-projection-unavailable"
      )
    )
  }

  const connection = openWorkspaceProjection(context)

  try {
    const seeded = seedWorkspaceProjectionConnection(connection.db, context)
    return {
      connection,
      workspaceRootId: seeded.workspaceRoot.id,
    }
  } catch (error) {
    connection.close()
    throw new WorkspaceQueryApiError(
      503,
      createWorkspaceQueryFailureResponse(
        context,
        "workspace-projection-unavailable",
        getErrorMessage(error),
        [
          {
            scope: "projection",
            code: "workspace-projection-open-failed",
            severity: "error",
            message: getErrorMessage(error),
          },
        ]
      )
    )
  }
}

function createValidationError(
  context: AppRuntimeContext,
  status: number,
  code: string,
  message: string
) {
  return new WorkspaceQueryApiError(
    status,
    createWorkspaceQueryFailureResponse(context, code, message, [])
  )
}

function createProjectionFailureResponse(
  context: AppRuntimeContext,
  diagnostics: Array<WorkspaceHealthDiagnostic>,
  message: string,
  code: string
): WorkspaceQueryErrorResponse {
  return {
    ...createWorkspaceQueryFailureResponse(context, code, message, diagnostics),
    projection: {
      status: "degraded",
      path: "agent-workspace/indexes",
      diagnostics,
    },
  }
}

function createWorkspaceQueryFailureResponse(
  context: AppRuntimeContext,
  code: string,
  message: string,
  diagnostics: Array<WorkspaceProjectionApiDiagnostic>
): WorkspaceQueryErrorResponse {
  return {
    ...createWorkspaceQueryBase(context),
    ok: false,
    code,
    message,
    diagnostics,
  }
}

function toWorkspaceItemSummary(item: {
  id: string
  canonicalPath: string
  category: string
  sourceOfTruth: string
  parserKind: string
  title: string | null
  summary: string | null
  currentVersionNumber: number
  currentParserVersion: number
  lastIndexedAt: string
  lastModifiedMs: number
}) {
  return {
    id: item.id,
    canonicalPath: item.canonicalPath,
    category: item.category,
    sourceOfTruth: item.sourceOfTruth,
    parserKind: item.parserKind,
    title: item.title,
    summary: item.summary,
    currentVersionNumber: item.currentVersionNumber,
    currentParserVersion: item.currentParserVersion,
    lastIndexedAt: item.lastIndexedAt,
    lastModifiedMs: item.lastModifiedMs,
  }
}

function toWorkspaceSearchItemSummary(row: {
  itemId: string
  canonicalPath: string
  category: string
  sourceOfTruth: string
  parserKind: string
  title: string | null
  summary: string | null
  currentVersionNumber: number
  currentParserVersion: number
  lastIndexedAt: string
  lastModifiedMs: number
}) {
  return {
    id: row.itemId,
    canonicalPath: row.canonicalPath,
    category: row.category,
    sourceOfTruth: row.sourceOfTruth,
    parserKind: row.parserKind,
    title: row.title,
    summary: row.summary,
    currentVersionNumber: row.currentVersionNumber,
    currentParserVersion: row.currentParserVersion,
    lastIndexedAt: row.lastIndexedAt,
    lastModifiedMs: row.lastModifiedMs,
  }
}

function createEmptyCounts() {
  return {
    scanned: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    deleted: 0,
    reactivated: 0,
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function createSnippet(content: string, query: string) {
  const normalizedContent = content.replace(/\s+/g, " ").trim()
  if (!normalizedContent) {
    return ""
  }

  const lowerContent = normalizedContent.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const matchIndex = lowerContent.indexOf(lowerQuery)
  if (matchIndex === -1) {
    return normalizedContent.slice(0, 240)
  }

  const start = Math.max(0, matchIndex - 40)
  const end = Math.min(
    normalizedContent.length,
    matchIndex + lowerQuery.length + 80
  )
  return normalizedContent.slice(start, end)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
