import { describe, expect, it } from "vitest"

import { loadAgentWorkspaceHealth } from "@/lib/workspace/bootstrap-agent-workspace"
import {
  loadAgentWorkspaceFile,
  loadAgentWorkspaceTree,
} from "@/lib/workspace/server"

import {
  createDoWorkspaceStore,
  handleWorkspaceFsRequest,
} from "../do-workspace-store"
import {
  DURABLE_WORKSPACE_ROOT,
  createDurableWorkspaceFS,
} from "../durable-workspace-fs"
import { bundledSeedTemplate } from "../seed-template-bundle"

import { nodeWorkspaceSql } from "./node-workspace-sql"

import type { WorkspaceFsRequest } from "../do-workspace-store"
import type { AppRuntimeContext } from "@/lib/app-runtime"

/** The Worker → Durable Object hop, served in-process by the real handler. */
function storeBackedContext() {
  const store = createDoWorkspaceStore(nodeWorkspaceSql())
  store.seed(bundledSeedTemplate())
  const stub = {
    fetch: async (request: Request) =>
      handleWorkspaceFsRequest(
        store,
        (await request.json()) as Partial<WorkspaceFsRequest>
      ),
  }
  const context: AppRuntimeContext = {
    projectRoot: "/",
    workspaceRoot: DURABLE_WORKSPACE_ROOT,
    workspaceFS: createDurableWorkspaceFS(stub),
  }
  return { store, context }
}

describe("Workspace panel over the Durable Object store", () => {
  it("lists the seeded tree and opens a file", async () => {
    const { store, context } = storeBackedContext()
    await store.write(
      "memory/project/preferences.md",
      "# Preferences\n\n- green tea\n"
    )

    const tree = await loadAgentWorkspaceTree(context)
    const top = tree.nodes.map((node) => node.name)
    expect(top).toEqual(expect.arrayContaining(["memory", "pi", "system"]))

    const file = await loadAgentWorkspaceFile(
      context,
      "agent-workspace/memory/project/preferences.md"
    )
    expect(file.content).toContain("green tea")
  })

  it("reports a healthy workspace with the template version", async () => {
    const { context } = storeBackedContext()
    const health = await loadAgentWorkspaceHealth(context)

    expect(health.workspace.available).toBe(true)
    expect(health.template?.version).toBe(bundledSeedTemplate().version)
  })

  it("maps a missing file to a 404 like the sandbox filesystem", async () => {
    const { context } = storeBackedContext()
    await expect(
      loadAgentWorkspaceFile(context, "agent-workspace/scratch/none.md")
    ).rejects.toMatchObject({ status: 404 })
  })
})
