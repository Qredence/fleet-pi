import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import { basename, join } from "node:path"
import Database from "better-sqlite3"
import {
  WORKSPACE_INDEX_CATEGORY_VALUES,
  WORKSPACE_INDEX_SOURCE_OF_TRUTH_VALUES,
  WORKSPACE_SEMANTIC_RECORD_TYPE_VALUES,
} from "../workspace/workspace-index-types"
import type { AppRuntimeContext } from "../app-runtime"

export const WORKSPACE_PROJECTION_DATABASE_FILENAME =
  "workspace-projection.sqlite"
export const WORKSPACE_PROJECTION_SCHEMA_VERSION = 2

type ProjectionMigration = {
  version: number
  name: string
  sql: string
}

type ProjectionSeedInput = {
  id: string
  projectRoot: string
  workspaceRoot: string
  displayName: string
  sourceOfTruth: ProjectionSourceOfTruth
  recordedAt: string
}

type ProjectionWorkspaceRootSeedInput = {
  id: string
  projectId: string
  workspaceRoot: string
  sourceOfTruth: ProjectionSourceOfTruth
  recordedAt: string
}

type ProjectionProjectRecord = {
  id: string
  projectRoot: string
  workspaceRoot: string
  displayName: string
  sourceOfTruth: ProjectionSourceOfTruth
  createdAt: string
  updatedAt: string
}

type ProjectionWorkspaceRootRecord = {
  id: string
  projectId: string
  workspaceRoot: string
  sourceOfTruth: ProjectionSourceOfTruth
  createdAt: string
  updatedAt: string
}

type ProjectionSourceOfTruth = "canonical-files"

export type WorkspaceProjectionProjectRow = ProjectionProjectRecord
export type WorkspaceProjectionWorkspaceRootRow = ProjectionWorkspaceRootRecord

export type WorkspaceProjectionItemRow = {
  id: string
  workspaceRootId: string
  canonicalPath: string
  category: (typeof WORKSPACE_INDEX_CATEGORY_VALUES)[number]
  sourceOfTruth: (typeof WORKSPACE_INDEX_SOURCE_OF_TRUTH_VALUES)[number]
  parserKind: string
  currentContentHash: string
  currentVersionId: string | null
  currentVersionNumber: number
  currentParserVersion: number
  byteSize: number
  lastModifiedMs: number
  title: string | null
  summary: string | null
  firstIndexedAt: string
  lastIndexedAt: string
  deletedAt: string | null
}

export type WorkspaceProjectionItemVersionRow = {
  id: string
  itemId: string
  versionNumber: number
  contentHash: string
  parserKind: string
  parserVersion: number
  sourceOfTruth: (typeof WORKSPACE_INDEX_SOURCE_OF_TRUTH_VALUES)[number]
  category: (typeof WORKSPACE_INDEX_CATEGORY_VALUES)[number]
  byteSize: number
  lastModifiedMs: number
  title: string | null
  summary: string | null
  contentText: string
  metadataJson: string
  indexedAt: string
}

export type WorkspaceProjectionSemanticRecordRow = {
  id: string
  itemVersionId: string
  stableKey: string
  recordType: (typeof WORKSPACE_SEMANTIC_RECORD_TYPE_VALUES)[number]
  title: string | null
  content: string
  searchText: string
  metadataJson: string
  sortOrder: number
}

export type WorkspaceProjectionConnection = {
  db: Database.Database
  databasePath: string
  created: boolean
  close: () => void
}

export type WorkspaceProjectionSeedResult = {
  databasePath: string
  schemaVersion: number
  appliedMigrations: Array<number>
  project: WorkspaceProjectionProjectRow
  workspaceRoot: WorkspaceProjectionWorkspaceRootRow
}

const PROJECTION_SOURCE_OF_TRUTH: ProjectionSourceOfTruth = "canonical-files"
const WORKSPACE_ITEM_CATEGORY_SQL = WORKSPACE_INDEX_CATEGORY_VALUES.map(
  (value) => `'${value}'`
).join(", ")
const WORKSPACE_ITEM_SOURCE_SQL = WORKSPACE_INDEX_SOURCE_OF_TRUTH_VALUES.map(
  (value) => `'${value}'`
).join(", ")
const WORKSPACE_SEMANTIC_RECORD_TYPE_SQL =
  WORKSPACE_SEMANTIC_RECORD_TYPE_VALUES.map((value) => `'${value}'`).join(", ")

const WORKSPACE_PROJECTION_MIGRATIONS: ReadonlyArray<ProjectionMigration> = [
  {
    version: 1,
    name: "create_projection_foundation",
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        project_root TEXT NOT NULL UNIQUE,
        workspace_root TEXT NOT NULL,
        display_name TEXT NOT NULL,
        source_of_truth TEXT NOT NULL
          CHECK (source_of_truth = 'canonical-files'),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_roots (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        workspace_root TEXT NOT NULL UNIQUE,
        source_of_truth TEXT NOT NULL
          CHECK (source_of_truth = 'canonical-files'),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS workspace_roots_project_id_idx
      ON workspace_roots(project_id);
    `,
  },
  {
    version: 2,
    name: "create_workspace_index_tables",
    sql: `
      CREATE TABLE IF NOT EXISTS workspace_items (
        id TEXT PRIMARY KEY,
        workspace_root_id TEXT NOT NULL
          REFERENCES workspace_roots(id) ON DELETE CASCADE,
        canonical_path TEXT NOT NULL,
        category TEXT NOT NULL
          CHECK (category IN (${WORKSPACE_ITEM_CATEGORY_SQL})),
        source_of_truth TEXT NOT NULL
          CHECK (source_of_truth IN (${WORKSPACE_ITEM_SOURCE_SQL})),
        parser_kind TEXT NOT NULL,
        current_content_hash TEXT NOT NULL,
        current_version_id TEXT,
        current_version_number INTEGER NOT NULL,
        current_parser_version INTEGER NOT NULL,
        byte_size INTEGER NOT NULL,
        last_modified_ms INTEGER NOT NULL,
        title TEXT,
        summary TEXT,
        first_indexed_at TEXT NOT NULL,
        last_indexed_at TEXT NOT NULL,
        deleted_at TEXT,
        UNIQUE(workspace_root_id, canonical_path)
      );

      CREATE INDEX IF NOT EXISTS workspace_items_workspace_root_idx
      ON workspace_items(workspace_root_id, canonical_path);

      CREATE INDEX IF NOT EXISTS workspace_items_active_idx
      ON workspace_items(workspace_root_id, deleted_at, category);

      CREATE TABLE IF NOT EXISTS workspace_item_versions (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES workspace_items(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        parser_kind TEXT NOT NULL,
        parser_version INTEGER NOT NULL,
        source_of_truth TEXT NOT NULL
          CHECK (source_of_truth IN (${WORKSPACE_ITEM_SOURCE_SQL})),
        category TEXT NOT NULL
          CHECK (category IN (${WORKSPACE_ITEM_CATEGORY_SQL})),
        byte_size INTEGER NOT NULL,
        last_modified_ms INTEGER NOT NULL,
        title TEXT,
        summary TEXT,
        content_text TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        indexed_at TEXT NOT NULL,
        UNIQUE(item_id, version_number)
      );

      CREATE INDEX IF NOT EXISTS workspace_item_versions_item_idx
      ON workspace_item_versions(item_id, indexed_at);

      CREATE INDEX IF NOT EXISTS workspace_item_versions_content_idx
      ON workspace_item_versions(item_id, content_hash, parser_version);

      CREATE TABLE IF NOT EXISTS workspace_semantic_records (
        id TEXT PRIMARY KEY,
        item_version_id TEXT NOT NULL
          REFERENCES workspace_item_versions(id) ON DELETE CASCADE,
        stable_key TEXT NOT NULL,
        record_type TEXT NOT NULL
          CHECK (record_type IN (${WORKSPACE_SEMANTIC_RECORD_TYPE_SQL})),
        title TEXT,
        content TEXT NOT NULL,
        search_text TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        UNIQUE(item_version_id, stable_key)
      );

      CREATE INDEX IF NOT EXISTS workspace_semantic_records_version_idx
      ON workspace_semantic_records(item_version_id, sort_order);
    `,
  },
] as const

export function getWorkspaceProjectionDatabasePath(context: AppRuntimeContext) {
  return join(
    context.workspaceRoot,
    "indexes",
    WORKSPACE_PROJECTION_DATABASE_FILENAME
  )
}

export function openWorkspaceProjection(
  context: AppRuntimeContext
): WorkspaceProjectionConnection {
  const databasePath = getWorkspaceProjectionDatabasePath(context)
  mkdirSync(join(context.workspaceRoot, "indexes"), { recursive: true })

  const created = !existsSync(databasePath)
  const db = new Database(databasePath)
  configureWorkspaceProjection(db)
  applyProjectionMigrations(db)

  return {
    db,
    databasePath,
    created,
    close: () => {
      if (db.open) {
        db.close()
      }
    },
  }
}

export function initializeWorkspaceProjection(
  context: AppRuntimeContext,
  options?: {
    recordedAt?: string
  }
): WorkspaceProjectionSeedResult {
  const connection = openWorkspaceProjection(context)

  try {
    const appliedMigrations = listAppliedProjectionMigrations(connection.db)
    const seeded = seedWorkspaceProjectionConnection(
      connection.db,
      context,
      options
    )

    return {
      databasePath: connection.databasePath,
      schemaVersion: WORKSPACE_PROJECTION_SCHEMA_VERSION,
      appliedMigrations,
      ...seeded,
    }
  } finally {
    connection.close()
  }
}

export function seedWorkspaceProjectionConnection(
  db: Database.Database,
  context: AppRuntimeContext,
  options?: {
    recordedAt?: string
  }
) {
  return seedWorkspaceProjection(db, context, options)
}

export function listWorkspaceProjectionItems(
  db: Database.Database,
  workspaceRootId: string
): Array<WorkspaceProjectionItemRow> {
  return db
    .prepare<[string], WorkspaceProjectionItemRow>(
      `
      SELECT
        id,
        workspace_root_id AS workspaceRootId,
        canonical_path AS canonicalPath,
        category,
        source_of_truth AS sourceOfTruth,
        parser_kind AS parserKind,
        current_content_hash AS currentContentHash,
        current_version_id AS currentVersionId,
        current_version_number AS currentVersionNumber,
        current_parser_version AS currentParserVersion,
        byte_size AS byteSize,
        last_modified_ms AS lastModifiedMs,
        title,
        summary,
        first_indexed_at AS firstIndexedAt,
        last_indexed_at AS lastIndexedAt,
        deleted_at AS deletedAt
      FROM workspace_items
      WHERE workspace_root_id = ?
      ORDER BY canonical_path
    `
    )
    .all(workspaceRootId)
}

function configureWorkspaceProjection(db: Database.Database) {
  db.pragma("foreign_keys = ON")
}

function applyProjectionMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projection_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

  const appliedVersions = new Set(listAppliedProjectionMigrations(db))
  const pendingMigrations = WORKSPACE_PROJECTION_MIGRATIONS.filter(
    (migration) => !appliedVersions.has(migration.version)
  )

  if (pendingMigrations.length === 0) return

  const recordMigration = db.prepare<{
    version: number
    name: string
    appliedAt: string
  }>(`
    INSERT INTO projection_migrations (version, name, applied_at)
    VALUES (@version, @name, @appliedAt)
  `)

  const applyPendingMigrations = db.transaction(
    (migrations: ReadonlyArray<ProjectionMigration>) => {
      const appliedAt = new Date().toISOString()

      for (const migration of migrations) {
        db.exec(migration.sql)
        recordMigration.run({
          version: migration.version,
          name: migration.name,
          appliedAt,
        })
      }
    }
  )

  applyPendingMigrations(pendingMigrations)
}

function listAppliedProjectionMigrations(db: Database.Database) {
  return db
    .prepare<[], { version: number }>(
      "SELECT version FROM projection_migrations ORDER BY version"
    )
    .all()
    .map((migration) => migration.version)
}

function seedWorkspaceProjection(
  db: Database.Database,
  context: AppRuntimeContext,
  options?: {
    recordedAt?: string
  }
) {
  const recordedAt = options?.recordedAt ?? new Date().toISOString()
  const projectId = createProjectionId("project", context.projectRoot)
  const workspaceRootId = createProjectionId(
    "workspace-root",
    context.workspaceRoot
  )

  const projectInput: ProjectionSeedInput = {
    id: projectId,
    projectRoot: context.projectRoot,
    workspaceRoot: context.workspaceRoot,
    displayName: basename(context.projectRoot),
    sourceOfTruth: PROJECTION_SOURCE_OF_TRUTH,
    recordedAt,
  }

  const workspaceRootInput: ProjectionWorkspaceRootSeedInput = {
    id: workspaceRootId,
    projectId,
    workspaceRoot: context.workspaceRoot,
    sourceOfTruth: PROJECTION_SOURCE_OF_TRUTH,
    recordedAt,
  }

  const upsertProject = db.prepare<ProjectionSeedInput>(`
    INSERT INTO projects (
      id,
      project_root,
      workspace_root,
      display_name,
      source_of_truth,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @projectRoot,
      @workspaceRoot,
      @displayName,
      @sourceOfTruth,
      @recordedAt,
      @recordedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      project_root = excluded.project_root,
      workspace_root = excluded.workspace_root,
      display_name = excluded.display_name,
      source_of_truth = excluded.source_of_truth,
      updated_at = excluded.updated_at
  `)

  const upsertWorkspaceRoot = db.prepare<ProjectionWorkspaceRootSeedInput>(`
    INSERT INTO workspace_roots (
      id,
      project_id,
      workspace_root,
      source_of_truth,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @projectId,
      @workspaceRoot,
      @sourceOfTruth,
      @recordedAt,
      @recordedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      workspace_root = excluded.workspace_root,
      source_of_truth = excluded.source_of_truth,
      updated_at = excluded.updated_at
  `)

  const seed = db.transaction(() => {
    upsertProject.run(projectInput)
    upsertWorkspaceRoot.run(workspaceRootInput)
  })

  seed()

  const selectProject = db.prepare<[string], ProjectionProjectRecord>(`
    SELECT
      id,
      project_root AS projectRoot,
      workspace_root AS workspaceRoot,
      display_name AS displayName,
      source_of_truth AS sourceOfTruth,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM projects
    WHERE id = ?
  `)

  const selectWorkspaceRoot = db.prepare<
    [string],
    ProjectionWorkspaceRootRecord
  >(
    `
      SELECT
        id,
        project_id AS projectId,
        workspace_root AS workspaceRoot,
        source_of_truth AS sourceOfTruth,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM workspace_roots
      WHERE id = ?
    `
  )

  const project = selectProject.get(projectId)
  const workspaceRoot = selectWorkspaceRoot.get(workspaceRootId)

  if (!project || !workspaceRoot) {
    throw new Error("Workspace projection seed did not persist required rows.")
  }

  return {
    project,
    workspaceRoot,
  }
}

function createProjectionId(kind: string, value: string) {
  return createHash("sha256").update(`${kind}:${value}`).digest("hex")
}
