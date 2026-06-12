import { describe, expect, it } from "vitest"
import {
  extractWorkspaceFilePathFromToolInput,
  isPathWithinScope,
  normalizeWorkspaceFilePath,
  resolveWorkspacePanelTarget,
  resolveWorkspacePathFromToolInput,
} from "./workspace-path-nav"

describe("normalizeWorkspaceFilePath", () => {
  it("accepts agent-workspace relative paths", () => {
    expect(
      normalizeWorkspaceFilePath("agent-workspace/artifacts/reports/summary.md")
    ).toBe("agent-workspace/artifacts/reports/summary.md")
  })

  it("accepts bare artifacts paths", () => {
    expect(normalizeWorkspaceFilePath("artifacts/reports/summary.md")).toBe(
      "agent-workspace/artifacts/reports/summary.md"
    )
  })

  it("strips sandbox prefixes from absolute paths", () => {
    expect(
      normalizeWorkspaceFilePath(
        "/project/sandbox/repo/agent-workspace/memory/project/decisions.md"
      )
    ).toBe("agent-workspace/memory/project/decisions.md")
  })

  it("rejects repo-root paths outside agent-workspace", () => {
    expect(normalizeWorkspaceFilePath("apps/web/package.json")).toBeNull()
    expect(normalizeWorkspaceFilePath("/tmp/outside.md")).toBeNull()
  })

  it("collapses parent segments inside agent-workspace paths", () => {
    expect(
      normalizeWorkspaceFilePath(
        "agent-workspace/artifacts/../memory/project/decisions.md"
      )
    ).toBe("agent-workspace/memory/project/decisions.md")
  })

  it("rejects paths that escape agent-workspace after collapsing", () => {
    expect(
      normalizeWorkspaceFilePath("agent-workspace/../../etc/passwd")
    ).toBeNull()
  })
})

describe("isPathWithinScope", () => {
  it("accepts exact scope matches and descendants", () => {
    expect(
      isPathWithinScope(
        "agent-workspace/artifacts/reports/summary.md",
        "agent-workspace/artifacts"
      )
    ).toBe(true)
    expect(
      isPathWithinScope(
        "agent-workspace/artifacts",
        "agent-workspace/artifacts"
      )
    ).toBe(true)
  })

  it("rejects paths outside the scope", () => {
    expect(
      isPathWithinScope(
        "agent-workspace/memory/project/decisions.md",
        "agent-workspace/artifacts"
      )
    ).toBe(false)
  })
})

describe("resolveWorkspacePanelTarget", () => {
  it("routes artifact paths to the artifacts panel", () => {
    expect(
      resolveWorkspacePanelTarget(
        "agent-workspace/artifacts/reports/summary.md"
      )
    ).toEqual({
      panel: "artifacts",
      path: "agent-workspace/artifacts/reports/summary.md",
    })
  })

  it("routes other workspace paths to the workspace panel", () => {
    expect(
      resolveWorkspacePanelTarget("agent-workspace/memory/project/decisions.md")
    ).toEqual({
      panel: "workspace",
      path: "agent-workspace/memory/project/decisions.md",
    })
  })

  it("returns null for non-workspace paths", () => {
    expect(resolveWorkspacePanelTarget("README.md")).toBeNull()
  })
})

describe("extractWorkspaceFilePathFromToolInput", () => {
  it("prefers file_path over path", () => {
    expect(
      extractWorkspaceFilePathFromToolInput({
        file_path: "agent-workspace/artifacts/reports/a.md",
        path: "agent-workspace/memory/a.md",
      })
    ).toBe("agent-workspace/artifacts/reports/a.md")
  })

  it("falls back to path for workspace_write", () => {
    expect(
      extractWorkspaceFilePathFromToolInput({
        path: "agent-workspace/artifacts/reports/a.md",
      })
    ).toBe("agent-workspace/artifacts/reports/a.md")
  })
})

describe("resolveWorkspacePathFromToolInput", () => {
  it("returns a normalized artifacts panel target", () => {
    expect(
      resolveWorkspacePathFromToolInput({
        file_path: "artifacts/reports/summary.md",
      })
    ).toEqual({
      panel: "artifacts",
      path: "agent-workspace/artifacts/reports/summary.md",
    })
  })

  it("returns null for non-workspace tool paths", () => {
    expect(
      resolveWorkspacePathFromToolInput({
        file_path: "README.md",
      })
    ).toBeNull()
  })
})
