import { describe, expect, it } from "vitest"
import {
  WORKSPACE_VOLUME_QUARANTINE_DIRECTORY,
  workspaceVolumeShellKeepPattern,
} from "../workspace/workspace-contract"
import {
  SANDBOX_WORKSPACE_ROOT,
  buildPrepareSandboxCommand,
  ensureAgentWorkspaceSeedCommand,
  migrateLegacyWorkspaceVolumeCommand,
} from "./sandbox-prepare"

describe("sandbox-prepare migration", () => {
  it("detects nested workspace and monorepo fingerprints", () => {
    const script = migrateLegacyWorkspaceVolumeCommand(
      `'${SANDBOX_WORKSPACE_ROOT}'`
    )

    expect(script).toContain("polluted=0")
    expect(script).toContain("agent-workspace/manifest.json")
    expect(script).toContain("/apps")
    expect(script).toContain("/packages")
    expect(script).toContain("package.json")
    expect(script).toContain(".git")
    expect(script).toContain(WORKSPACE_VOLUME_QUARANTINE_DIRECTORY)
  })

  it("nested wins: snapshots nested, quarantines foreign, force-copies onto root", () => {
    const script = migrateLegacyWorkspaceVolumeCommand(
      `'${SANDBOX_WORKSPACE_ROOT}'`
    )
    const keep = workspaceVolumeShellKeepPattern()

    expect(script).toContain(
      `cp -a '${SANDBOX_WORKSPACE_ROOT}'/agent-workspace/. "$tmpdir"/`
    )
    expect(script).toContain(
      `mv "$item" '${SANDBOX_WORKSPACE_ROOT}'/${WORKSPACE_VOLUME_QUARANTINE_DIRECTORY}/`
    )
    expect(script).toContain(`cp -a "$tmpdir"/. '${SANDBOX_WORKSPACE_ROOT}'/`)
    expect(script).toContain(
      `rm -rf '${SANDBOX_WORKSPACE_ROOT}'/agent-workspace "$tmpdir"`
    )
    expect(script).toContain(`case "$(basename "$item")" in ${keep})`)
    expect(script).not.toContain("cp -an ")
    expect(script).not.toContain("/home/daytona/fleet-pi'/")
  })

  it("includes hardened migration in the prepare script", () => {
    const script = buildPrepareSandboxCommand(
      "https://github.com/Qredence/fleet-pi.git"
    )
    expect(script).toContain("polluted=0")
    expect(script).toContain(workspaceVolumeShellKeepPattern())
    expect(script).toContain(WORKSPACE_VOLUME_QUARANTINE_DIRECTORY)
  })
})

describe("sandbox-prepare seed", () => {
  it("skips seed only when manifest.json exists", () => {
    const script = ensureAgentWorkspaceSeedCommand(
      `'${SANDBOX_WORKSPACE_ROOT}'`,
      "'https://github.com/Qredence/fleet-pi.git'"
    )

    expect(script).toContain(
      `if [ ! -f '${SANDBOX_WORKSPACE_ROOT}'/manifest.json ]; then`
    )
    expect(script).not.toContain(`[ -d '${SANDBOX_WORKSPACE_ROOT}'/memory ]`)
  })

  it("uses non-clobber copy when seeding", () => {
    const script = ensureAgentWorkspaceSeedCommand(
      `'${SANDBOX_WORKSPACE_ROOT}'`,
      "'https://github.com/Qredence/fleet-pi.git'"
    )

    expect(script).toContain("cp -an ")
    expect(script).toContain(
      `cp -an "$tmpdir/agent-workspace/." '${SANDBOX_WORKSPACE_ROOT}'/`
    )
  })

  it("includes safe seed in the prepare script and removes legacy fleet-pi", () => {
    const script = buildPrepareSandboxCommand(
      "https://github.com/Qredence/fleet-pi.git"
    )
    expect(script).toContain("cp -an ")
    expect(script).toContain(
      `if [ ! -f '${SANDBOX_WORKSPACE_ROOT}'/manifest.json ]; then`
    )
    expect(script).toContain("--sparse")
    expect(script).toContain("rm -rf '/home/daytona/fleet-pi'")
    expect(script).toContain("mountpoint -q '/home/daytona/fleet-pi'")
    expect(script).not.toMatch(/git clone[^\n]*\/home\/daytona\/fleet-pi/)
  })
})
