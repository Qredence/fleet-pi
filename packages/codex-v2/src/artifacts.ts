import { randomUUID } from "node:crypto"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import type { RunState } from "./types.js"

export const CODEX_V2_ROOT = "agent-workspace/codex-v2"

export type ArtifactPaths = {
  root: string
  codexV2Root: string
  plansDir: string
  runsDir: string
  reportsDir: string
  tracesDir: string
}

export function generateRunId(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-")
  return `${stamp}-${randomUUID().slice(0, 8)}`
}

export function resolveRepoRoot(start = process.cwd()) {
  let current = resolve(start)

  for (;;) {
    if (
      existsSync(join(current, "package.json")) &&
      existsSync(join(current, "pnpm-workspace.yaml"))
    ) {
      return current
    }

    const parent = resolve(current, "..")
    if (parent === current) return resolve(start)
    current = parent
  }
}

export function artifactPaths(repoRoot = resolveRepoRoot()): ArtifactPaths {
  const codexV2Root = join(repoRoot, CODEX_V2_ROOT)
  return {
    root: repoRoot,
    codexV2Root,
    plansDir: join(codexV2Root, "plans"),
    runsDir: join(codexV2Root, "runs"),
    reportsDir: join(codexV2Root, "reports"),
    tracesDir: join(codexV2Root, "traces"),
  }
}

export async function ensureArtifactDirs(paths: ArtifactPaths) {
  await Promise.all([
    mkdir(paths.plansDir, { recursive: true }),
    mkdir(paths.runsDir, { recursive: true }),
    mkdir(paths.reportsDir, { recursive: true }),
    mkdir(paths.tracesDir, { recursive: true }),
  ])
}

export async function writeRunState(paths: ArtifactPaths, state: RunState) {
  await ensureArtifactDirs(paths)
  await writeJson(join(paths.runsDir, `${state.runId}.json`), state)
}

export async function readRunState(
  paths: ArtifactPaths,
  runId: string
): Promise<RunState> {
  const raw = await readFile(join(paths.runsDir, `${runId}.json`), "utf8")
  return JSON.parse(raw) as RunState
}

export async function listRunIds(paths: ArtifactPaths) {
  if (!existsSync(paths.runsDir)) return []

  const entries = await readdir(paths.runsDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => basename(entry.name, ".json"))
    .sort()
}

export async function writeText(path: string, content: string) {
  await mkdir(resolve(path, ".."), { recursive: true })
  await writeFile(path, content.endsWith("\n") ? content : `${content}\n`)
}

async function writeJson(path: string, data: unknown) {
  await mkdir(resolve(path, ".."), { recursive: true })
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`)
}
