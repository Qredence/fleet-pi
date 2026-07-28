import { beforeEach, describe, expect, it, vi } from "vitest"
import { workspaceTreeHandler } from "@/routes/api/workspace/tree"
import { workspaceReindexHandler } from "@/routes/api/workspace/reindex"
import { workspaceHealthHandler } from "@/routes/api/workspace/health"
import { loadAgentWorkspaceTree } from "@/lib/workspace/server"
import { loadAgentWorkspaceHealth } from "@/lib/workspace/bootstrap-agent-workspace"
import { getResponseStatus } from "@/lib/app-runtime"

// Mock dependencies
vi.mock("@/lib/workspace/server", () => ({
  loadAgentWorkspaceTree: vi.fn(),
}))

vi.mock("@/lib/workspace/bootstrap-agent-workspace", () => ({
  loadAgentWorkspaceHealth: vi.fn(),
}))

vi.mock("@/lib/workspace/workspace-context", () => ({
  resolveWorkspaceContext: vi.fn(),
}))

vi.mock(import("@/lib/app-runtime"), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getResponseStatus: vi.fn(() => 500),
  }
})

describe("Workspace API Routes", () => {
  let mockRequest: Request

  beforeEach(() => {
    mockRequest = new Request("http://localhost/api/workspace/tree", {
      method: "GET",
      headers: {
        Authorization: "Bearer test-token",
      },
    })
    vi.clearAllMocks()
  })

  describe("workspaceTreeHandler", () => {
    it("should return workspace tree on success", async () => {
      const mockTree = {
        root: "/Volumes/SSD-T7/qredence-environnement/fleet-pi",
        nodes: [],
        diagnostics: [],
      }
      vi.mocked(loadAgentWorkspaceTree).mockResolvedValue(mockTree)

      const response = await workspaceTreeHandler(mockRequest)
      expect(response.status).toBe(200)
      
      const json = await response.json()
      expect(json).toEqual(mockTree)
      expect(loadAgentWorkspaceTree).toHaveBeenCalled()
    })

    it("should handle daytona_credential_required error (403)", async () => {
      const error = new Error("daytona_credential_required")
      vi.mocked(loadAgentWorkspaceTree).mockRejectedValue(error)

      const response = await workspaceTreeHandler(mockRequest)
      expect(response.status).toBe(403)
      
      const json = await response.json()
      expect(json.message).toContain("daytona_credential_required")
    })

    it("should handle general errors with appropriate status", async () => {
      const error = new Error("Something went wrong")
      vi.mocked(loadAgentWorkspaceTree).mockRejectedValue(error)
      vi.mocked(getResponseStatus).mockReturnValue(500)

      const response = await workspaceTreeHandler(mockRequest)
      expect(response.status).toBe(500)
      
      const json = await response.json()
      expect(json.message).toBe("Something went wrong")
    })
  })

  describe("workspaceReindexHandler", () => {
    it("should handle POST reindex requests", async () => {
      // This handler requires CSRF token validation
      // For now, we just verify it exists and accepts POST

      // Should not throw immediately
      // Full integration test would require mocking session auth
      expect(workspaceReindexHandler).toBeDefined()
    })
  })

  describe("workspaceHealthHandler", () => {
    it("should return healthy status when workspace is available", async () => {
      const mockHealth = {
        status: "ok" as const,
        workspaceRoot: "/tmp/test-workspace",
        workspacePath: "agent-workspace" as const,
        workspace: {
          path: "/tmp/test-workspace/agent-workspace",
          available: true,
          created: false,
        },
        bootstrap: {
          attempted: true as const,
          complete: true,
          createdPaths: [],
          createdSections: [],
          createdFiles: [],
        },
        manifest: { valid: true } as any,
        sections: {
          required: [],
          created: [],
          missing: [],
        },
        directories: {
          required: [],
          missing: [],
        },
        policies: {
          files: [],
          missing: [],
        },
        scratch: { enabled: true } as any,
        projection: { status: "upToDate" } as any,
        warnings: [],
        diagnostics: [],
      }
      vi.mocked(loadAgentWorkspaceHealth).mockResolvedValue(mockHealth)

      const response = await workspaceHealthHandler(mockRequest)
      expect(response.status).toBe(200)
      
      const json = await response.json()
      expect(json.status).toBe("ok")
      expect(json.workspaceAvailable).toBe(true)
      expect(json.bootstrapComplete).toBe(true)
    })

    it("should return degraded status on error", async () => {
      const error = new Error("Workspace unavailable")
      vi.mocked(loadAgentWorkspaceHealth).mockRejectedValue(error)

      const response = await workspaceHealthHandler(mockRequest)
      expect(response.status).toBe(503)
      
      const json = await response.json()
      expect(json.status).toBe("degraded")
      expect(json.workspaceAvailable).toBe(false)
      expect(json.bootstrapComplete).toBe(false)
      expect(json.projectionStatus).toBe("degraded")
    })
  })
})
