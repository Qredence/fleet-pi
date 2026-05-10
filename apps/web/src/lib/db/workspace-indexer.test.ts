import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { bootstrapAgentWorkspace } from "../workspace/bootstrap-agent-workspace"
import { indexWorkspaceProjection } from "./workspace-indexer"
import { openWorkspaceProjection } from "./workspace-projection"
import type { AppRuntimeContext } from "../app-runtime"

const roots = new Set<string>()

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { force: true, recursive: true })
  }
  roots.clear()
})

function createWorkspaceContext(): AppRuntimeContext {
  const projectRoot = mkdtempSync(join(tmpdir(), "fleet-pi-indexer-"))
  roots.add(projectRoot)

  return {
    projectRoot,
    workspaceRoot: join(projectRoot, "agent-workspace"),
  }
}

describe("workspace indexer", () => {
  it("indexes workspace files, semantic records, and ignores projection storage", async () => {
    const context = createWorkspaceContext()
    await bootstrapAgentWorkspace(context)

    writeWorkspaceFile(
      context,
      "memory/project/preferences.md",
      [
        "# Preferences",
        "",
        "## User Identity",
        "",
        "- Preference: User's name is Zachary",
      ].join("\n")
    )
    writeWorkspaceFile(
      context,
      "plans/active/reindex-plan.md",
      [
        "# Reindex Plan",
        "",
        "## Objective",
        "",
        "Index canonical workspace files.",
      ].join("\n")
    )
    writeWorkspaceFile(
      context,
      "skills/execution-plan/SKILL.md",
      [
        "# Execution Plan Skill",
        "",
        "## When to use it",
        "",
        "Use this skill for resumable multi-step work.",
      ].join("\n")
    )
    writeWorkspaceFile(
      context,
      "scratch/tmp/transient-note.md",
      "# Scratch Note\n\nTemporary only.\n"
    )

    const result = await indexWorkspaceProjection(context, {
      recordedAt: "2026-05-10T09:00:00.000Z",
    })

    expect(result.outcome).toBe("complete")
    expect(result.counts).toMatchObject({
      scanned: 9,
      inserted: 9,
      updated: 0,
      unchanged: 0,
      deleted: 0,
    })

    const projection = openWorkspaceProjection(context)

    try {
      const items = projection.db
        .prepare(
          `
            SELECT
              canonical_path AS canonicalPath,
              category,
              source_of_truth AS sourceOfTruth,
              current_version_number AS currentVersionNumber,
              deleted_at AS deletedAt
            FROM workspace_items
            ORDER BY canonical_path
          `
        )
        .all() as Array<{
        canonicalPath: string
        category: string
        sourceOfTruth: string
        currentVersionNumber: number
        deletedAt: string | null
      }>

      expect(items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            canonicalPath: "agent-workspace/manifest.json",
            category: "manifest",
            sourceOfTruth: "canonical-files",
            currentVersionNumber: 1,
            deletedAt: null,
          }),
          expect.objectContaining({
            canonicalPath: "agent-workspace/memory/project/preferences.md",
            category: "memory",
            sourceOfTruth: "canonical-files",
          }),
          expect.objectContaining({
            canonicalPath: "agent-workspace/plans/active/reindex-plan.md",
            category: "plan",
            sourceOfTruth: "canonical-files",
          }),
          expect.objectContaining({
            canonicalPath: "agent-workspace/skills/execution-plan/SKILL.md",
            category: "skill",
            sourceOfTruth: "canonical-files",
          }),
          expect.objectContaining({
            canonicalPath: "agent-workspace/scratch/tmp/transient-note.md",
            category: "scratch",
            sourceOfTruth: "temporary-files",
          }),
        ])
      )
      expect(
        items.some((item) =>
          item.canonicalPath.startsWith("agent-workspace/indexes/")
        )
      ).toBe(false)
      expect(
        items.some((item) => item.canonicalPath.endsWith(".gitkeep"))
      ).toBe(false)

      const records = projection.db
        .prepare(
          `
            SELECT
              workspace_items.canonical_path AS canonicalPath,
              workspace_semantic_records.stable_key AS stableKey,
              workspace_semantic_records.record_type AS recordType
            FROM workspace_semantic_records
            JOIN workspace_item_versions
              ON workspace_item_versions.id = workspace_semantic_records.item_version_id
            JOIN workspace_items
              ON workspace_items.id = workspace_item_versions.item_id
            ORDER BY workspace_items.canonical_path, workspace_semantic_records.sort_order
          `
        )
        .all() as Array<{
        canonicalPath: string
        stableKey: string
        recordType: string
      }>

      expect(records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            canonicalPath: "agent-workspace/manifest.json",
            stableKey: "section:memory",
            recordType: "manifest-section",
          }),
          expect.objectContaining({
            canonicalPath: "agent-workspace/memory/project/preferences.md",
            stableKey: "section:user-identity",
            recordType: "section",
          }),
        ])
      )
    } finally {
      projection.close()
    }
  })

  it("is idempotent for unchanged files and retires deleted items", async () => {
    const context = createWorkspaceContext()
    await bootstrapAgentWorkspace(context)

    writeWorkspaceFile(
      context,
      "memory/project/preferences.md",
      "# Preferences\n\n- Preference: User's name is Zachary\n"
    )
    writeWorkspaceFile(
      context,
      "plans/active/reindex-plan.md",
      "# Reindex Plan\n\nIndex canonical workspace files.\n"
    )

    const first = await indexWorkspaceProjection(context, {
      recordedAt: "2026-05-10T09:00:00.000Z",
    })
    const second = await indexWorkspaceProjection(context, {
      recordedAt: "2026-05-10T09:05:00.000Z",
    })

    expect(first.counts.inserted).toBe(7)
    expect(second.counts).toMatchObject({
      scanned: 7,
      inserted: 0,
      updated: 0,
      unchanged: 7,
      deleted: 0,
    })

    writeWorkspaceFile(
      context,
      "plans/active/reindex-plan.md",
      [
        "# Reindex Plan",
        "",
        "## Objective",
        "",
        "Index canonical workspace files after changes.",
      ].join("\n")
    )
    rmSync(join(context.workspaceRoot, "memory/project/preferences.md"))

    const third = await indexWorkspaceProjection(context, {
      recordedAt: "2026-05-10T09:10:00.000Z",
    })

    expect(third.counts).toMatchObject({
      scanned: 6,
      inserted: 0,
      updated: 1,
      unchanged: 5,
      deleted: 1,
    })

    const projection = openWorkspaceProjection(context)

    try {
      const planItem = projection.db
        .prepare(
          `
            SELECT
              current_version_number AS currentVersionNumber,
              deleted_at AS deletedAt
            FROM workspace_items
            WHERE canonical_path = ?
          `
        )
        .get("agent-workspace/plans/active/reindex-plan.md") as {
        currentVersionNumber: number
        deletedAt: string | null
      }

      const deletedMemory = projection.db
        .prepare(
          `
            SELECT
              deleted_at AS deletedAt,
              current_version_number AS currentVersionNumber
            FROM workspace_items
            WHERE canonical_path = ?
          `
        )
        .get("agent-workspace/memory/project/preferences.md") as {
        deletedAt: string | null
        currentVersionNumber: number
      }

      const planVersionCount = projection.db
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM workspace_item_versions
            WHERE item_id = (
              SELECT id
              FROM workspace_items
              WHERE canonical_path = ?
            )
          `
        )
        .get("agent-workspace/plans/active/reindex-plan.md") as {
        count: number
      }

      expect(planItem.currentVersionNumber).toBe(2)
      expect(planItem.deletedAt).toBeNull()
      expect(planVersionCount.count).toBe(2)
      expect(deletedMemory.currentVersionNumber).toBe(1)
      expect(deletedMemory.deletedAt).toBe("2026-05-10T09:10:00.000Z")
    } finally {
      projection.close()
    }

    writeWorkspaceFile(
      context,
      "plans/active/reindex-plan.md",
      "# Reindex Plan\n\nIndex canonical workspace files.\n"
    )

    const fourth = await indexWorkspaceProjection(context, {
      recordedAt: "2026-05-10T09:15:00.000Z",
    })

    expect(fourth.counts).toMatchObject({
      scanned: 6,
      inserted: 0,
      updated: 1,
      unchanged: 5,
      deleted: 0,
    })

    const reopenedProjection = openWorkspaceProjection(context)

    try {
      const revertedPlan = reopenedProjection.db
        .prepare(
          `
            SELECT
              current_version_number AS currentVersionNumber
            FROM workspace_items
            WHERE canonical_path = ?
          `
        )
        .get("agent-workspace/plans/active/reindex-plan.md") as {
        currentVersionNumber: number
      }

      const revertedVersionCount = reopenedProjection.db
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM workspace_item_versions
            WHERE item_id = (
              SELECT id
              FROM workspace_items
              WHERE canonical_path = ?
            )
          `
        )
        .get("agent-workspace/plans/active/reindex-plan.md") as {
        count: number
      }

      expect(revertedPlan.currentVersionNumber).toBe(3)
      expect(revertedVersionCount.count).toBe(3)
    } finally {
      reopenedProjection.close()
    }
  })
})

function writeWorkspaceFile(
  context: AppRuntimeContext,
  relativePath: string,
  content: string
) {
  const absolutePath = join(context.workspaceRoot, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}
