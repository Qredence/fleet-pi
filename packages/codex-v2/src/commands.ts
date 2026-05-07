import { join } from "node:path"
import {
  artifactPaths,
  ensureArtifactDirs,
  generateRunId,
  listRunIds,
  readRunState,
  resolveRepoRoot,
  writeRunState,
  writeText,
} from "./artifacts.js"
import { runCodexWorker } from "./codex-worker.js"
import {
  createRunState,
  renderPlanMarkdown,
  renderReportMarkdown,
} from "./planner.js"
import type { PlanInput, RunState } from "./types.js"

export type CommandOptions = {
  issueKey?: string
  issueTitle?: string
  issueUrl?: string
  prompt?: string
  runId?: string
  workspace?: string
  useCodex?: boolean
  json?: boolean
}

export async function planCommand(options: CommandOptions) {
  const repoRoot = resolveRepoRoot()
  const paths = artifactPaths(repoRoot)
  await ensureArtifactDirs(paths)

  const input: PlanInput = {
    issueKey: options.issueKey,
    issueTitle: options.issueTitle,
    issueUrl: options.issueUrl,
    prompt: options.prompt,
    workspaceRoot: options.workspace ?? repoRoot,
  }
  const runId = options.runId ?? generateRunId()
  const state = createRunState({ input, runId, repoRoot })

  await writeText(
    join(repoRoot, state.planPath),
    renderPlanMarkdown(state, input.prompt)
  )
  await writeText(join(repoRoot, state.reportPath), renderReportMarkdown(state))
  await writeRunState(paths, state)
  return state
}

export async function executeCommand(options: CommandOptions) {
  if (!options.runId) {
    throw new Error(
      "Missing --run-id. Run `pnpm codex-v2:status` to find available runs."
    )
  }

  const repoRoot = resolveRepoRoot()
  const paths = artifactPaths(repoRoot)
  const state = await readRunState(paths, options.runId)
  const now = new Date().toISOString()
  const next: RunState = {
    ...state,
    phase: "executing",
    approvedForExecution: true,
    updatedAt: now,
  }

  for (const worker of next.workers) {
    if (worker.role === "planner" && worker.status === "completed") continue
    worker.status = "running"
    worker.summary = options.useCodex
      ? "Dispatching through Codex MCP."
      : "Live Codex dispatch skipped; run with --use-codex to invoke worker."

    if (!options.useCodex) {
      worker.status = "skipped"
      continue
    }

    try {
      const result = await runCodexWorker({
        worker,
        workspaceRoot: next.workspaceRoot,
      })
      worker.status = "completed"
      worker.summary = result.content || "Worker completed."
      worker.threadId = result.threadId
    } catch (error) {
      worker.status = "failed"
      worker.error = error instanceof Error ? error.message : String(error)
      next.phase = "failed"
      next.updatedAt = new Date().toISOString()
      await writeRunArtifacts(repoRoot, paths, next)
      throw error
    }
  }

  if (next.phase !== "failed")
    next.phase = options.useCodex ? "completed" : "execution-approved"
  next.updatedAt = new Date().toISOString()
  await writeRunArtifacts(repoRoot, paths, next)
  return next
}

export async function statusCommand(options: CommandOptions) {
  const repoRoot = resolveRepoRoot()
  const paths = artifactPaths(repoRoot)

  if (options.runId) {
    return readRunState(paths, options.runId)
  }

  return listRunIds(paths)
}

export async function validateCommand() {
  const repoRoot = resolveRepoRoot()
  const paths = artifactPaths(repoRoot)
  await ensureArtifactDirs(paths)
  return {
    ok: true,
    repoRoot,
    artifactRoot: paths.codexV2Root,
    requiredCommands: [
      "pnpm --filter codex-v2 typecheck",
      "pnpm --filter codex-v2 test",
      "pnpm symphony:validate",
    ],
  }
}

async function writeRunArtifacts(
  repoRoot: string,
  paths: ReturnType<typeof artifactPaths>,
  state: RunState
) {
  await writeText(join(repoRoot, state.reportPath), renderReportMarkdown(state))
  await writeRunState(paths, state)
}
