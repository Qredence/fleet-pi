import { USER_VOLUME_ROOT } from "../mutation-tier"

import { userPiDurableName } from "./durable-binding"
import { readDurableNamespace } from "./durable-namespace"

import type { WorkspaceFS } from "../../workspace/workspace-fs"
import type { WorkspaceFsRequest } from "./do-workspace-store"

type FetchStub = { fetch: (input: Request) => Promise<Response> }

/** Root the Workspace panel uses for the Durable Object store. */
export const DURABLE_WORKSPACE_ROOT = USER_VOLUME_ROOT

/**
 * Workspace panel filesystem over the user's Durable Object store, for
 * hosted users without a Daytona key. Errors carry Node-style codes so the
 * existing workspace server maps them unchanged.
 */
export function createDurableWorkspaceFS(stub: FetchStub): WorkspaceFS {
  async function call<T>(body: WorkspaceFsRequest): Promise<T> {
    const response = await stub.fetch(
      new Request("https://user-pi-durable/workspace/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    )
    const json = (await response.json()) as T & {
      code?: string
      message?: string
    }
    if (!response.ok) {
      throw Object.assign(
        new Error(json.message ?? json.code ?? "Workspace store error"),
        { code: json.code ?? "EIO" }
      )
    }
    return json
  }

  return {
    stat: async (path) => {
      const info = await call<{ kind: "file" | "dir"; size?: number }>({
        op: "stat",
        path,
      })
      return {
        isDirectory: () => info.kind === "dir",
        isFile: () => info.kind === "file",
        size: info.size,
      }
    },
    access: async (path) => {
      await call({ op: "stat", path })
    },
    mkdir: async (path) => {
      await call({ op: "mkdir", path })
    },
    writeFile: async (path, content, options) => {
      await call({
        op: "write",
        path,
        content,
        exclusive: options?.flag === "wx",
      })
    },
    readFile: async (path) =>
      (await call<{ content: string }>({ op: "read", path })).content,
    readdir: async (path) =>
      (
        await call<Array<{ name: string; isDirectory: boolean }>>({
          op: "readdir",
          path,
        })
      ).map((entry) => ({
        name: entry.name,
        isDirectory: () => entry.isDirectory,
        isFile: () => !entry.isDirectory,
      })),
  }
}

/** The user's Durable Object store as a WorkspaceFS, or undefined off Workers. */
export function durableWorkspaceFSForUser(
  userId: string
): WorkspaceFS | undefined {
  const namespace = readDurableNamespace()
  if (!namespace) return undefined
  return createDurableWorkspaceFS(
    namespace.getByName(userPiDurableName(userId))
  )
}
