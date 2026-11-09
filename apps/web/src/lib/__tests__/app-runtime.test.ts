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
  let root: string

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "fleet-pi-root-")))
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n")
    mkdirSync(join(root, "apps", "web"), { recursive: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    rmSync(root, { recursive: true, force: true })
  })

  it("prefers FLEET_PI_REPO_ROOT", () => {
    const explicit = realpathSync(tmpdir())
    vi.stubEnv("FLEET_PI_REPO_ROOT", explicit)

    expect(getDefaultProjectRoot()).toBe(explicit)
  })

  it("resolves the repo root when cwd is apps/web", () => {
    vi.stubEnv("FLEET_PI_REPO_ROOT", undefined)
    vi.spyOn(process, "cwd").mockReturnValue(join(root, "apps", "web"))

    expect(getDefaultProjectRoot()).toBe(root)
  })

  it("treats an empty FLEET_PI_REPO_ROOT as unset", () => {
    vi.stubEnv("FLEET_PI_REPO_ROOT", "")
    vi.spyOn(process, "cwd").mockReturnValue(join(root, "apps", "web"))

    expect(getDefaultProjectRoot()).toBe(root)
  })
})
