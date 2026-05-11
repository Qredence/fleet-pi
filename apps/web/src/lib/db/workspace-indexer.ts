import { createHash } from "node:crypto"
import { readFile, readdir, stat } from "node:fs/promises"
import { join, relative } from "node:path"
import { WORKSPACE_SEMANTIC_PARSER_VERSION } from "../workspace/workspace-index-types"
import {
  classifyWorkspacePath,
  parseWorkspaceFile,
} from "../workspace/workspace-semantic-parsers"
import {
  listWorkspaceProjectionItems,
  openWorkspaceProjection,
  seedWorkspaceProjectionConnection,
} from "./workspace-projection"
import type Database from "better-sqlite3"
import type { AppRuntimeContext } from "../app-runtime"
import type {
  WorkspacePathClassification,
  WorkspaceSemanticParseResult,
  WorkspaceSemanticRecord,
} from "../workspace/workspace-index-types"
import type { WorkspaceProjectionItemRow } from "./workspace-projection"

type WorkspaceIndexDiagnostic = {
  path?: string
  code: string
  severity: "warning" | "error"
  message: string
}

type WorkspaceIndexedSnapshot = {
  classification: WorkspacePathClassification
  contentHash: string
  byteSize: number
  lastModifiedMs: number
  parsed: WorkspaceSemanticParseResult
}

type WorkspaceIndexPlan = {
  generatedAt: string
  diagnostics: Array<WorkspaceIndexDiagnostic>
  insertions: Array<WorkspaceIndexedSnapshot>
  updates: Array<{
    existing: WorkspaceProjectionItemRow
    snapshot: WorkspaceIndexedSnapshot
  }>
  reactivations: Array<{
    existing: WorkspaceProjectionItemRow
    snapshot: WorkspaceIndexedSnapshot
  }>
  unchanged: Array<{
    existing: WorkspaceProjectionItemRow
    snapshot: WorkspaceIndexedSnapshot
  }>
  deletions: Array<WorkspaceProjectionItemRow>
}

export type WorkspaceIndexRunResult = {
  outcome: "complete" | "degraded"
  recordedAt: string
  counts: {
    scanned: number
    inserted: number
    updated: number
    unchanged: number
    deleted: number
    reactivated: number
  }
  diagnostics: Array<WorkspaceIndexDiagnostic>
}

export async function indexWorkspaceProjection(
  context: AppRuntimeContext,
  options?: {
    recordedAt?: string
  }
): Promise<WorkspaceIndexRunResult> {
  const recordedAt = options?.recordedAt ?? new Date().toISOString()
  const connection = openWorkspaceProjection(context)

  try {
    const seeded = seedWorkspaceProjectionConnection(connection.db, context, {
      recordedAt,
    })
    const existingItems = listWorkspaceProjectionItems(
      connection.db,
      seeded.workspaceRoot.id
    )
    const plan = await buildWorkspaceIndexPlan(context, existingItems, {
      recordedAt,
    })

    applyWorkspaceIndexPlan(connection.db, seeded.workspaceRoot.id, plan)

    return {
      outcome: hasErrorDiagnostics(plan.diagnostics) ? "degraded" : "complete",
      recordedAt,
      counts: {
        scanned:
          plan.insertions.length +
          plan.updates.length +
          plan.reactivations.length +
          plan.unchanged.length,
        inserted: plan.insertions.length,
        updated: plan.updates.length,
        unchanged: plan.unchanged.length,
        deleted: plan.deletions.length,
        reactivated: plan.reactivations.length,
      },
      diagnostics: plan.diagnostics,
    }
  } finally {
    connection.close()
  }
}

export async function buildWorkspaceIndexPlan(
  context: AppRuntimeContext,
  existingItems: Array<WorkspaceProjectionItemRow>,
  options?: {
    recordedAt?: string
  }
): Promise<WorkspaceIndexPlan> {
  const recordedAt = options?.recordedAt ?? new Date().toISOString()
  const diagnostics: Array<WorkspaceIndexDiagnostic> = []
  const snapshots = await scanWorkspaceSnapshots(context, diagnostics)
  const existingByPath = new Map(
    existingItems.map((item) => [item.canonicalPath, item])
  )
  const seenPaths = new Set<string>()
  const insertions: Array<WorkspaceIndexedSnapshot> = []
  const updates: Array<{
    existing: WorkspaceProjectionItemRow
    snapshot: WorkspaceIndexedSnapshot
  }> = []
  const reactivations: Array<{
    existing: WorkspaceProjectionItemRow
    snapshot: WorkspaceIndexedSnapshot
  }> = []
  const unchanged: Array<{
    existing: WorkspaceProjectionItemRow
    snapshot: WorkspaceIndexedSnapshot
  }> = []

  for (const snapshot of snapshots) {
    const canonicalPath = snapshot.classification.canonicalPath
    const existing = existingByPath.get(canonicalPath)
    seenPaths.add(canonicalPath)

    if (!existing) {
      insertions.push(snapshot)
      continue
    }

    const matchesCurrentVersion =
      existing.currentContentHash === snapshot.contentHash &&
      existing.currentParserVersion === snapshot.parsed.parserVersion &&
      existing.category === snapshot.classification.category &&
      existing.sourceOfTruth === snapshot.classification.sourceOfTruth &&
      existing.parserKind === snapshot.classification.parserKind

    if (existing.deletedAt && matchesCurrentVersion) {
      reactivations.push({ existing, snapshot })
      continue
    }

    if (!existing.deletedAt && matchesCurrentVersion) {
      unchanged.push({ existing, snapshot })
      continue
    }

    updates.push({ existing, snapshot })
  }

  const deletions = hasErrorDiagnostics(diagnostics)
    ? []
    : existingItems
        .filter((item) => !item.deletedAt && !seenPaths.has(item.canonicalPath))
        .sort((left, right) =>
          left.canonicalPath.localeCompare(right.canonicalPath)
        )

  return {
    generatedAt: recordedAt,
    diagnostics,
    insertions,
    updates,
    reactivations,
    unchanged,
    deletions,
  }
}

async function scanWorkspaceSnapshots(
  context: AppRuntimeContext,
  diagnostics: Array<WorkspaceIndexDiagnostic>
) {
  const absolutePaths = await walkWorkspaceFiles(context.workspaceRoot)
  const snapshots: Array<WorkspaceIndexedSnapshot> = []

  for (const absolutePath of absolutePaths) {
    const canonicalPath = normalizeProjectPath(
      relative(context.projectRoot, absolutePath)
    )
    const classification = classifyWorkspacePath(canonicalPath)
    if (!classification) {
      continue
    }

    try {
      const buffer = await readFile(absolutePath)
      const contentHash = createWorkspaceContentHash(buffer)
      const byteSize = buffer.byteLength
      const lastModifiedMs = Math.floor((await stat(absolutePath)).mtimeMs)
      const parsed = isBinaryBuffer(buffer)
        ? createBinaryParseResult(classification)
        : parseWorkspaceFile(classification, buffer.toString("utf8"))

      snapshots.push({
        classification,
        contentHash,
        byteSize,
        lastModifiedMs,
        parsed,
      })
    } catch (error) {
      diagnostics.push({
        path: canonicalPath,
        code: "workspace-file-read-failed",
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return snapshots.sort((left, right) =>
    left.classification.canonicalPath.localeCompare(
      right.classification.canonicalPath
    )
  )
}

async function walkWorkspaceFiles(directory: string): Promise<Array<string>> {
  const entries = (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name)
  )
  const files: Array<string> = []

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name)
    if (entry.isSymbolicLink()) {
      continue
    }
    if (entry.isDirectory()) {
      files.push(...(await walkWorkspaceFiles(absolutePath)))
      continue
    }
    if (entry.isFile()) {
      files.push(absolutePath)
    }
  }

  return files
}

function applyWorkspaceIndexPlan(
  db: Database.Database,
  workspaceRootId: string,
  plan: WorkspaceIndexPlan
) {
  const insertVersion = db.prepare(`
    INSERT INTO workspace_item_versions (
      id,
      item_id,
      version_number,
      content_hash,
      parser_kind,
      parser_version,
      source_of_truth,
      category,
      byte_size,
      last_modified_ms,
      title,
      summary,
      content_text,
      metadata_json,
      indexed_at
    ) VALUES (
      @id,
      @itemId,
      @versionNumber,
      @contentHash,
      @parserKind,
      @parserVersion,
      @sourceOfTruth,
      @category,
      @byteSize,
      @lastModifiedMs,
      @title,
      @summary,
      @contentText,
      @metadataJson,
      @indexedAt
    )
  `)

  const insertRecord = db.prepare(`
    INSERT INTO workspace_semantic_records (
      id,
      item_version_id,
      stable_key,
      record_type,
      title,
      content,
      search_text,
      metadata_json,
      sort_order
    ) VALUES (
      @id,
      @itemVersionId,
      @stableKey,
      @recordType,
      @title,
      @content,
      @searchText,
      @metadataJson,
      @sortOrder
    )
  `)

  const upsertItem = db.prepare(`
    INSERT INTO workspace_items (
      id,
      workspace_root_id,
      canonical_path,
      category,
      source_of_truth,
      parser_kind,
      current_content_hash,
      current_version_id,
      current_version_number,
      current_parser_version,
      byte_size,
      last_modified_ms,
      title,
      summary,
      first_indexed_at,
      last_indexed_at,
      deleted_at
    ) VALUES (
      @id,
      @workspaceRootId,
      @canonicalPath,
      @category,
      @sourceOfTruth,
      @parserKind,
      @currentContentHash,
      @currentVersionId,
      @currentVersionNumber,
      @currentParserVersion,
      @byteSize,
      @lastModifiedMs,
      @title,
      @summary,
      @firstIndexedAt,
      @lastIndexedAt,
      @deletedAt
    )
    ON CONFLICT(workspace_root_id, canonical_path) DO UPDATE SET
      category = excluded.category,
      source_of_truth = excluded.source_of_truth,
      parser_kind = excluded.parser_kind,
      current_content_hash = excluded.current_content_hash,
      current_version_id = excluded.current_version_id,
      current_version_number = excluded.current_version_number,
      current_parser_version = excluded.current_parser_version,
      byte_size = excluded.byte_size,
      last_modified_ms = excluded.last_modified_ms,
      title = excluded.title,
      summary = excluded.summary,
      first_indexed_at = workspace_items.first_indexed_at,
      last_indexed_at = excluded.last_indexed_at,
      deleted_at = excluded.deleted_at
  `)

  const markDeleted = db.prepare(`
    UPDATE workspace_items
    SET deleted_at = @deletedAt,
        last_indexed_at = @deletedAt
    WHERE id = @id
  `)

  const writePlan = db.transaction(() => {
    for (const snapshot of plan.insertions) {
      const itemId = createDeterministicId(
        "workspace-item",
        snapshot.classification.canonicalPath
      )
      const versionNumber = 1
      const versionId = createVersionId(itemId, versionNumber)
      upsertItem.run({
        id: itemId,
        workspaceRootId,
        canonicalPath: snapshot.classification.canonicalPath,
        category: snapshot.classification.category,
        sourceOfTruth: snapshot.classification.sourceOfTruth,
        parserKind: snapshot.classification.parserKind,
        currentContentHash: snapshot.contentHash,
        currentVersionId: null,
        currentVersionNumber: 0,
        currentParserVersion: snapshot.parsed.parserVersion,
        byteSize: snapshot.byteSize,
        lastModifiedMs: snapshot.lastModifiedMs,
        title: snapshot.parsed.title,
        summary: snapshot.parsed.summary,
        firstIndexedAt: plan.generatedAt,
        lastIndexedAt: plan.generatedAt,
        deletedAt: null,
      })
      writeVersion(
        insertVersion,
        insertRecord,
        itemId,
        versionId,
        versionNumber,
        snapshot,
        plan.generatedAt
      )
      upsertItem.run({
        id: itemId,
        workspaceRootId,
        canonicalPath: snapshot.classification.canonicalPath,
        category: snapshot.classification.category,
        sourceOfTruth: snapshot.classification.sourceOfTruth,
        parserKind: snapshot.classification.parserKind,
        currentContentHash: snapshot.contentHash,
        currentVersionId: versionId,
        currentVersionNumber: versionNumber,
        currentParserVersion: snapshot.parsed.parserVersion,
        byteSize: snapshot.byteSize,
        lastModifiedMs: snapshot.lastModifiedMs,
        title: snapshot.parsed.title,
        summary: snapshot.parsed.summary,
        firstIndexedAt: plan.generatedAt,
        lastIndexedAt: plan.generatedAt,
        deletedAt: null,
      })
    }

    for (const { existing, snapshot } of plan.updates) {
      const versionNumber = existing.currentVersionNumber + 1
      const versionId = createVersionId(existing.id, versionNumber)
      writeVersion(
        insertVersion,
        insertRecord,
        existing.id,
        versionId,
        versionNumber,
        snapshot,
        plan.generatedAt
      )
      upsertItem.run({
        id: existing.id,
        workspaceRootId,
        canonicalPath: snapshot.classification.canonicalPath,
        category: snapshot.classification.category,
        sourceOfTruth: snapshot.classification.sourceOfTruth,
        parserKind: snapshot.classification.parserKind,
        currentContentHash: snapshot.contentHash,
        currentVersionId: versionId,
        currentVersionNumber: versionNumber,
        currentParserVersion: snapshot.parsed.parserVersion,
        byteSize: snapshot.byteSize,
        lastModifiedMs: snapshot.lastModifiedMs,
        title: snapshot.parsed.title,
        summary: snapshot.parsed.summary,
        firstIndexedAt: existing.firstIndexedAt,
        lastIndexedAt: plan.generatedAt,
        deletedAt: null,
      })
    }

    for (const { existing, snapshot } of plan.reactivations) {
      upsertItem.run({
        id: existing.id,
        workspaceRootId,
        canonicalPath: snapshot.classification.canonicalPath,
        category: snapshot.classification.category,
        sourceOfTruth: snapshot.classification.sourceOfTruth,
        parserKind: snapshot.classification.parserKind,
        currentContentHash: snapshot.contentHash,
        currentVersionId: existing.currentVersionId,
        currentVersionNumber: existing.currentVersionNumber,
        currentParserVersion: existing.currentParserVersion,
        byteSize: snapshot.byteSize,
        lastModifiedMs: snapshot.lastModifiedMs,
        title: existing.title ?? snapshot.parsed.title,
        summary: existing.summary ?? snapshot.parsed.summary,
        firstIndexedAt: existing.firstIndexedAt,
        lastIndexedAt: plan.generatedAt,
        deletedAt: null,
      })
    }

    for (const { existing, snapshot } of plan.unchanged) {
      upsertItem.run({
        id: existing.id,
        workspaceRootId,
        canonicalPath: snapshot.classification.canonicalPath,
        category: snapshot.classification.category,
        sourceOfTruth: snapshot.classification.sourceOfTruth,
        parserKind: snapshot.classification.parserKind,
        currentContentHash: existing.currentContentHash,
        currentVersionId: existing.currentVersionId,
        currentVersionNumber: existing.currentVersionNumber,
        currentParserVersion: existing.currentParserVersion,
        byteSize: snapshot.byteSize,
        lastModifiedMs: snapshot.lastModifiedMs,
        title: existing.title ?? snapshot.parsed.title,
        summary: existing.summary ?? snapshot.parsed.summary,
        firstIndexedAt: existing.firstIndexedAt,
        lastIndexedAt: plan.generatedAt,
        deletedAt: null,
      })
    }

    for (const deleted of plan.deletions) {
      markDeleted.run({
        id: deleted.id,
        deletedAt: plan.generatedAt,
      })
    }
  })

  writePlan()
}

function writeVersion(
  insertVersion: Database.Statement,
  insertRecord: Database.Statement,
  itemId: string,
  versionId: string,
  versionNumber: number,
  snapshot: WorkspaceIndexedSnapshot,
  indexedAt: string
) {
  insertVersion.run({
    id: versionId,
    itemId,
    versionNumber,
    contentHash: snapshot.contentHash,
    parserKind: snapshot.classification.parserKind,
    parserVersion: snapshot.parsed.parserVersion,
    sourceOfTruth: snapshot.classification.sourceOfTruth,
    category: snapshot.classification.category,
    byteSize: snapshot.byteSize,
    lastModifiedMs: snapshot.lastModifiedMs,
    title: snapshot.parsed.title,
    summary: snapshot.parsed.summary,
    contentText: snapshot.parsed.contentText,
    metadataJson: JSON.stringify(snapshot.parsed.metadata),
    indexedAt,
  })

  for (const record of snapshot.parsed.records) {
    insertRecord.run({
      id: createRecordId(versionId, record),
      itemVersionId: versionId,
      stableKey: record.stableKey,
      recordType: record.recordType,
      title: record.title,
      content: record.content,
      searchText: record.searchText,
      metadataJson: JSON.stringify(record.metadata),
      sortOrder: record.order,
    })
  }
}

function createWorkspaceContentHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function createDeterministicId(kind: string, value: string) {
  return createHash("sha256").update(`${kind}:${value}`).digest("hex")
}

function createVersionId(itemId: string, versionNumber: number) {
  return createDeterministicId(
    "workspace-item-version",
    `${itemId}:${versionNumber}:${WORKSPACE_SEMANTIC_PARSER_VERSION}`
  )
}

function createRecordId(versionId: string, record: WorkspaceSemanticRecord) {
  return createDeterministicId(
    "workspace-semantic-record",
    `${versionId}:${record.stableKey}`
  )
}

function createBinaryParseResult(
  classification: WorkspacePathClassification
): WorkspaceSemanticParseResult {
  const title = classification.canonicalPath.split("/").at(-1) ?? null
  const metadata = {
    category: classification.category,
    canonicalPath: classification.canonicalPath,
    pathType: classification.pathType,
    sourceOfTruth: classification.sourceOfTruth,
    binary: true,
  }

  return {
    parserVersion: WORKSPACE_SEMANTIC_PARSER_VERSION,
    parserKind: "text",
    title,
    summary: "Binary workspace file stored as metadata only.",
    contentText: "",
    metadata,
    records: [
      {
        stableKey: "document",
        recordType: "document",
        title,
        content: "",
        searchText: classification.canonicalPath.toLowerCase(),
        order: 0,
        metadata,
      },
    ],
  }
}

function isBinaryBuffer(buffer: Buffer) {
  return buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0)
}

function hasErrorDiagnostics(diagnostics: Array<WorkspaceIndexDiagnostic>) {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error")
}

function normalizeProjectPath(path: string) {
  return path.replace(/\\/g, "/")
}
