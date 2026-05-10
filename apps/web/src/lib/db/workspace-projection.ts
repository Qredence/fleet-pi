import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import { basename, join } from "node:path"
import Database from "better-sqlite3"
import type { AppRuntimeContext } from "../app-runtime"

export const WORKSPACE_PROJECTION_DATABASE_FILENAME =
  "workspace-projection.sqlite"
export const WORKSPACE_PROJECTION_SCHEMA_VERSION = 1

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
    const seeded = seedWorkspaceProjection(connection.db, context, options)

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
