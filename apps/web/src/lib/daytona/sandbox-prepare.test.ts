import { execFileSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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

  it("quarantines a nested workspace and does not clobber root files", () => {
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
    expect(script).toContain(`cp -an "$tmpdir"/. '${SANDBOX_WORKSPACE_ROOT}'/`)
    expect(script).toContain(
      `rm -rf '${SANDBOX_WORKSPACE_ROOT}'/agent-workspace "$tmpdir"`
    )
    expect(script).toContain(`case "$(basename "$item")" in ${keep})`)
    expect(script).not.toContain(
      `cp -a "$tmpdir"/. '${SANDBOX_WORKSPACE_ROOT}'/`
    )
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

  it("keeps a user decisions.md through migrate and a second prepare", () => {
    const volume = mkdtempSync(join(tmpdir(), "fleet-volume-"))
    const decisions = join(volume, "memory", "project", "decisions.md")
    mkdirSync(join(volume, "memory", "project"), { recursive: true })
    writeFileSync(decisions, "user-edit\n")
    mkdirSync(join(volume, "agent-workspace", "memory", "project"), {
      recursive: true,
    })
    writeFileSync(join(volume, "agent-workspace", "manifest.json"), "{}\n")
    writeFileSync(
      join(volume, "agent-workspace", "memory", "project", "decisions.md"),
      "git-seed\n"
    )

    try {
      const quoted = `'${volume}'`
      execFileSync("bash", ["-lc", migrateLegacyWorkspaceVolumeCommand(quoted)])
      expect(readFileSync(decisions, "utf8")).toBe("user-edit\n")
      execFileSync("bash", [
        "-lc",
        ensureAgentWorkspaceSeedCommand(
          quoted,
          "'https://example.invalid/fleet-pi.git'"
        ),
      ])
      expect(readFileSync(decisions, "utf8")).toBe("user-edit\n")
    } finally {
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("seeds a volume that has no manifest.json", () => {
    const repo = mkdtempSync(join(tmpdir(), "fleet-seed-repo-"))
    const volume = mkdtempSync(join(tmpdir(), "fleet-empty-volume-"))
    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: "Fleet Pi",
      GIT_AUTHOR_EMAIL: "fleet@example.com",
      GIT_COMMITTER_NAME: "Fleet Pi",
      GIT_COMMITTER_EMAIL: "fleet@example.com",
    }
    mkdirSync(join(repo, "agent-workspace"), { recursive: true })
    writeFileSync(join(repo, "agent-workspace", "manifest.json"), "{}\n")
    writeFileSync(join(repo, "agent-workspace", "SEEDED.txt"), "seeded\n")
    execFileSync("git", ["init"], { cwd: repo, env: gitEnv })
    execFileSync("git", ["add", "."], { cwd: repo, env: gitEnv })
    execFileSync("git", ["commit", "-m", "seed"], { cwd: repo, env: gitEnv })

    try {
      execFileSync("bash", [
        "-lc",
        ensureAgentWorkspaceSeedCommand(`'${volume}'`, `'${repo}'`),
      ])
      expect(readFileSync(join(volume, "manifest.json"), "utf8")).toBe("{}\n")
      expect(readFileSync(join(volume, "SEEDED.txt"), "utf8")).toBe("seeded\n")
    } finally {
      rmSync(repo, { recursive: true, force: true })
      rmSync(volume, { recursive: true, force: true })
    }
  })
})
