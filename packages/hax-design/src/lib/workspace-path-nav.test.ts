import { describe, expect, it } from "vitest"
import {
  extractWorkspaceFilePathFromToolInput,
  isPathWithinScope,
  normalizeWorkspaceFilePath,
  resolveWorkspacePanelTarget,
  resolveWorkspacePathFromToolInput,
  stripWorktreePrefix,
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

  it("strips .21st worktree prefixes", () => {
    expect(
      normalizeWorkspaceFilePath(
        "/Users/me/.21st/worktrees/fleet-pi/feat-x/agent-workspace/plans/next.md"
      )
    ).toBe("agent-workspace/plans/next.md")
  })

  it("handles adversarial worktree-like input in linear time", () => {
    const started = performance.now()
    for (const hostile of [
      ".21st/worktrees/".repeat(20_000) + "\n",
      ".21st/worktrees/a".repeat(20_000) + "\n",
      ".21st/worktrees/a/".repeat(20_000) + "\n",
    ]) {
      expect(normalizeWorkspaceFilePath(hostile)).toBeNull()
    }
    expect(performance.now() - started).toBeLessThan(1_000)
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

describe("stripWorktreePrefix", () => {
  it("returns the path after .21st/worktrees/<repo>/<branch>/", () => {
    expect(
      stripWorktreePrefix("/Users/me/.21st/worktrees/repo/feat/apps/web/a.ts")
    ).toBe("apps/web/a.ts")
  })

  it("uses the leftmost complete worktree match", () => {
    expect(
      stripWorktreePrefix(".21st/worktrees//x/.21st/worktrees/r/b/c.ts")
    ).toBe("c.ts")
  })

  it("returns null without two non-empty segments and a tail", () => {
    expect(stripWorktreePrefix("/repo/src/a.ts")).toBeNull()
    expect(stripWorktreePrefix(".21st/worktrees/repo/branch/")).toBeNull()
    expect(stripWorktreePrefix(".21st/worktrees/repo//a.ts")).toBeNull()
  })

  it("rejects tails containing line breaks", () => {
    expect(stripWorktreePrefix(".21st/worktrees/r/b/a\nb")).toBeNull()
  })
})
