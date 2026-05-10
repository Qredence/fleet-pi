import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { bootstrapAgentWorkspace } from "../workspace/bootstrap-agent-workspace"
import {
  WORKSPACE_PROJECTION_DATABASE_FILENAME,
  initializeWorkspaceProjection,
  openWorkspaceProjection,
} from "./workspace-projection"
import type { AppRuntimeContext } from "../app-runtime"

const roots = new Set<string>()

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { force: true, recursive: true })
  }
  roots.clear()
})

function createWorkspaceContext(): AppRuntimeContext {
  const projectRoot = mkdtempSync(join(tmpdir(), "fleet-pi-projection-"))
  roots.add(projectRoot)

  return {
    projectRoot,
    workspaceRoot: join(projectRoot, "agent-workspace"),
  }
}

describe("workspace projection", () => {
  it("creates a local sqlite projection under agent-workspace/indexes", () => {
    const context = createWorkspaceContext()
    const seeded = initializeWorkspaceProjection(context, {
      recordedAt: "2026-05-10T07:00:00.000Z",
    })

    expect(seeded.databasePath).toBe(
      join(
        context.workspaceRoot,
        "indexes",
        WORKSPACE_PROJECTION_DATABASE_FILENAME
      )
    )
    expect(existsSync(seeded.databasePath)).toBe(true)
    expect(seeded.schemaVersion).toBe(2)

    const projection = openWorkspaceProjection(context)

    try {
      const tables = projection.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        )
        .all() as Array<{ name: string }>

      expect(tables.map((table) => table.name)).toEqual(
        expect.arrayContaining([
          "projection_migrations",
          "projects",
          "workspace_roots",
          "workspace_items",
          "workspace_item_versions",
          "workspace_semantic_records",
        ])
      )
    } finally {
      projection.close()
    }
  })

  it("upserts project and workspace root rows idempotently", () => {
    const context = createWorkspaceContext()

    const first = initializeWorkspaceProjection(context, {
      recordedAt: "2026-05-10T07:00:00.000Z",
    })
    const second = initializeWorkspaceProjection(context, {
      recordedAt: "2026-05-10T08:00:00.000Z",
    })

    expect(second.project.id).toBe(first.project.id)
    expect(second.project.createdAt).toBe(first.project.createdAt)
    expect(second.project.updatedAt).toBe("2026-05-10T08:00:00.000Z")
    expect(second.workspaceRoot.id).toBe(first.workspaceRoot.id)
    expect(second.workspaceRoot.createdAt).toBe(first.workspaceRoot.createdAt)
    expect(second.workspaceRoot.updatedAt).toBe("2026-05-10T08:00:00.000Z")

    const projection = openWorkspaceProjection(context)

    try {
      const projectCount = projection.db
        .prepare("SELECT COUNT(*) AS count FROM projects")
        .get() as { count: number }
      const workspaceRootCount = projection.db
        .prepare("SELECT COUNT(*) AS count FROM workspace_roots")
        .get() as { count: number }

      expect(projectCount.count).toBe(1)
      expect(workspaceRootCount.count).toBe(1)
      expect(second.project.sourceOfTruth).toBe("canonical-files")
      expect(second.workspaceRoot.sourceOfTruth).toBe("canonical-files")
    } finally {
      projection.close()
    }
  })

  it("bootstraps the projection database during workspace health setup", async () => {
    const context = createWorkspaceContext()

    const health = await bootstrapAgentWorkspace(context)
    const databasePath = join(
      context.workspaceRoot,
      "indexes",
      WORKSPACE_PROJECTION_DATABASE_FILENAME
    )
    const projection = openWorkspaceProjection(context)

    try {
      const projectCount = projection.db
        .prepare("SELECT COUNT(*) AS count FROM projects")
        .get() as { count: number }
      const workspaceRootCount = projection.db
        .prepare("SELECT COUNT(*) AS count FROM workspace_roots")
        .get() as { count: number }

      expect(health.status).toBe("ok")
      expect(health.projection.status).toBe("ok")
      expect(existsSync(databasePath)).toBe(true)
      expect(projectCount.count).toBe(1)
      expect(workspaceRootCount.count).toBe(1)
    } finally {
      projection.close()
    }
  })
})
