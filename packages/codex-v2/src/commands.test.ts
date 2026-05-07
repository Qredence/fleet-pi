import {
  access,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"
import assert from "node:assert/strict"
import {
  executeCommand,
  planCommand,
  statusCommand,
  validateCommand,
} from "./commands.js"

test("plan writes gated codex-v2 artifacts", async () => {
  await withTempRepo(async (repoRoot) => {
    const state = await inDir(repoRoot, () =>
      planCommand({
        issueKey: "QRE-1",
        issueTitle: "Build codex v2",
        prompt: "Create a worker mesh.",
      })
    )

    assert.equal(state.phase, "planned")
    assert.equal(state.approvedForExecution, false)
    assert.equal(state.workers[0]?.role, "planner")
    assert.equal(
      await exists(
        join(repoRoot, "agent-workspace/codex-v2/plans", `${state.runId}.md`)
      ),
      true
    )
    assert.equal(
      await exists(
        join(repoRoot, "agent-workspace/codex-v2/runs", `${state.runId}.json`)
      ),
      true
    )
  })
})

test("execute command is the explicit write gate", async () => {
  await withTempRepo(async (repoRoot) => {
    const planned = await inDir(repoRoot, () =>
      planCommand({ issueKey: "QRE-2" })
    )
    const executed = await inDir(repoRoot, () =>
      executeCommand({ runId: planned.runId })
    )

    assert.equal(executed.approvedForExecution, true)
    assert.equal(executed.phase, "execution-approved")
    assert.equal(
      executed.workers.filter((worker) => worker.status === "skipped").length,
      4
    )
  })
})

test("status lists existing run ids", async () => {
  await withTempRepo(async (repoRoot) => {
    const planned = await inDir(repoRoot, () =>
      planCommand({ issueKey: "QRE-3" })
    )
    const runs = await inDir(repoRoot, () => statusCommand({}))

    assert.deepEqual(runs, [planned.runId])
  })
})

test("validate reports artifact root", async () => {
  await withTempRepo(async (repoRoot) => {
    const result = await inDir(repoRoot, () => validateCommand())

    assert.equal(result.ok, true)
    assert.equal(result.repoRoot, await realpath(repoRoot))
    assert.match(result.artifactRoot, /agent-workspace\/codex-v2$/)
  })
})

async function withTempRepo(callback: (repoRoot: string) => Promise<void>) {
  const repoRoot = await mkdtemp(join(tmpdir(), "fleet-pi-codex-v2-"))
  try {
    await mkdir(join(repoRoot, "agent-workspace"), { recursive: true })
    await writeFile(join(repoRoot, "package.json"), "{}\n")
    await writeFile(join(repoRoot, "pnpm-workspace.yaml"), "packages: []\n")
    await callback(repoRoot)
  } finally {
    await rm(repoRoot, { recursive: true, force: true })
  }
}

async function inDir<T>(cwd: string, callback: () => Promise<T>) {
  const previous = process.cwd()
  process.chdir(cwd)
  try {
    return await callback()
  } finally {
    process.chdir(previous)
  }
}

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
