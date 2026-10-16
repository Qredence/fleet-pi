import { describe, expect, it } from "vitest"
import { openWorkspaceProjection } from "../workspace-projection"

describe("openWorkspaceProjection on Cloudflare", () => {
  it("does not open sqlite or create a host file", () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    try {
      expect(() =>
        openWorkspaceProjection({
          projectRoot: "/tmp/fleet-pi-worker",
          workspaceRoot: "/tmp/fleet-pi-worker/agent-workspace",
        })
      ).toThrow(/unavailable on Cloudflare/)
    } finally {
      delete process.env.FLEET_PI_DEPLOYMENT
    }
  })
})
