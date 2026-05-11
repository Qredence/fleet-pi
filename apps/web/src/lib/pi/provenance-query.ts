import {
  getRunDetail,
  listPathProvenance,
  listSessionRuns,
  normalizeCanonicalPath,
  normalizeSessionFilePath,
  openWorkspaceProvenance,
} from "../db/workspace-provenance"
import { RequestContextError } from "../app-runtime"
import type { AppRuntimeContext } from "../app-runtime"
import type {
  ProvenanceMutationRecord,
  ProvenanceRunDetail,
  ProvenanceRunSummary,
} from "../db/workspace-provenance"

export type ProvenanceErrorResponse = {
  ok: false
  code: string
  message: string
}

export type SessionRunsResponse = {
  ok: true
  session: {
    sessionId?: string
    sessionFile?: string
  }
  total: number
  runs: Array<ProvenanceRunSummary>
}

export type RunDetailResponse = {
  ok: true
  run: ProvenanceRunDetail["run"]
  linkedPlanRunId: string | null
  events: ProvenanceRunDetail["events"]
  toolCalls: ProvenanceRunDetail["toolCalls"]
  mutations: ProvenanceRunDetail["mutations"]
}

export type PathProvenanceResponse = {
  ok: true
  canonicalPath: string
  total: number
  runs: Array<{
    run: ProvenanceRunSummary
    mutation: ProvenanceMutationRecord
  }>
}

export class ProvenanceQueryApiError extends RequestContextError {
  constructor(
    readonly code: string,
    message: string,
    status: number
  ) {
    super(message, status)
  }
}

export function createUnexpectedProvenanceErrorResponse(error: unknown) {
  return createProvenanceErrorResponse(
    "provenance-query-failed",
    error instanceof Error ? error.message : String(error)
  )
}

export function createProvenanceErrorResponse(
  code: string,
  message: string
): ProvenanceErrorResponse {
  return {
    ok: false,
    code,
    message,
  }
}

export function createSessionRunsResponse(
  context: AppRuntimeContext,
  filter: {
    sessionId?: string | null
    sessionFile?: string | null
  }
): SessionRunsResponse {
  const sessionId = filter.sessionId?.trim() || undefined
  const sessionFile = normalizeSessionFilePath(
    context,
    filter.sessionFile ?? undefined
  )

  if (!sessionId && !sessionFile) {
    throw new ProvenanceQueryApiError(
      "session-identifier-required",
      "Provide sessionId or sessionFile to list runs.",
      400
    )
  }

  const connection = openWorkspaceProvenance(context)

  try {
    const runs = listSessionRuns(connection.db, {
      sessionId,
      sessionFile,
    })

    return {
      ok: true,
      session: {
        ...(sessionId ? { sessionId } : {}),
        ...(sessionFile ? { sessionFile } : {}),
      },
      total: runs.length,
      runs,
    }
  } finally {
    connection.close()
  }
}

export function createRunDetailResponse(
  context: AppRuntimeContext,
  runId: string | null
): RunDetailResponse {
  const normalizedRunId = runId?.trim()
  if (!normalizedRunId) {
    throw new ProvenanceQueryApiError(
      "run-id-required",
      "Provide a run id.",
      400
    )
  }

  const connection = openWorkspaceProvenance(context)

  try {
    const detail = getRunDetail(connection.db, normalizedRunId)
    if (!detail) {
      throw new ProvenanceQueryApiError(
        "run-not-found",
        "Run was not found.",
        404
      )
    }

    return {
      ok: true,
      run: detail.run,
      linkedPlanRunId: detail.linkedPlanRunId,
      events: detail.events,
      toolCalls: detail.toolCalls,
      mutations: detail.mutations,
    }
  } finally {
    connection.close()
  }
}

export function createPathProvenanceResponse(
  context: AppRuntimeContext,
  path: string | null
): PathProvenanceResponse {
  const canonicalPath = normalizeCanonicalPath(context, path ?? undefined)

  if (!canonicalPath) {
    throw new ProvenanceQueryApiError(
      "canonical-path-required",
      "Provide a canonical repo-relative path inside this project.",
      400
    )
  }

  const connection = openWorkspaceProvenance(context)

  try {
    const runs = listPathProvenance(connection.db, canonicalPath)
    return {
      ok: true,
      canonicalPath,
      total: runs.length,
      runs,
    }
  } finally {
    connection.close()
  }
}
