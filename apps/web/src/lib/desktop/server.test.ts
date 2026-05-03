import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { getDefaultProjectRoot } from "../app-runtime"
import { DESKTOP_AUTH_HEADER } from "./types"
import { RequestContextError, resolveAppRuntimeContext } from "./server"

const ORIGINAL_STATE_PATH = process.env.FLEET_PI_DESKTOP_STATE_PATH
const ORIGINAL_AUTH_TOKEN = process.env.FLEET_PI_DESKTOP_AUTH_TOKEN

afterEach(() => {
  if (ORIGINAL_STATE_PATH === undefined) {
    delete process.env.FLEET_PI_DESKTOP_STATE_PATH
  } else {
    process.env.FLEET_PI_DESKTOP_STATE_PATH = ORIGINAL_STATE_PATH
  }

  if (ORIGINAL_AUTH_TOKEN === undefined) {
    delete process.env.FLEET_PI_DESKTOP_AUTH_TOKEN
  } else {
    process.env.FLEET_PI_DESKTOP_AUTH_TOKEN = ORIGINAL_AUTH_TOKEN
  }
})

function createDesktopState() {
  const root = mkdtempSync(join(tmpdir(), "fleet-pi-desktop-context-"))
  const statePath = join(root, "desktop-state.json")

  process.env.FLEET_PI_DESKTOP_STATE_PATH = statePath
  process.env.FLEET_PI_DESKTOP_AUTH_TOKEN = "desktop-token"

  return {
    root,
    statePath,
    cleanup: () => rmSync(root, { force: true, recursive: true }),
  }
}

function desktopRequest(token = "desktop-token") {
  return new Request("http://localhost:3000/api/chat/models", {
    headers: { [DESKTOP_AUTH_HEADER]: token },
  })
}

describe("resolveAppRuntimeContext", () => {
  it("falls back to the repo-root browser context when desktop mode is disabled", () => {
    delete process.env.FLEET_PI_DESKTOP_STATE_PATH
    delete process.env.FLEET_PI_DESKTOP_AUTH_TOKEN

    const context = resolveAppRuntimeContext(new Request("http://localhost"))
    const projectRoot = getDefaultProjectRoot()

    expect(context.isDesktop).toBe(false)
    expect(context.projectRoot).toBe(projectRoot)
    expect(context.workspaceRoot).toBe(join(projectRoot, "agent-workspace"))
    expect(context.sessionDir).toBeUndefined()
  })

  it("loads the active desktop project and session directory from the state file", () => {
    const desktopState = createDesktopState()
    try {
      writeFileSync(
        desktopState.statePath,
        `${JSON.stringify(
          {
            version: 1,
            activeProjectRoot: "/tmp/example-project",
            recentProjects: [
              {
                projectRoot: "/tmp/example-project",
                workspaceRoot: "/tmp/example-project/agent-workspace",
                workspaceId: "workspace-123",
              },
            ],
          },
          null,
          2
        )}\n`
      )

      const context = resolveAppRuntimeContext(desktopRequest())
      expect(context.isDesktop).toBe(true)
      expect(context.projectRoot).toBe("/tmp/example-project")
      expect(context.workspaceRoot).toBe("/tmp/example-project/agent-workspace")
      expect(context.workspaceId).toBe("workspace-123")
      expect(context.sessionDir).toBe(
        join(desktopState.root, "workspaces", "workspace-123", "sessions")
      )
    } finally {
      desktopState.cleanup()
    }
  })

  it("rejects desktop requests without the expected auth token", () => {
    const desktopState = createDesktopState()
    try {
      writeFileSync(
        desktopState.statePath,
        `${JSON.stringify({ version: 1, recentProjects: [] }, null, 2)}\n`
      )

      expect(() =>
        resolveAppRuntimeContext(desktopRequest("wrong-token"), {
          requireProject: false,
        })
      ).toThrowError(RequestContextError)

      try {
        resolveAppRuntimeContext(desktopRequest("wrong-token"), {
          requireProject: false,
        })
      } catch (error) {
        expect(error).toBeInstanceOf(RequestContextError)
        expect((error as RequestContextError).status).toBe(401)
      }
    } finally {
      desktopState.cleanup()
    }
  })

  it("requires an active project for project-scoped desktop APIs", () => {
    const desktopState = createDesktopState()
    try {
      writeFileSync(
        desktopState.statePath,
        `${JSON.stringify({ version: 1, recentProjects: [] }, null, 2)}\n`
      )

      expect(() => resolveAppRuntimeContext(desktopRequest())).toThrowError(
        RequestContextError
      )
    } finally {
      desktopState.cleanup()
    }
  })
})
