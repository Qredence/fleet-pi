import { execFileSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
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
  FLEET_PI_SEED_REVISION_LABEL,
  SANDBOX_WORKSPACE_ROOT,
  buildPrepareSandboxCommand,
  ensureAgentWorkspaceSeedCommand,
  migrateLegacyWorkspaceVolumeCommand,
  sweepScratchCommand,
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
  it("skips the clone when the seed label is already recorded", () => {
    const script = ensureAgentWorkspaceSeedCommand(
      `'${SANDBOX_WORKSPACE_ROOT}'`,
      "'https://github.com/Qredence/fleet-pi.git'",
      "abc123def456"
    )

    expect(script).toContain(
      `${FLEET_PI_SEED_REVISION_LABEL} abc123def456 matches; clone skipped`
    )
    expect(script).not.toContain("git clone")
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
    expect(script).toContain("find ")
    expect(script).toContain("-mtime +7")
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
          "'https://example.invalid/fleet-pi.git'",
          "already-seeded"
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
    const gitEnv = gitIdentity()
    const sections = [
      "system",
      "memory",
      "skills",
      "plans",
      "artifacts",
      "scratch",
    ]
    mkdirSync(join(repo, "agent-workspace"), { recursive: true })
    writeFileSync(join(repo, "agent-workspace", "manifest.json"), "{}\n")
    writeFileSync(join(repo, "agent-workspace", "SEEDED.txt"), "seeded\n")
    for (const section of sections) {
      mkdirSync(join(repo, "agent-workspace", section), { recursive: true })
      writeFileSync(join(repo, "agent-workspace", section, ".gitkeep"), "")
    }
    execFileSync("git", ["init"], { cwd: repo, env: gitEnv })
    execFileSync("git", ["add", "."], { cwd: repo, env: gitEnv })
    execFileSync("git", ["commit", "-m", "seed"], { cwd: repo, env: gitEnv })
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repo,
      env: gitEnv,
      encoding: "utf8",
    }).trim()

    try {
      execFileSync("bash", [
        "-lc",
        ensureAgentWorkspaceSeedCommand(`'${volume}'`, `'${repo}'`),
      ])
      expect(readFileSync(join(volume, "manifest.json"), "utf8")).toBe("{}\n")
      expect(readFileSync(join(volume, "SEEDED.txt"), "utf8")).toBe("seeded\n")
      expect(
        readFileSync(join(volume, ".fleet", "seed-revision"), "utf8").trim()
      ).toBe(revision)
      for (const section of sections) {
        expect(readFileSync(join(volume, section, ".gitkeep"), "utf8")).toBe("")
      }
    } finally {
      rmSync(repo, { recursive: true, force: true })
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("keeps an edited skill after manifest.json is deleted", () => {
    const repo = mkdtempSync(join(tmpdir(), "fleet-skill-repo-"))
    const volume = mkdtempSync(join(tmpdir(), "fleet-skill-volume-"))
    const gitEnv = gitIdentity()
    mkdirSync(join(repo, "agent-workspace", "skills", "demo"), {
      recursive: true,
    })
    writeFileSync(join(repo, "agent-workspace", "manifest.json"), "{}\n")
    writeFileSync(
      join(repo, "agent-workspace", "skills", "demo", "SKILL.md"),
      "seed\n"
    )
    execFileSync("git", ["init"], { cwd: repo, env: gitEnv })
    execFileSync("git", ["add", "."], { cwd: repo, env: gitEnv })
    execFileSync("git", ["commit", "-m", "seed"], { cwd: repo, env: gitEnv })

    const skill = join(volume, "skills", "demo", "SKILL.md")
    try {
      execFileSync("bash", [
        "-lc",
        ensureAgentWorkspaceSeedCommand(`'${volume}'`, `'${repo}'`),
      ])
      const revision = readFileSync(
        join(volume, ".fleet", "seed-revision"),
        "utf8"
      ).trim()
      writeFileSync(skill, "user-edit\n")
      rmSync(join(volume, "manifest.json"))

      execFileSync("bash", [
        "-lc",
        ensureAgentWorkspaceSeedCommand(`'${volume}'`, `'${repo}'`),
      ])
      expect(readFileSync(skill, "utf8")).toBe("user-edit\n")

      rmSync(join(volume, "manifest.json"))
      execFileSync("bash", [
        "-lc",
        ensureAgentWorkspaceSeedCommand(`'${volume}'`, `'${repo}'`, revision),
      ])
      expect(readFileSync(skill, "utf8")).toBe("user-edit\n")
      expect(() =>
        readFileSync(join(volume, "manifest.json"), "utf8")
      ).toThrow()
    } finally {
      rmSync(repo, { recursive: true, force: true })
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("deletes old scratch files and keeps memory of the same age", () => {
    const volume = mkdtempSync(join(tmpdir(), "fleet-scratch-"))
    const scratchFile = join(volume, "scratch", "note.md")
    const decisions = join(volume, "memory", "project", "decisions.md")
    const gitkeep = join(volume, "scratch", "tmp", ".gitkeep")
    mkdirSync(join(volume, "scratch", "tmp"), { recursive: true })
    mkdirSync(join(volume, "memory", "project"), { recursive: true })
    writeFileSync(scratchFile, "old-note\n")
    writeFileSync(decisions, "user-edit\n")
    writeFileSync(gitkeep, "")
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    utimesSync(scratchFile, old, old)
    utimesSync(decisions, old, old)
    utimesSync(gitkeep, old, old)

    try {
      execFileSync("bash", ["-lc", sweepScratchCommand(`'${volume}'`)])
      expect(() => readFileSync(scratchFile, "utf8")).toThrow()
      expect(readFileSync(decisions, "utf8")).toBe("user-edit\n")
      expect(readFileSync(gitkeep, "utf8")).toBe("")
    } finally {
      rmSync(volume, { recursive: true, force: true })
    }
  })
})

function gitIdentity() {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: "Fleet Pi",
    GIT_AUTHOR_EMAIL: "fleet@example.com",
    GIT_COMMITTER_NAME: "Fleet Pi",
    GIT_COMMITTER_EMAIL: "fleet@example.com",
  }
}
