import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

import { findRepoRoot } from "../../app-runtime"
import {
  SEED_TEMPLATE_REPO_PATH,
  LEGACY_SEED_BLOBS_REPO_PATH,
} from "../../daytona/sandbox-prepare"
import { readWorkspaceTemplateState } from "../bootstrap-agent-workspace"
import {
  SEED_TEMPLATE_VERSION,
  TEMPLATE_UPDATES_RELATIVE_PATH,
  TEMPLATE_VERSION_RELATIVE_PATH,
  WORKSPACE_POLICY_FILE_DEFINITIONS,
  WORKSPACE_REQUIRED_DIRECTORY_PATHS,
  workspaceManifestSchema,
} from "../workspace-contract"
import { createLocalWorkspaceFS } from "../workspace-fs"

const repoRoot = findRepoRoot(process.cwd())
const templateRoot = join(repoRoot, SEED_TEMPLATE_REPO_PATH)

function listFiles(dir: string): Array<string> {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

const templateFiles = listFiles(templateRoot).map((path) =>
  relative(templateRoot, path)
)

function readTemplate(path: string) {
  return readFileSync(join(templateRoot, path), "utf8")
}

describe("seed template", () => {
  it("declares the version this build seeds", () => {
    const template = JSON.parse(readTemplate("template.json")) as {
      version: unknown
    }
    expect(template.version).toBe(SEED_TEMPLATE_VERSION)
  })

  it("ships a manifest that satisfies the workspace contract", () => {
    const parsed = workspaceManifestSchema.safeParse(
      JSON.parse(readTemplate("manifest.json"))
    )
    expect(parsed.success).toBe(true)
  })

  it("contains every required directory and policy file", () => {
    const projectionOnly = new Set(["indexes"])
    for (const dir of WORKSPACE_REQUIRED_DIRECTORY_PATHS) {
      if (projectionOnly.has(dir)) continue
      expect(existsSync(join(templateRoot, dir)), dir).toBe(true)
    }
    for (const policy of WORKSPACE_POLICY_FILE_DEFINITIONS) {
      expect(templateFiles, policy.path).toContain(policy.path)
    }
  })

  it("starts project memory as stubs with no entries", () => {
    const memoryFiles = templateFiles.filter((path) =>
      path.startsWith("memory/project/")
    )
    expect(memoryFiles.length).toBe(5)
    for (const path of memoryFiles) {
      const bullets = readTemplate(path)
        .split("\n")
        .filter((line) => /^\s*[-*]\s/.test(line))
      expect(bullets, path).toEqual([])
    }
  })

  it("carries no Fleet Pi team content or machine paths", () => {
    const forbidden = [
      /qredence/i,
      /circleci/i,
      /sonarcloud/i,
      /fleet-pi-pg18/,
      /\/Users\//,
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    ]
    for (const path of templateFiles) {
      const content = readTemplate(path)
      for (const pattern of forbidden) {
        expect(pattern.test(content), `${path} matches ${pattern}`).toBe(false)
      }
    }
  })

  it("ships no executable code", () => {
    const code = templateFiles.filter((path) =>
      /\.(?:[cm]?[jt]sx?|sh|py)$/.test(path)
    )
    expect(code).toEqual([])
  })

  it("ships Pi skills with frontmatter that matches their directory", () => {
    const skills = templateFiles.filter((path) =>
      /^pi\/skills\/[^/]+\/SKILL\.md$/.test(path)
    )
    expect(skills.length).toBeGreaterThan(0)
    for (const path of skills) {
      const name = path.split("/")[2]
      const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(readTemplate(path))
      expect(frontmatter, path).not.toBeNull()
      expect(frontmatter?.[1]).toMatch(new RegExp(`^name: ${name}$`, "m"))
      expect(frontmatter?.[1]).toMatch(/^description: \S.+$/m)
    }
  })

  it("is not itself quarantined by the legacy blob list", () => {
    const legacy = new Set(
      readFileSync(join(repoRoot, LEGACY_SEED_BLOBS_REPO_PATH), "utf8")
        .split("\n")
        .filter((line) => /^[0-9a-f]{40}$/.test(line))
    )
    expect(legacy.size).toBeGreaterThan(0)
    // Allowed overlap: the manifest is identical by design (contract output),
    // and a quarantined copy is replaced by the same template file.
    const allowed = new Set(["manifest.json"])
    for (const path of templateFiles) {
      if (allowed.has(path) || readTemplate(path).length === 0) continue
      const blob = execFileSync(
        "git",
        ["hash-object", join(templateRoot, path)],
        {
          encoding: "utf8",
        }
      ).trim()
      expect(legacy.has(blob), path).toBe(false)
    }
  })
})

describe("readWorkspaceTemplateState", () => {
  it("reports the applied version and pending update folders", async () => {
    const root = mkdtempSync(join(tmpdir(), "fleet-template-state-"))
    try {
      mkdirSync(join(root, TEMPLATE_UPDATES_RELATIVE_PATH, "3"), {
        recursive: true,
      })
      mkdirSync(join(root, TEMPLATE_UPDATES_RELATIVE_PATH, "2"), {
        recursive: true,
      })
      mkdirSync(join(root, TEMPLATE_UPDATES_RELATIVE_PATH, "notes"), {
        recursive: true,
      })
      writeFileSync(join(root, TEMPLATE_VERSION_RELATIVE_PATH), "3\n")

      const state = await readWorkspaceTemplateState(
        { projectRoot: root, workspaceRoot: root },
        createLocalWorkspaceFS()
      )
      expect(state).toEqual({ version: 3, pendingUpdateVersions: [2, 3] })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("treats a workspace that was never seeded as version null", async () => {
    const root = mkdtempSync(join(tmpdir(), "fleet-template-none-"))
    try {
      const state = await readWorkspaceTemplateState(
        { projectRoot: root, workspaceRoot: root },
        createLocalWorkspaceFS()
      )
      expect(state).toEqual({ version: null, pendingUpdateVersions: [] })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
