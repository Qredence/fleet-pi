import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { findRepoRoot, getDefaultProjectRoot } from "../app-runtime"

describe("findRepoRoot", () => {
  let root: string

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "fleet-pi-root-")))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it("walks up from a nested package to the pnpm workspace root", () => {
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n")
    const nested = join(root, "apps", "web")
    mkdirSync(nested, { recursive: true })

    expect(findRepoRoot(nested)).toBe(root)
  })

  it("returns the start directory when no marker exists", () => {
    const nested = join(root, "a", "b")
    mkdirSync(nested, { recursive: true })

    expect(findRepoRoot(nested)).toBe(nested)
  })
})

describe("getDefaultProjectRoot", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("prefers FLEET_PI_REPO_ROOT", () => {
    const explicit = realpathSync(tmpdir())
    vi.stubEnv("FLEET_PI_REPO_ROOT", explicit)

    expect(getDefaultProjectRoot()).toBe(explicit)
  })

  it("resolves the repo root when cwd is apps/web", () => {
    vi.stubEnv("FLEET_PI_REPO_ROOT", undefined)
    const repoRoot = findRepoRoot(process.cwd())
    vi.spyOn(process, "cwd").mockReturnValue(join(repoRoot, "apps", "web"))

    expect(getDefaultProjectRoot()).toBe(realpathSync(repoRoot))
  })
})
