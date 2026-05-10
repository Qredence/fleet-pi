import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { workspaceItemHandler } from "../../routes/api/workspace/item"
import { workspaceItemsHandler } from "../../routes/api/workspace/items"
import { workspaceReindexHandler } from "../../routes/api/workspace/reindex"
import { workspaceSearchHandler } from "../../routes/api/workspace/search"
import { workspaceFileHandler } from "../../routes/api/workspace/file"
import { workspaceTreeHandler } from "../../routes/api/workspace/tree"

const roots = new Set<string>()
const originalRepoRoot = process.env.FLEET_PI_REPO_ROOT

beforeEach(() => {
  delete process.env.FLEET_PI_REPO_ROOT
})

afterEach(() => {
  process.env.FLEET_PI_REPO_ROOT = originalRepoRoot
  for (const root of roots) {
    rmSync(root, { force: true, recursive: true })
  }
  roots.clear()
})

function createProjectRoot() {
  const root = mkdtempSync(join(tmpdir(), "fleet-pi-workspace-query-"))
  roots.add(root)
  process.env.FLEET_PI_REPO_ROOT = root
  return root
}

function writeWorkspaceFile(
  projectRoot: string,
  relativePath: string,
  content: string
) {
  const absolutePath = join(projectRoot, "agent-workspace", relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function createRequest(path: string, init?: RequestInit) {
  return new Request(`http://localhost:3000${path}`, init)
}

describe("workspace query APIs", () => {
  it("returns structured reindex outcomes and canonical-backed query results", async () => {
    const projectRoot = createProjectRoot()

    writeWorkspaceFile(
      projectRoot,
      "memory/project/preferences.md",
      "# Preferences\n\n- Preference: Searchable workspace memory.\n"
    )
    writeWorkspaceFile(
      projectRoot,
      "plans/active/reindex-plan.md",
      [
        "# Reindex Plan",
        "",
        "## Objective",
        "",
        "Index canonical workspace files with reindex sentinel.",
      ].join("\n")
    )
    writeWorkspaceFile(
      projectRoot,
      "indexes/projection-only.md",
      "# Projection Only\n\ndb-only-sentinel\n"
    )

    const firstReindexResponse = await workspaceReindexHandler()
    const firstReindexBody = (await firstReindexResponse.json()) as {
      outcome: string
      completion: string
      counts: { scanned: number; inserted: number }
      propagation: {
        mode: string
        trigger: { method: string; path: string }
      }
    }

    expect(firstReindexResponse.status).toBe(200)
    expect(firstReindexBody.outcome).toBe("complete")
    expect(firstReindexBody.completion).toBe("complete")
    expect(firstReindexBody.counts.scanned).toBeGreaterThan(0)
    expect(firstReindexBody.counts.inserted).toBeGreaterThan(0)
    expect(firstReindexBody.propagation).toMatchObject({
      mode: "explicit",
      trigger: {
        method: "POST",
        path: "/api/workspace/reindex",
      },
    })

    const itemsResponse = await workspaceItemsHandler()
    const itemsBody = (await itemsResponse.json()) as {
      items: Array<{
        id: string
        canonicalPath: string
        category: string
      }>
    }

    expect(itemsResponse.status).toBe(200)
    expect(
      itemsBody.items.every((item) =>
        item.canonicalPath.startsWith("agent-workspace/")
      )
    ).toBe(true)

    const planItem = itemsBody.items.find(
      (item) =>
        item.canonicalPath === "agent-workspace/plans/active/reindex-plan.md"
    )
    expect(planItem).toBeDefined()
    expect(planItem?.category).toBe("plan")

    const itemResponse = await workspaceItemHandler(
      createRequest(`/api/workspace/item?id=${planItem?.id}`)
    )
    const itemBody = (await itemResponse.json()) as {
      item: {
        id: string
        canonicalPath: string
        version: { contentText: string }
      }
    }

    expect(itemResponse.status).toBe(200)
    expect(itemBody.item.id).toBe(planItem?.id)
    expect(itemBody.item.canonicalPath).toBe(planItem?.canonicalPath)
    expect(itemBody.item.version.contentText).toContain("reindex sentinel")

    const canonicalSearchResponse = await workspaceSearchHandler(
      createRequest("/api/workspace/search?q=reindex%20sentinel")
    )
    const canonicalSearchBody = (await canonicalSearchResponse.json()) as {
      hits: Array<{
        itemId: string
        canonicalPath: string
      }>
    }

    expect(canonicalSearchResponse.status).toBe(200)
    expect(canonicalSearchBody.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: planItem?.id,
          canonicalPath: "agent-workspace/plans/active/reindex-plan.md",
        }),
      ])
    )

    const projectionOnlySearchResponse = await workspaceSearchHandler(
      createRequest("/api/workspace/search?q=db-only-sentinel")
    )
    const projectionOnlySearchBody =
      (await projectionOnlySearchResponse.json()) as {
        hits: Array<{ canonicalPath: string }>
      }

    expect(projectionOnlySearchResponse.status).toBe(200)
    expect(projectionOnlySearchBody.hits).toHaveLength(0)

    const secondReindexResponse = await workspaceReindexHandler()
    const secondReindexBody = (await secondReindexResponse.json()) as {
      counts: {
        scanned: number
        inserted: number
        updated: number
        unchanged: number
      }
    }

    expect(secondReindexResponse.status).toBe(200)
    expect(secondReindexBody.counts.inserted).toBe(0)
    expect(secondReindexBody.counts.updated).toBe(0)
    expect(secondReindexBody.counts.unchanged).toBe(
      firstReindexBody.counts.scanned
    )

    const secondItemsResponse = await workspaceItemsHandler()
    const secondItemsBody = (await secondItemsResponse.json()) as {
      items: Array<{
        id: string
        canonicalPath: string
      }>
    }

    expect(secondItemsResponse.status).toBe(200)
    expect(
      secondItemsBody.items.find(
        (item) =>
          item.canonicalPath === "agent-workspace/plans/active/reindex-plan.md"
      )?.id
    ).toBe(planItem?.id)
  })

  it("keeps canonical file preview authoritative until explicit reindex propagates edits", async () => {
    const projectRoot = createProjectRoot()

    writeWorkspaceFile(
      projectRoot,
      "memory/project/preferences.md",
      "# Preferences\n\n- Preference: alpha-token\n"
    )

    await workspaceReindexHandler()

    const itemsResponse = await workspaceItemsHandler()
    const itemsBody = (await itemsResponse.json()) as {
      items: Array<{ id: string; canonicalPath: string }>
    }
    const preferencesItem = itemsBody.items.find(
      (item) =>
        item.canonicalPath === "agent-workspace/memory/project/preferences.md"
    )

    const initialPreviewResponse = await workspaceFileHandler(
      createRequest(
        "/api/workspace/file?path=agent-workspace/memory/project/preferences.md"
      )
    )
    const initialPreviewBody = (await initialPreviewResponse.json()) as {
      content: string
    }

    expect(initialPreviewResponse.status).toBe(200)
    expect(initialPreviewBody.content).toContain("alpha-token")

    writeWorkspaceFile(
      projectRoot,
      "memory/project/preferences.md",
      "# Preferences\n\n- Preference: beta-token\n"
    )

    const updatedPreviewResponse = await workspaceFileHandler(
      createRequest(
        "/api/workspace/file?path=agent-workspace/memory/project/preferences.md"
      )
    )
    const updatedPreviewBody = (await updatedPreviewResponse.json()) as {
      content: string
    }

    expect(updatedPreviewResponse.status).toBe(200)
    expect(updatedPreviewBody.content).toContain("beta-token")

    const staleDetailResponse = await workspaceItemHandler(
      createRequest(`/api/workspace/item?id=${preferencesItem?.id}`)
    )
    const staleDetailBody = (await staleDetailResponse.json()) as {
      item: { version: { contentText: string } }
    }

    expect(staleDetailResponse.status).toBe(200)
    expect(staleDetailBody.item.version.contentText).toContain("alpha-token")

    const staleSearchResponse = await workspaceSearchHandler(
      createRequest("/api/workspace/search?q=beta-token")
    )
    const staleSearchBody = (await staleSearchResponse.json()) as {
      hits: Array<unknown>
    }

    expect(staleSearchResponse.status).toBe(200)
    expect(staleSearchBody.hits).toHaveLength(0)

    await workspaceReindexHandler()

    const freshDetailResponse = await workspaceItemHandler(
      createRequest(`/api/workspace/item?id=${preferencesItem?.id}`)
    )
    const freshDetailBody = (await freshDetailResponse.json()) as {
      item: {
        id: string
        canonicalPath: string
        version: { contentText: string }
      }
    }

    expect(freshDetailResponse.status).toBe(200)
    expect(freshDetailBody.item.id).toBe(preferencesItem?.id)
    expect(freshDetailBody.item.canonicalPath).toBe(
      "agent-workspace/memory/project/preferences.md"
    )
    expect(freshDetailBody.item.version.contentText).toContain("beta-token")

    const freshSearchResponse = await workspaceSearchHandler(
      createRequest("/api/workspace/search?q=beta-token")
    )
    const freshSearchBody = (await freshSearchResponse.json()) as {
      hits: Array<{
        itemId: string
        canonicalPath: string
      }>
    }

    expect(freshSearchResponse.status).toBe(200)
    expect(freshSearchBody.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: preferencesItem?.id,
          canonicalPath: "agent-workspace/memory/project/preferences.md",
        }),
      ])
    )
  })

  it("retires stale rows after a move and keeps item detail responses non-authoritative for the old path", async () => {
    const projectRoot = createProjectRoot()

    writeWorkspaceFile(
      projectRoot,
      "plans/active/movable-plan.md",
      "# Move Plan\n\nmove-token\n"
    )

    await workspaceReindexHandler()

    const itemsResponse = await workspaceItemsHandler()
    const itemsBody = (await itemsResponse.json()) as {
      items: Array<{ id: string; canonicalPath: string }>
    }
    const oldItem = itemsBody.items.find(
      (item) =>
        item.canonicalPath === "agent-workspace/plans/active/movable-plan.md"
    )

    renameSync(
      join(projectRoot, "agent-workspace/plans/active/movable-plan.md"),
      join(projectRoot, "agent-workspace/plans/completed/movable-plan.md")
    )

    await workspaceReindexHandler()

    const movedItemsResponse = await workspaceItemsHandler()
    const movedItemsBody = (await movedItemsResponse.json()) as {
      items: Array<{ canonicalPath: string }>
    }

    expect(movedItemsResponse.status).toBe(200)
    expect(movedItemsBody.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalPath: "agent-workspace/plans/completed/movable-plan.md",
        }),
      ])
    )
    expect(movedItemsBody.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalPath: "agent-workspace/plans/active/movable-plan.md",
        }),
      ])
    )

    const staleItemResponse = await workspaceItemHandler(
      createRequest(`/api/workspace/item?id=${oldItem?.id}`)
    )
    const staleItemBody = (await staleItemResponse.json()) as {
      code: string
      message: string
    }

    expect(staleItemResponse.status).toBe(404)
    expect(staleItemBody.code).toBe("workspace-item-not-found")
    expect(staleItemBody.message).toContain("not found")

    const movedSearchResponse = await workspaceSearchHandler(
      createRequest("/api/workspace/search?q=move-token")
    )
    const movedSearchBody = (await movedSearchResponse.json()) as {
      hits: Array<{ canonicalPath: string }>
    }

    expect(movedSearchResponse.status).toBe(200)
    expect(movedSearchBody.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalPath: "agent-workspace/plans/completed/movable-plan.md",
        }),
      ])
    )
    expect(movedSearchBody.hits).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalPath: "agent-workspace/plans/active/movable-plan.md",
        }),
      ])
    )
  })

  it("keeps query failures machine-readable when projection is degraded while tree and file reads still work", async () => {
    const projectRoot = createProjectRoot()

    writeWorkspaceFile(
      projectRoot,
      "memory/project/preferences.md",
      "# Preferences\n\n- Preference: stable-token\n"
    )

    await workspaceReindexHandler()

    const invalidSearchResponse = await workspaceSearchHandler(
      createRequest("/api/workspace/search")
    )
    const invalidSearchBody = (await invalidSearchResponse.json()) as {
      code: string
      message: string
    }

    expect(invalidSearchResponse.status).toBe(400)
    expect(invalidSearchBody.code).toBe("workspace-search-query-required")
    expect(invalidSearchBody.message).toContain("query")

    rmSync(
      join(projectRoot, "agent-workspace/indexes/workspace-projection.sqlite"),
      {
        force: true,
        recursive: true,
      }
    )
    mkdirSync(
      join(projectRoot, "agent-workspace/indexes/workspace-projection.sqlite"),
      {
        recursive: true,
      }
    )

    const degradedSearchResponse = await workspaceSearchHandler(
      createRequest("/api/workspace/search?q=stable-token")
    )
    const degradedSearchBody = (await degradedSearchResponse.json()) as {
      code: string
      diagnostics: Array<{ scope: string }>
    }

    expect(degradedSearchResponse.status).toBe(503)
    expect(degradedSearchBody.code).toBe("workspace-projection-unavailable")
    expect(degradedSearchBody.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "projection",
        }),
      ])
    )

    const treeResponse = await workspaceTreeHandler()
    const treeBody = (await treeResponse.json()) as {
      root: string
      nodes: Array<{ path: string }>
    }

    expect(treeResponse.status).toBe(200)
    expect(treeBody.root).toBe("agent-workspace")
    expect(
      treeBody.nodes.some((node) => node.path === "agent-workspace/memory")
    ).toBe(true)

    const fileResponse = await workspaceFileHandler(
      createRequest(
        "/api/workspace/file?path=agent-workspace/memory/project/preferences.md"
      )
    )
    const fileBody = (await fileResponse.json()) as {
      content: string
    }

    expect(fileResponse.status).toBe(200)
    expect(fileBody.content).toContain("stable-token")
  })
})
