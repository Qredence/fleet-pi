export const WORKER_ROLES = [
  "planner",
  "scout",
  "implementer",
  "reviewer",
  "validator",
] as const

export type WorkerRole = (typeof WORKER_ROLES)[number]

export type WorkerStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"

export type RunPhase =
  | "planned"
  | "execution-approved"
  | "executing"
  | "completed"
  | "failed"

export type PlanInput = {
  issueKey?: string
  issueTitle?: string
  issueUrl?: string
  prompt?: string
  workspaceRoot: string
}

export type WorkerAssignment = {
  id: string
  role: WorkerRole
  task: string
  cwd: string
  status: WorkerStatus
  threadId?: string
  summary?: string
  error?: string
}

export type ValidationRecord = {
  command: string
  status: "pending" | "passed" | "failed" | "skipped"
  outputPath?: string
  summary?: string
}

export type RunState = {
  runId: string
  issueKey?: string
  issueTitle?: string
  issueUrl?: string
  workspaceRoot: string
  phase: RunPhase
  approvedForExecution: boolean
  createdAt: string
  updatedAt: string
  planPath: string
  reportPath: string
  workers: Array<WorkerAssignment>
  validation: Array<ValidationRecord>
}

export type CodexWorkerResult = {
  content: string
  threadId?: string
}
