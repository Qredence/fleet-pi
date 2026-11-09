import { execFileSync, spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { describe, expect, it, vi } from "vitest"

import {
  TEMPLATE_PRISTINE_RELATIVE_PATH,
  TEMPLATE_UPDATES_RELATIVE_PATH,
  TEMPLATE_VERSION_RELATIVE_PATH,
  WORKSPACE_VOLUME_QUARANTINE_DIRECTORY,
  workspaceVolumeShellKeepPattern,
} from "../../workspace/workspace-contract"
import {
  LEGACY_SEED_QUARANTINE_SUBDIRECTORY,
  LEGACY_SKILLS_QUARANTINE_SUBDIRECTORY,
  PORTABLE_MOVE_SHELL,
  SANDBOX_WORKSPACE_ROOT,
  SEED_REVISION_RELATIVE_PATH,
  SEED_TEMPLATE_REPO_PATH,
  buildPrepareSandboxCommand,
  clearSandboxAuthFingerprint,
  ensureAgentWorkspaceSeedCommand,
  ensureUserCredentials,
  migrateLegacySkillsCommand,
  migrateLegacyWorkspaceVolumeCommand,
  sweepScratchCommand,
} from "../sandbox-prepare"

const { mockExecuteCommand, mockUploadFile } = vi.hoisted(() => ({
  mockExecuteCommand: vi.fn().mockResolvedValue({ exitCode: 0, result: "" }),
  mockUploadFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../client", () => ({
  executeCommand: mockExecuteCommand,
  uploadFile: mockUploadFile,
}))

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
      `cp -R '${SANDBOX_WORKSPACE_ROOT}'/agent-workspace/. "$tmpdir"/`
    )
    expect(script).toContain(
      `fleet_move "$item" '${SANDBOX_WORKSPACE_ROOT}'/${WORKSPACE_VOLUME_QUARANTINE_DIRECTORY}/`
    )
    expect(script).toContain(`cp -Rn "$tmpdir"/. '${SANDBOX_WORKSPACE_ROOT}'/`)
    expect(script).toContain(
      `rm -rf '${SANDBOX_WORKSPACE_ROOT}'/agent-workspace "$tmpdir"`
    )
    expect(script).toContain(`case "$(basename "$item")" in ${keep})`)
    expect(script).not.toContain(
      `cp -R "$tmpdir"/. '${SANDBOX_WORKSPACE_ROOT}'/`
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

const TEMPLATE = "templates/agent-workspace"

type SeedRepo = { path: string; revision: string }

/** A git repo shaped like Fleet Pi's seed: `templates/agent-workspace/**`. */
function createSeedRepo(
  files: Record<string, string>,
  legacyBlobs: Array<string> = [],
  version = 1
): SeedRepo {
  const repo = mkdtempSync(join(tmpdir(), "fleet-seed-repo-"))
  writeSeedFiles(repo, files, legacyBlobs, version)
  return { path: repo, revision: commitSeed(repo, "seed") }
}

function writeSeedFiles(
  repo: string,
  files: Record<string, string>,
  legacyBlobs: Array<string> = [],
  version = 1
) {
  const root = join(repo, TEMPLATE)
  writeFileInTree(root, "template.json", `{ "version": ${version} }\n`)
  for (const [path, content] of Object.entries(files)) {
    writeFileInTree(root, path, content)
  }
  writeFileSync(
    join(repo, "templates", "legacy-seed-blobs.txt"),
    ["# legacy blobs", ...legacyBlobs, ""].join("\n")
  )
}

function commitSeed(repo: string, message: string) {
  const env = gitIdentity()
  execFileSync("git", ["init", "-q"], { cwd: repo, env })
  execFileSync("git", ["add", "."], { cwd: repo, env })
  execFileSync("git", ["commit", "-q", "-m", message], { cwd: repo, env })
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    env,
    encoding: "utf8",
  }).trim()
}

function writeFileInTree(root: string, path: string, content: string) {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

function gitBlobId(content: string) {
  return execFileSync("git", ["hash-object", "--stdin"], {
    input: content,
    encoding: "utf8",
  }).trim()
}

function runSeed(volume: string, repo: string, version = 1) {
  return execFileSync(
    "bash",
    [
      "-lc",
      ensureAgentWorkspaceSeedCommand(`'${volume}'`, `'${repo}'`, version),
    ],
    { encoding: "utf8" }
  )
}

/** Like {@link runSeed}, but also returns stderr and the exit status. */
function runSeedResult(volume: string, repo: string, version = 1) {
  const result = spawnSync(
    "bash",
    [
      "-lc",
      ensureAgentWorkspaceSeedCommand(`'${volume}'`, `'${repo}'`, version),
    ],
    { encoding: "utf8" }
  )
  return { stdout: result.stdout, stderr: result.stderr, status: result.status }
}

function read(path: string) {
  return readFileSync(path, "utf8")
}

describe("sandbox-prepare skills migration", () => {
  it("moves legacy skills/<name> into pi/skills and quarantines collisions", () => {
    const volume = mkdtempSync(join(tmpdir(), "fleet-skills-volume-"))
    try {
      writeFileInTree(volume, "skills/mine/SKILL.md", "user skill\n")
      writeFileInTree(volume, "skills/shared/SKILL.md", "legacy copy\n")
      writeFileInTree(volume, "skills/README.md", "notes\n")
      writeFileInTree(volume, "pi/skills/shared/SKILL.md", "installed\n")

      const output = execFileSync(
        "bash",
        ["-lc", migrateLegacySkillsCommand(`'${volume}'`)],
        { encoding: "utf8" }
      )

      expect(read(join(volume, "pi/skills/mine/SKILL.md"))).toBe("user skill\n")
      expect(read(join(volume, "pi/skills/shared/SKILL.md"))).toBe(
        "installed\n"
      )
      expect(
        read(
          join(
            volume,
            WORKSPACE_VOLUME_QUARANTINE_DIRECTORY,
            LEGACY_SKILLS_QUARANTINE_SUBDIRECTORY,
            "shared/SKILL.md"
          )
        )
      ).toBe("legacy copy\n")
      expect(existsSync(join(volume, "skills/mine"))).toBe(false)
      // Loose files stay; only skill folders move.
      expect(read(join(volume, "skills/README.md"))).toBe("notes\n")
      expect(output).toContain("FLEET_PI_SKILL_MIGRATED=mine")
    } finally {
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("copies instead of renaming when the volume cannot rename", () => {
    const volume = mkdtempSync(join(tmpdir(), "fleet-skills-noext4-"))
    const shims = mkdtempSync(join(tmpdir(), "fleet-mv-shim-"))
    try {
      writeFileInTree(volume, "skills/mine/SKILL.md", "user skill\n")
      writeFileInTree(volume, "skills/shared/SKILL.md", "legacy copy\n")
      writeFileInTree(volume, "pi/skills/shared/SKILL.md", "installed\n")
      // The Daytona volume answers rename(2) with ENOSYS.
      writeFileSync(
        join(shims, "mv"),
        "#!/bin/sh\necho 'mv: Function not implemented' >&2\nexit 1\n",
        { mode: 0o755 }
      )

      execFileSync(
        "bash",
        [
          "-c",
          `PATH='${shims}':"$PATH"\n${migrateLegacySkillsCommand(`'${volume}'`)}`,
        ],
        { encoding: "utf8" }
      )

      expect(read(join(volume, "pi/skills/mine/SKILL.md"))).toBe("user skill\n")
      expect(existsSync(join(volume, "skills/mine"))).toBe(false)
      expect(
        read(
          join(
            volume,
            WORKSPACE_VOLUME_QUARANTINE_DIRECTORY,
            LEGACY_SKILLS_QUARANTINE_SUBDIRECTORY,
            "shared/SKILL.md"
          )
        )
      ).toBe("legacy copy\n")
    } finally {
      rmSync(volume, { recursive: true, force: true })
      rmSync(shims, { recursive: true, force: true })
    }
  })

  it("quarantines through the portable move in the seed", () => {
    const script = ensureAgentWorkspaceSeedCommand(
      `'${SANDBOX_WORKSPACE_ROOT}'`,
      "https://github.com/Qredence/fleet-pi.git"
    )
    expect(script).toContain(PORTABLE_MOVE_SHELL)
    expect(script).toContain(`fleet_move "$file"`)
  })

  it("is a no-op without a legacy skills directory", () => {
    const volume = mkdtempSync(join(tmpdir(), "fleet-no-skills-"))
    try {
      execFileSync("bash", ["-lc", migrateLegacySkillsCommand(`'${volume}'`)])
      expect(existsSync(join(volume, "pi"))).toBe(false)
    } finally {
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("runs before the seed in the prepare script", () => {
    const script = buildPrepareSandboxCommand(
      "https://github.com/Qredence/fleet-pi.git"
    )
    expect(script.indexOf("FLEET_PI_SKILL_MIGRATED")).toBeLessThan(
      script.indexOf("git clone")
    )
  })
})

describe("sandbox-prepare seed", () => {
  it("skips the clone when the volume records this template version or newer", () => {
    const volume = mkdtempSync(join(tmpdir(), "fleet-seeded-volume-"))
    try {
      mkdirSync(join(volume, ".fleet"), { recursive: true })
      writeFileSync(join(volume, TEMPLATE_VERSION_RELATIVE_PATH), "3\n")

      for (const version of [2, 3]) {
        const output = runSeed(volume, "https://example.invalid/x.git", version)
        expect(output).toContain("FLEET_PI_TEMPLATE_VERSION=3 (seed skipped)")
      }
    } finally {
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("rejects an invalid template version", () => {
    expect(() =>
      ensureAgentWorkspaceSeedCommand("'/w'", "'https://x.invalid'", 0)
    ).toThrow("Invalid seed template version")
  })

  it("sparse-clones the template path, not the team workspace", () => {
    const script = buildPrepareSandboxCommand(
      "https://github.com/Qredence/fleet-pi.git"
    )
    expect(script).toContain("--sparse")
    expect(script).toContain(
      `git sparse-checkout set ${SEED_TEMPLATE_REPO_PATH}`
    )
    expect(script).not.toContain("git sparse-checkout set agent-workspace")
    expect(script).toContain('if [ ! -e "$dest" ]; then')
    expect(script).toContain("-mmin +10080")
    expect(script).toContain("rm -rf '/home/daytona/fleet-pi'")
    expect(script).toContain("mountpoint -q '/home/daytona/fleet-pi'")
    expect(script).not.toMatch(/git clone[^\n]*\/home\/daytona\/fleet-pi/)
  })

  it("seeds an empty volume and records version, pristine copy, and revision", () => {
    const repo = createSeedRepo({
      "manifest.json": "{}\n",
      "memory/project/decisions.md": "# Decisions\n",
      "scratch/tmp/.gitkeep": "",
    })
    const volume = mkdtempSync(join(tmpdir(), "fleet-empty-volume-"))
    try {
      runSeed(volume, repo.path)
      expect(read(join(volume, "manifest.json"))).toBe("{}\n")
      expect(read(join(volume, "memory/project/decisions.md"))).toBe(
        "# Decisions\n"
      )
      expect(read(join(volume, "scratch/tmp/.gitkeep"))).toBe("")
      expect(read(join(volume, TEMPLATE_VERSION_RELATIVE_PATH)).trim()).toBe(
        "1"
      )
      expect(read(join(volume, SEED_REVISION_RELATIVE_PATH)).trim()).toBe(
        repo.revision
      )
      expect(
        read(join(volume, TEMPLATE_PRISTINE_RELATIVE_PATH, "manifest.json"))
      ).toBe("{}\n")
      expect(existsSync(join(volume, TEMPLATE_UPDATES_RELATIVE_PATH))).toBe(
        false
      )
      // Template metadata stays out of the workspace tree.
      expect(existsSync(join(volume, "template.json"))).toBe(false)
    } finally {
      rmSync(repo.path, { recursive: true, force: true })
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("skips the seed without recording when the cloned template version differs", () => {
    const repo = createSeedRepo({ "manifest.json": "{}\n" })
    const volume = mkdtempSync(join(tmpdir(), "fleet-mismatch-volume-"))
    try {
      const { stdout, stderr, status } = runSeedResult(volume, repo.path, 2)

      expect(status).toBe(0)
      expect(stderr).toContain(
        "Seed template version 1 does not match expected 2"
      )
      expect(stdout).toContain(
        "FLEET_PI_TEMPLATE_VERSION=0 (seed skipped: template version mismatch)"
      )
      expect(existsSync(join(volume, "manifest.json"))).toBe(false)
      expect(existsSync(join(volume, TEMPLATE_VERSION_RELATIVE_PATH))).toBe(
        false
      )
    } finally {
      rmSync(repo.path, { recursive: true, force: true })
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("warns and records nothing when the template is missing", () => {
    const repo = mkdtempSync(join(tmpdir(), "fleet-no-template-"))
    writeFileInTree(repo, "agent-workspace/manifest.json", "{}\n")
    commitSeed(repo, "old layout")
    const volume = mkdtempSync(join(tmpdir(), "fleet-no-template-volume-"))
    try {
      // A branch without the template must not break the whole prepare:
      // migration still runs and the volume stays usable.
      const output = runSeed(volume, repo)
      expect(output).toContain("seed skipped: template missing")
      expect(existsSync(join(volume, TEMPLATE_VERSION_RELATIVE_PATH))).toBe(
        false
      )
    } finally {
      rmSync(repo, { recursive: true, force: true })
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("never overwrites user edits and offers changed template files for review", () => {
    const repo = createSeedRepo({
      "pi/skills/demo/SKILL.md": "seed v1\n",
      "system/identity.md": "identity v1\n",
    })
    const volume = mkdtempSync(join(tmpdir(), "fleet-upgrade-volume-"))
    const skill = join(volume, "pi/skills/demo/SKILL.md")
    const identity = join(volume, "system/identity.md")
    try {
      runSeed(volume, repo.path, 1)
      writeFileSync(skill, "user-edit\n")

      // Template v2: the skill changes, identity stays, a new prompt appears.
      writeSeedFiles(
        repo.path,
        {
          "pi/skills/demo/SKILL.md": "seed v2\n",
          "system/identity.md": "identity v1\n",
          "pi/prompts/new.md": "new prompt\n",
        },
        [],
        2
      )
      commitSeed(repo.path, "template v2")
      const output = runSeed(volume, repo.path, 2)

      expect(read(skill)).toBe("user-edit\n")
      expect(read(identity)).toBe("identity v1\n")
      expect(read(join(volume, "pi/prompts/new.md"))).toBe("new prompt\n")
      expect(
        read(
          join(
            volume,
            TEMPLATE_UPDATES_RELATIVE_PATH,
            "2/pi/skills/demo/SKILL.md"
          )
        )
      ).toBe("seed v2\n")
      expect(output).toContain(
        "FLEET_PI_TEMPLATE_UPDATE=pi/skills/demo/SKILL.md"
      )
      expect(
        existsSync(
          join(volume, TEMPLATE_UPDATES_RELATIVE_PATH, "2/system/identity.md")
        )
      ).toBe(false)
      expect(read(join(volume, TEMPLATE_VERSION_RELATIVE_PATH)).trim()).toBe(
        "2"
      )
    } finally {
      rmSync(repo.path, { recursive: true, force: true })
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("does not offer an update when only the user changed a file", () => {
    const repo = createSeedRepo({ "memory/project/decisions.md": "stub\n" })
    const volume = mkdtempSync(join(tmpdir(), "fleet-user-only-volume-"))
    const decisions = join(volume, "memory/project/decisions.md")
    try {
      runSeed(volume, repo.path, 1)
      writeFileSync(decisions, "user-edit\n")
      writeSeedFiles(
        repo.path,
        { "memory/project/decisions.md": "stub\n" },
        [],
        2
      )
      commitSeed(repo.path, "template v2")
      runSeed(volume, repo.path, 2)

      expect(read(decisions)).toBe("user-edit\n")
      expect(existsSync(join(volume, TEMPLATE_UPDATES_RELATIVE_PATH))).toBe(
        false
      )
    } finally {
      rmSync(repo.path, { recursive: true, force: true })
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("quarantines unedited legacy seed files once and keeps user edits", () => {
    const teamMemory = "# Known Issues\n\nTeam-internal CircleCI notes.\n"
    const repo = createSeedRepo(
      { "memory/project/known-issues.md": "# Known Issues\n" },
      [gitBlobId(teamMemory), gitBlobId("legacy decisions\n")]
    )
    const volume = mkdtempSync(join(tmpdir(), "fleet-legacy-volume-"))
    const knownIssues = join(volume, "memory/project/known-issues.md")
    const decisions = join(volume, "memory/project/decisions.md")
    try {
      // A volume seeded by the old seed: no template version recorded.
      mkdirSync(join(volume, "memory/project"), { recursive: true })
      writeFileSync(knownIssues, teamMemory)
      writeFileSync(decisions, "legacy decisions\nplus a user edit\n")

      const output = runSeed(volume, repo.path)

      const quarantined = join(
        volume,
        WORKSPACE_VOLUME_QUARANTINE_DIRECTORY,
        LEGACY_SEED_QUARANTINE_SUBDIRECTORY,
        "memory/project/known-issues.md"
      )
      expect(read(quarantined)).toBe(teamMemory)
      expect(read(knownIssues)).toBe("# Known Issues\n")
      expect(read(decisions)).toBe("legacy decisions\nplus a user edit\n")
      expect(output).toContain(
        "FLEET_PI_LEGACY_QUARANTINED=memory/project/known-issues.md"
      )

      // Legacy cleanup never runs again once a version is recorded.
      writeFileSync(knownIssues, teamMemory)
      writeSeedFiles(
        repo.path,
        { "memory/project/known-issues.md": "# Known Issues\n" },
        [gitBlobId(teamMemory), gitBlobId("legacy decisions\n")],
        2
      )
      commitSeed(repo.path, "template v2")
      runSeed(volume, repo.path, 2)
      expect(read(join(volume, TEMPLATE_VERSION_RELATIVE_PATH)).trim()).toBe(
        "2"
      )
      expect(read(knownIssues)).toBe(teamMemory)
    } finally {
      rmSync(repo.path, { recursive: true, force: true })
      rmSync(volume, { recursive: true, force: true })
    }
  })

  it("keeps a user decisions.md through migrate and a seeded prepare", () => {
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
    mkdirSync(join(volume, ".fleet"), { recursive: true })
    writeFileSync(join(volume, TEMPLATE_VERSION_RELATIVE_PATH), "1\n")

    try {
      const quoted = `'${volume}'`
      execFileSync("bash", ["-lc", migrateLegacyWorkspaceVolumeCommand(quoted)])
      expect(read(decisions)).toBe("user-edit\n")
      // Migration keeps Fleet state on the volume root.
      expect(read(join(volume, TEMPLATE_VERSION_RELATIVE_PATH))).toBe("1\n")
      runSeed(volume, "https://example.invalid/fleet-pi.git")
      expect(read(decisions)).toBe("user-edit\n")
    } finally {
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
    // Just past 7 days: `-mtime +7` would keep this until day 8.
    const old = new Date(Date.now() - (7 * 24 + 1) * 60 * 60 * 1000)
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

describe("ensureUserCredentials", () => {
  it("re-uploads auth.json when sandbox.id changes even if secrets fingerprint is unchanged", async () => {
    clearSandboxAuthFingerprint("user-recreated-sandbox")
    mockExecuteCommand.mockClear()
    mockUploadFile.mockClear()

    const secrets = {
      envVars: {},
      authJson: { openai: { type: "api_key" as const, key: "sk-test" } },
      fingerprint: "fp-same",
    }

    await ensureUserCredentials(
      { id: "sandbox-1" } as never,
      secrets,
      "user-recreated-sandbox"
    )
    expect(mockUploadFile).toHaveBeenCalledTimes(1)

    // Same sandbox id + same fingerprint -> skipped
    await ensureUserCredentials(
      { id: "sandbox-1" } as never,
      secrets,
      "user-recreated-sandbox"
    )
    expect(mockUploadFile).toHaveBeenCalledTimes(1)

    // Recreated sandbox with new id + same fingerprint -> re-uploaded!
    await ensureUserCredentials(
      { id: "sandbox-2" } as never,
      secrets,
      "user-recreated-sandbox"
    )
    expect(mockUploadFile).toHaveBeenCalledTimes(2)
  })
})
