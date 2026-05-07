import { join, relative } from "node:path"
import type {
  PlanInput,
  RunState,
  ValidationRecord,
  WorkerAssignment,
} from "./types.js"

export function createRunState({
  input,
  now = new Date(),
  runId,
  repoRoot,
}: {
  input: PlanInput
  now?: Date
  runId: string
  repoRoot: string
}): RunState {
  const timestamp = now.toISOString()
  const planPath = join("agent-workspace/codex-v2/plans", `${runId}.md`)
  const reportPath = join("agent-workspace/codex-v2/reports", `${runId}.md`)

  return {
    runId,
    issueKey: input.issueKey,
    issueTitle: input.issueTitle,
    issueUrl: input.issueUrl,
    workspaceRoot: input.workspaceRoot,
    phase: "planned",
    approvedForExecution: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    planPath,
    reportPath,
    workers: createWorkerAssignments(input, repoRoot),
    validation: createValidationPlan(),
  }
}

export function renderPlanMarkdown(state: RunState, prompt?: string) {
  const title = state.issueKey
    ? `Codex Multi-Agent V2 Plan for ${state.issueKey}`
    : "Codex Multi-Agent V2 Plan"
  const issueLine = [state.issueKey, state.issueTitle]
    .filter(Boolean)
    .join(" - ")

  return [
    `# ${title}`,
    "",
    "## Summary",
    "",
    "- Pi remains the product chat/runtime layer; this v2 run is additive and operator-scoped.",
    "- The run is currently plan-only. Execute with `pnpm codex-v2:execute -- --run-id ${state.runId}` to approve writes.",
    `- Workspace root: \`${state.workspaceRoot}\``,
    issueLine ? `- Issue: ${issueLine}` : undefined,
    state.issueUrl ? `- Issue URL: ${state.issueUrl}` : undefined,
    prompt ? `- Operator prompt: ${prompt}` : undefined,
    "",
    "## Worker Mesh",
    "",
    ...state.workers.map(
      (worker) => `- [ ] **${worker.role}** (${worker.id}): ${worker.task}`
    ),
    "",
    "## Validation",
    "",
    ...state.validation.map((item) => `- [ ] \`${item.command}\``),
    "",
    "## Execution Gate",
    "",
    "This plan does not authorize mutations by itself. The explicit execute command flips `approvedForExecution` and records worker status before any live Codex dispatch is allowed.",
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n")
}

export function renderReportMarkdown(state: RunState) {
  return [
    `# Codex Multi-Agent V2 Report: ${state.runId}`,
    "",
    `- Phase: ${state.phase}`,
    `- Approved for execution: ${state.approvedForExecution ? "yes" : "no"}`,
    `- Workspace root: \`${state.workspaceRoot}\``,
    "",
    "## Workers",
    "",
    ...state.workers.map((worker) => {
      const summary = worker.summary ? ` - ${worker.summary}` : ""
      const thread = worker.threadId ? ` (thread: ${worker.threadId})` : ""
      const error = worker.error ? ` Error: ${worker.error}` : ""
      return `- ${worker.id}: ${worker.status}${thread}${summary}${error}`
    }),
    "",
    "## Validation",
    "",
    ...state.validation.map((item) => {
      const summary = item.summary ? ` - ${item.summary}` : ""
      return `- \`${item.command}\`: ${item.status}${summary}`
    }),
  ].join("\n")
}

function createWorkerAssignments(
  input: PlanInput,
  repoRoot: string
): Array<WorkerAssignment> {
  const issueContext = [input.issueKey, input.issueTitle]
    .filter(Boolean)
    .join(" - ")
  const cwd = relative(process.cwd(), input.workspaceRoot).startsWith("..")
    ? input.workspaceRoot
    : input.workspaceRoot || repoRoot

  return [
    {
      id: "planner-1",
      role: "planner",
      task: "Convert the issue and operator prompt into a bounded implementation plan with an explicit write gate.",
      cwd,
      status: "completed",
      summary: "Initial v2 plan artifact created.",
    },
    {
      id: "scout-1",
      role: "scout",
      task: issueContext
        ? `Inspect the repo for ${issueContext} and identify the smallest safe implementation boundaries before code changes.`
        : "Inspect the repo and identify the smallest safe implementation boundaries before code changes.",
      cwd,
      status: "pending",
    },
    {
      id: "implementer-1",
      role: "implementer",
      task: "Apply the approved implementation plan in the Symphony worktree only.",
      cwd,
      status: "pending",
    },
    {
      id: "reviewer-1",
      role: "reviewer",
      task: "Review the produced diff for correctness, scope, safety, and missing tests.",
      cwd,
      status: "pending",
    },
    {
      id: "validator-1",
      role: "validator",
      task: "Run the relevant validation lane and summarize any failures with exact commands.",
      cwd,
      status: "pending",
    },
  ]
}

function createValidationPlan(): Array<ValidationRecord> {
  return [
    { command: "pnpm --filter codex-v2 typecheck", status: "pending" },
    { command: "pnpm --filter codex-v2 test", status: "pending" },
    { command: "pnpm typecheck", status: "pending" },
    { command: "pnpm lint", status: "pending" },
    { command: "pnpm validate-agents-md", status: "pending" },
    { command: "pnpm symphony:validate", status: "pending" },
  ]
}
