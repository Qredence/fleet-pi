import { createHash } from "node:crypto"
import { relative, resolve } from "node:path"
import { openWorkspaceProjection } from "./workspace-projection"
import type { AppRuntimeContext } from "../app-runtime"
import type {
  ChatMode,
  ChatPlanAction,
  ChatStreamEvent,
} from "../pi/chat-protocol"
import type { WorkspaceProjectionConnection } from "./workspace-projection"
import type Database from "better-sqlite3"

const RUN_STATUS_VALUES = [
  "in_progress",
  "completed",
  "errored",
  "aborted",
] as const

const MUTATION_KIND_VALUES = ["created", "updated", "deleted"] as const

export type ProvenanceRunStatus = (typeof RUN_STATUS_VALUES)[number]
export type ProvenanceMutationKind = (typeof MUTATION_KIND_VALUES)[number]

export type ProvenanceRunSummary = {
  runId: string
  assistantMessageId: string
  sessionId: string
  sessionFile: string | null
  sessionTurnIndex: number
  mode: ChatMode | null
  planAction: ChatPlanAction | null
  status: ProvenanceRunStatus
  assistantPreview: string | null
  errorMessage: string | null
  eventCount: number
  toolCallCount: number
  mutationCount: number
  startedAt: string
  completedAt: string | null
}

export type ProvenanceRunEventRecord = {
  runId: string
  sequence: number
  eventType: ChatStreamEvent["type"]
  summary: string | null
  payload: Record<string, unknown>
  recordedAt: string
}

export type ProvenanceToolCallRecord = {
  toolCallId: string
  toolName: string
  state: string
  isError: boolean
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  claimedPaths: Array<string>
  firstSequence: number
  lastSequence: number
}

export type ProvenanceMutationRecord = {
  canonicalPath: string
  kind: ProvenanceMutationKind
  toolCallId: string | null
  toolName: string | null
  eventSequence: number | null
  beforeDigest: string | null
  afterDigest: string | null
  beforeSize: number | null
  afterSize: number | null
  summary: string | null
}

export type ProvenanceRunDetail = {
  run: ProvenanceRunSummary
  linkedPlanRunId: string | null
  events: Array<ProvenanceRunEventRecord>
  toolCalls: Array<ProvenanceToolCallRecord>
  mutations: Array<ProvenanceMutationRecord>
}

export type ProvenancePathRecord = {
  run: ProvenanceRunSummary
  mutation: ProvenanceMutationRecord
}

export type WorkspaceProvenanceConnection = WorkspaceProjectionConnection

export type InsertRunInput = {
  runId: string
  assistantMessageId: string
  sessionId: string
  sessionFile?: string
  mode?: ChatMode
  planAction?: ChatPlanAction
  startedAt: string
}

export type AppendRunEventInput = {
  runId: string
  sequence: number
  eventType: ChatStreamEvent["type"]
  summary?: string | null
  payload: unknown
  recordedAt: string
}

export type UpsertToolCallInput = {
  runId: string
  toolCallId: string
  toolName: string
  state: string
  isError: boolean
  input: unknown
  output: unknown
  claimedPaths: Array<string>
  firstSequence: number
  lastSequence: number
}

export type ReplaceRunMutationsInput = {
  runId: string
  recordedAt: string
  mutations: Array<{
    canonicalPath: string
    kind: ProvenanceMutationKind
    toolCallId?: string
    eventSequence?: number
    beforeDigest?: string
    afterDigest?: string
    beforeSize?: number
    afterSize?: number
    summary?: string
  }>
}

export function openWorkspaceProvenance(
  context: AppRuntimeContext
): WorkspaceProvenanceConnection {
  const connection = openWorkspaceProjection(context)
  ensureWorkspaceProvenanceSchema(connection.db)
  return connection
}

export function ensureWorkspaceProvenanceSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS provenance_sessions (
      session_id TEXT PRIMARY KEY,
      session_file_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provenance_runs (
      id TEXT PRIMARY KEY,
      assistant_message_id TEXT NOT NULL,
      session_id TEXT NOT NULL
        REFERENCES provenance_sessions(session_id) ON DELETE CASCADE,
      session_file_path TEXT,
      session_turn_index INTEGER NOT NULL,
      mode TEXT,
      plan_action TEXT,
      status TEXT NOT NULL
        CHECK (status IN ('in_progress', 'completed', 'errored', 'aborted')),
      assistant_preview TEXT,
      error_message TEXT,
      event_count INTEGER NOT NULL DEFAULT 0,
      tool_call_count INTEGER NOT NULL DEFAULT 0,
      mutation_count INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      UNIQUE(session_id, session_turn_index)
    );

    CREATE INDEX IF NOT EXISTS provenance_runs_session_idx
    ON provenance_runs(session_id, session_turn_index);

    CREATE INDEX IF NOT EXISTS provenance_runs_status_idx
    ON provenance_runs(status, completed_at, started_at);

    CREATE TABLE IF NOT EXISTS provenance_run_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES provenance_runs(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      summary TEXT,
      payload_json TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      UNIQUE(run_id, sequence)
    );

    CREATE INDEX IF NOT EXISTS provenance_run_events_run_idx
    ON provenance_run_events(run_id, sequence);

    CREATE TABLE IF NOT EXISTS provenance_tool_calls (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES provenance_runs(id) ON DELETE CASCADE,
      tool_call_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      state TEXT NOT NULL,
      is_error INTEGER NOT NULL DEFAULT 0,
      input_json TEXT NOT NULL,
      output_json TEXT,
      claimed_paths_json TEXT NOT NULL,
      first_sequence INTEGER NOT NULL,
      last_sequence INTEGER NOT NULL,
      UNIQUE(run_id, tool_call_id)
    );

    CREATE INDEX IF NOT EXISTS provenance_tool_calls_run_idx
    ON provenance_tool_calls(run_id, first_sequence, last_sequence);

    CREATE TABLE IF NOT EXISTS provenance_mutations (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES provenance_runs(id) ON DELETE CASCADE,
      canonical_path TEXT NOT NULL,
      kind TEXT NOT NULL
        CHECK (kind IN ('created', 'updated', 'deleted')),
      tool_call_id TEXT,
      event_sequence INTEGER,
      before_digest TEXT,
      after_digest TEXT,
      before_size INTEGER,
      after_size INTEGER,
      summary TEXT,
      recorded_at TEXT NOT NULL,
      UNIQUE(run_id, canonical_path)
    );

    CREATE INDEX IF NOT EXISTS provenance_mutations_run_idx
    ON provenance_mutations(run_id, canonical_path);

    CREATE INDEX IF NOT EXISTS provenance_mutations_path_idx
    ON provenance_mutations(canonical_path, recorded_at, run_id);
  `)
}

export function insertRunStart(db: Database.Database, input: InsertRunInput) {
  const upsertSession = db.prepare(`
    INSERT INTO provenance_sessions (
      session_id,
      session_file_path,
      created_at,
      updated_at
    ) VALUES (
      @sessionId,
      @sessionFile,
      @startedAt,
      @startedAt
    )
    ON CONFLICT(session_id) DO UPDATE SET
      session_file_path = COALESCE(excluded.session_file_path, provenance_sessions.session_file_path),
      updated_at = excluded.updated_at
  `)

  const selectNextTurnIndex = db.prepare<
    [string],
    { nextTurnIndex: number | null }
  >(
    `
      SELECT MAX(session_turn_index) + 1 AS nextTurnIndex
      FROM provenance_runs
      WHERE session_id = ?
    `
  )

  const insertRun = db.prepare(`
    INSERT OR REPLACE INTO provenance_runs (
      id,
      assistant_message_id,
      session_id,
      session_file_path,
      session_turn_index,
      mode,
      plan_action,
      status,
      assistant_preview,
      error_message,
      event_count,
      tool_call_count,
      mutation_count,
      started_at,
      completed_at
    ) VALUES (
      @runId,
      @assistantMessageId,
      @sessionId,
      @sessionFile,
      @sessionTurnIndex,
      @mode,
      @planAction,
      'in_progress',
      NULL,
      NULL,
      0,
      0,
      0,
      @startedAt,
      NULL
    )
  `)

  return db.transaction(() => {
    const params = {
      ...input,
      mode: input.mode ?? null,
      planAction: input.planAction ?? null,
      sessionFile: input.sessionFile ?? null,
    }

    upsertSession.run(params)
    const row = selectNextTurnIndex.get(input.sessionId)
    const sessionTurnIndex = row?.nextTurnIndex ?? 1
    insertRun.run({
      ...params,
      sessionTurnIndex,
    })

    return sessionTurnIndex
  })()
}

export function appendRunEvent(
  db: Database.Database,
  input: AppendRunEventInput
) {
  db.prepare(
    `
    INSERT OR REPLACE INTO provenance_run_events (
      id,
      run_id,
      sequence,
      event_type,
      summary,
      payload_json,
      recorded_at
    ) VALUES (
      @id,
      @runId,
      @sequence,
      @eventType,
      @summary,
      @payloadJson,
      @recordedAt
    )
  `
  ).run({
    id: createDeterministicId(
      "provenance-run-event",
      `${input.runId}:${input.sequence}`
    ),
    runId: input.runId,
    sequence: input.sequence,
    eventType: input.eventType,
    summary: input.summary ?? null,
    payloadJson: JSON.stringify(sanitizeForStorage(input.payload)),
    recordedAt: input.recordedAt,
  })
}

export function upsertToolCall(
  db: Database.Database,
  input: UpsertToolCallInput
) {
  db.prepare(
    `
    INSERT INTO provenance_tool_calls (
      id,
      run_id,
      tool_call_id,
      tool_name,
      state,
      is_error,
      input_json,
      output_json,
      claimed_paths_json,
      first_sequence,
      last_sequence
    ) VALUES (
      @id,
      @runId,
      @toolCallId,
      @toolName,
      @state,
      @isError,
      @inputJson,
      @outputJson,
      @claimedPathsJson,
      @firstSequence,
      @lastSequence
    )
    ON CONFLICT(run_id, tool_call_id) DO UPDATE SET
      tool_name = excluded.tool_name,
      state = excluded.state,
      is_error = excluded.is_error,
      input_json = excluded.input_json,
      output_json = COALESCE(excluded.output_json, provenance_tool_calls.output_json),
      claimed_paths_json = excluded.claimed_paths_json,
      first_sequence = MIN(provenance_tool_calls.first_sequence, excluded.first_sequence),
      last_sequence = MAX(provenance_tool_calls.last_sequence, excluded.last_sequence)
  `
  ).run({
    id: createDeterministicId(
      "provenance-tool-call",
      `${input.runId}:${input.toolCallId}`
    ),
    runId: input.runId,
    toolCallId: input.toolCallId,
    toolName: input.toolName,
    state: input.state,
    isError: input.isError ? 1 : 0,
    inputJson: JSON.stringify(sanitizeForStorage(input.input)),
    outputJson:
      input.output === undefined
        ? null
        : JSON.stringify(sanitizeForStorage(input.output)),
    claimedPathsJson: JSON.stringify([...new Set(input.claimedPaths)].sort()),
    firstSequence: input.firstSequence,
    lastSequence: input.lastSequence,
  })
}

export function replaceRunMutations(
  db: Database.Database,
  input: ReplaceRunMutationsInput
) {
  const deleteMutations = db.prepare(
    "DELETE FROM provenance_mutations WHERE run_id = ?"
  )
  const insertMutation = db.prepare(`
    INSERT INTO provenance_mutations (
      id,
      run_id,
      canonical_path,
      kind,
      tool_call_id,
      event_sequence,
      before_digest,
      after_digest,
      before_size,
      after_size,
      summary,
      recorded_at
    ) VALUES (
      @id,
      @runId,
      @canonicalPath,
      @kind,
      @toolCallId,
      @eventSequence,
      @beforeDigest,
      @afterDigest,
      @beforeSize,
      @afterSize,
      @summary,
      @recordedAt
    )
  `)

  db.transaction(() => {
    deleteMutations.run(input.runId)
    for (const mutation of input.mutations) {
      insertMutation.run({
        id: createDeterministicId(
          "provenance-mutation",
          `${input.runId}:${mutation.canonicalPath}`
        ),
        runId: input.runId,
        canonicalPath: mutation.canonicalPath,
        kind: mutation.kind,
        toolCallId: mutation.toolCallId ?? null,
        eventSequence: mutation.eventSequence ?? null,
        beforeDigest: mutation.beforeDigest ?? null,
        afterDigest: mutation.afterDigest ?? null,
        beforeSize: mutation.beforeSize ?? null,
        afterSize: mutation.afterSize ?? null,
        summary: mutation.summary ?? null,
        recordedAt: input.recordedAt,
      })
    }
  })()
}

export function finalizeRun(
  db: Database.Database,
  input: {
    runId: string
    status: Exclude<ProvenanceRunStatus, "in_progress">
    assistantPreview?: string | null
    errorMessage?: string | null
    completedAt: string
  }
) {
  const counts = getRunCounts(db, input.runId)

  db.prepare(
    `
    UPDATE provenance_runs
    SET status = @status,
        assistant_preview = @assistantPreview,
        error_message = @errorMessage,
        event_count = @eventCount,
        tool_call_count = @toolCallCount,
        mutation_count = @mutationCount,
        completed_at = @completedAt
    WHERE id = @runId
  `
  ).run({
    runId: input.runId,
    status: input.status,
    assistantPreview: input.assistantPreview ?? null,
    errorMessage: input.errorMessage ?? null,
    eventCount: counts.eventCount,
    toolCallCount: counts.toolCallCount,
    mutationCount: counts.mutationCount,
    completedAt: input.completedAt,
  })
}

export function listSessionRuns(
  db: Database.Database,
  filter: {
    sessionId?: string
    sessionFile?: string
  }
) {
  const clauses: Array<string> = []
  const params: Record<string, string> = {}

  if (filter.sessionId) {
    clauses.push("session_id = @sessionId")
    params.sessionId = filter.sessionId
  }

  if (filter.sessionFile) {
    clauses.push("session_file_path = @sessionFile")
    params.sessionFile = filter.sessionFile
  }

  if (clauses.length === 0) {
    return [] as Array<ProvenanceRunSummary>
  }

  return db
    .prepare<Record<string, string>, ProvenanceRunSummary>(
      `
      SELECT
        id AS runId,
        assistant_message_id AS assistantMessageId,
        session_id AS sessionId,
        session_file_path AS sessionFile,
        session_turn_index AS sessionTurnIndex,
        mode,
        plan_action AS planAction,
        status,
        assistant_preview AS assistantPreview,
        error_message AS errorMessage,
        event_count AS eventCount,
        tool_call_count AS toolCallCount,
        mutation_count AS mutationCount,
        started_at AS startedAt,
        completed_at AS completedAt
      FROM provenance_runs
      WHERE ${clauses.join(" AND ")}
      ORDER BY session_turn_index
    `
    )
    .all(params)
}

export function getRunDetail(
  db: Database.Database,
  runId: string
): ProvenanceRunDetail | null {
  const run = db
    .prepare<[string], ProvenanceRunSummary>(
      `
      SELECT
        id AS runId,
        assistant_message_id AS assistantMessageId,
        session_id AS sessionId,
        session_file_path AS sessionFile,
        session_turn_index AS sessionTurnIndex,
        mode,
        plan_action AS planAction,
        status,
        assistant_preview AS assistantPreview,
        error_message AS errorMessage,
        event_count AS eventCount,
        tool_call_count AS toolCallCount,
        mutation_count AS mutationCount,
        started_at AS startedAt,
        completed_at AS completedAt
      FROM provenance_runs
      WHERE id = ?
    `
    )
    .get(runId)

  if (!run) return null

  const events = db
    .prepare<
      [string],
      Omit<ProvenanceRunEventRecord, "payload"> & { payloadJson: string }
    >(
      `
      SELECT
        run_id AS runId,
        sequence,
        event_type AS eventType,
        summary,
        payload_json AS payloadJson,
        recorded_at AS recordedAt
      FROM provenance_run_events
      WHERE run_id = ?
      ORDER BY sequence
    `
    )
    .all(runId)
    .map((event) => ({
      runId: event.runId,
      sequence: event.sequence,
      eventType: event.eventType,
      summary: event.summary,
      payload: parseJsonRecord(event.payloadJson),
      recordedAt: event.recordedAt,
    }))

  const toolCalls = db
    .prepare<
      [string],
      Omit<ProvenanceToolCallRecord, "input" | "output" | "claimedPaths"> & {
        inputJson: string
        outputJson: string | null
        claimedPathsJson: string
      }
    >(
      `
      SELECT
        tool_call_id AS toolCallId,
        tool_name AS toolName,
        state,
        is_error AS isError,
        input_json AS inputJson,
        output_json AS outputJson,
        claimed_paths_json AS claimedPathsJson,
        first_sequence AS firstSequence,
        last_sequence AS lastSequence
      FROM provenance_tool_calls
      WHERE run_id = ?
      ORDER BY first_sequence, tool_call_id
    `
    )
    .all(runId)
    .map((toolCall) => ({
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      state: toolCall.state,
      isError: Boolean(toolCall.isError),
      input: parseJsonRecord(toolCall.inputJson),
      output: parseNullableJsonRecord(toolCall.outputJson),
      claimedPaths: parseJsonStringArray(toolCall.claimedPathsJson),
      firstSequence: toolCall.firstSequence,
      lastSequence: toolCall.lastSequence,
    }))

  const mutations = db
    .prepare<
      [string],
      Omit<ProvenanceMutationRecord, "toolName"> & { toolName: string | null }
    >(
      `
      SELECT
        provenance_mutations.canonical_path AS canonicalPath,
        provenance_mutations.kind,
        provenance_mutations.tool_call_id AS toolCallId,
        provenance_tool_calls.tool_name AS toolName,
        provenance_mutations.event_sequence AS eventSequence,
        provenance_mutations.before_digest AS beforeDigest,
        provenance_mutations.after_digest AS afterDigest,
        provenance_mutations.before_size AS beforeSize,
        provenance_mutations.after_size AS afterSize,
        provenance_mutations.summary AS summary
      FROM provenance_mutations
      LEFT JOIN provenance_tool_calls
        ON provenance_tool_calls.run_id = provenance_mutations.run_id
        AND provenance_tool_calls.tool_call_id = provenance_mutations.tool_call_id
      WHERE provenance_mutations.run_id = ?
      ORDER BY COALESCE(provenance_mutations.event_sequence, 999999), provenance_mutations.canonical_path
    `
    )
    .all(runId)

  return {
    run,
    linkedPlanRunId: findLinkedPlanRunId(db, run),
    events,
    toolCalls,
    mutations,
  }
}

export function listPathProvenance(
  db: Database.Database,
  canonicalPath: string
): Array<ProvenancePathRecord> {
  const rows = db
    .prepare<
      [string],
      ProvenanceRunSummary &
        Omit<ProvenanceMutationRecord, "toolName"> & { toolName: string | null }
    >(
      `
      SELECT
        provenance_runs.id AS runId,
        provenance_runs.assistant_message_id AS assistantMessageId,
        provenance_runs.session_id AS sessionId,
        provenance_runs.session_file_path AS sessionFile,
        provenance_runs.session_turn_index AS sessionTurnIndex,
        provenance_runs.mode,
        provenance_runs.plan_action AS planAction,
        provenance_runs.status,
        provenance_runs.assistant_preview AS assistantPreview,
        provenance_runs.error_message AS errorMessage,
        provenance_runs.event_count AS eventCount,
        provenance_runs.tool_call_count AS toolCallCount,
        provenance_runs.mutation_count AS mutationCount,
        provenance_runs.started_at AS startedAt,
        provenance_runs.completed_at AS completedAt,
        provenance_mutations.canonical_path AS canonicalPath,
        provenance_mutations.kind,
        provenance_mutations.tool_call_id AS toolCallId,
        provenance_tool_calls.tool_name AS toolName,
        provenance_mutations.event_sequence AS eventSequence,
        provenance_mutations.before_digest AS beforeDigest,
        provenance_mutations.after_digest AS afterDigest,
        provenance_mutations.before_size AS beforeSize,
        provenance_mutations.after_size AS afterSize,
        provenance_mutations.summary AS summary
      FROM provenance_mutations
      JOIN provenance_runs
        ON provenance_runs.id = provenance_mutations.run_id
      LEFT JOIN provenance_tool_calls
        ON provenance_tool_calls.run_id = provenance_mutations.run_id
        AND provenance_tool_calls.tool_call_id = provenance_mutations.tool_call_id
      WHERE provenance_mutations.canonical_path = ?
      ORDER BY provenance_runs.started_at, provenance_runs.session_turn_index, provenance_runs.id
    `
    )
    .all(canonicalPath)

  return rows.map((row) => ({
    run: {
      runId: row.runId,
      assistantMessageId: row.assistantMessageId,
      sessionId: row.sessionId,
      sessionFile: row.sessionFile,
      sessionTurnIndex: row.sessionTurnIndex,
      mode: row.mode,
      planAction: row.planAction,
      status: row.status,
      assistantPreview: row.assistantPreview,
      errorMessage: row.errorMessage,
      eventCount: row.eventCount,
      toolCallCount: row.toolCallCount,
      mutationCount: row.mutationCount,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    },
    mutation: {
      canonicalPath: row.canonicalPath,
      kind: row.kind,
      toolCallId: row.toolCallId,
      toolName: row.toolName,
      eventSequence: row.eventSequence,
      beforeDigest: row.beforeDigest,
      afterDigest: row.afterDigest,
      beforeSize: row.beforeSize,
      afterSize: row.afterSize,
      summary: row.summary,
    },
  }))
}

export function normalizeSessionFilePath(
  context: AppRuntimeContext,
  sessionFile: string | undefined
) {
  return normalizeProjectRelativePath(context.projectRoot, sessionFile)
}

export function normalizeCanonicalPath(
  context: AppRuntimeContext,
  candidate: string | undefined
) {
  return normalizeProjectRelativePath(context.projectRoot, candidate)
}

function normalizeProjectRelativePath(
  projectRoot: string,
  candidate: string | undefined
) {
  const trimmed = candidate?.trim()
  if (!trimmed) return undefined

  const absolutePath = trimmed.startsWith("/")
    ? trimmed
    : resolve(projectRoot, trimmed)

  const normalized = relative(projectRoot, absolutePath).replace(/\\/g, "/")
  if (
    !normalized ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized === ".."
  ) {
    return undefined
  }

  return normalized
}

function getRunCounts(db: Database.Database, runId: string) {
  const eventCount =
    db
      .prepare<
        [string],
        { count: number }
      >("SELECT COUNT(*) AS count FROM provenance_run_events WHERE run_id = ?")
      .get(runId)?.count ?? 0
  const toolCallCount =
    db
      .prepare<
        [string],
        { count: number }
      >("SELECT COUNT(*) AS count FROM provenance_tool_calls WHERE run_id = ?")
      .get(runId)?.count ?? 0
  const mutationCount =
    db
      .prepare<
        [string],
        { count: number }
      >("SELECT COUNT(*) AS count FROM provenance_mutations WHERE run_id = ?")
      .get(runId)?.count ?? 0

  return {
    eventCount,
    toolCallCount,
    mutationCount,
  }
}

function findLinkedPlanRunId(
  db: Database.Database,
  run: Pick<
    ProvenanceRunSummary,
    "sessionId" | "sessionTurnIndex" | "planAction"
  >
) {
  if (!run.planAction) return null

  return (
    db
      .prepare<
        [string, number],
        {
          runId: string
        }
      >(
        `
        SELECT id AS runId
        FROM provenance_runs
        WHERE session_id = ?
          AND session_turn_index < ?
          AND mode = 'plan'
        ORDER BY session_turn_index DESC
        LIMIT 1
      `
      )
      .get(run.sessionId, run.sessionTurnIndex)?.runId ?? null
  )
}

function parseJsonRecord(value: string) {
  const parsed = parseJsonValue(value)
  return isRecord(parsed) ? parsed : {}
}

function parseNullableJsonRecord(value: string | null) {
  if (!value) return null
  const parsed = parseJsonValue(value)
  return isRecord(parsed) ? parsed : {}
}

function parseJsonStringArray(value: string) {
  const parsed = parseJsonValue(value)
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : []
}

function parseJsonValue(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

function sanitizeForStorage(value: unknown, depth = 0): unknown {
  if (depth > 4) {
    return "[truncated-depth]"
  }

  if (typeof value === "string") {
    return value.length > 8_000 ? `${value.slice(0, 8_000)}…` : value
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeForStorage(item, depth + 1))
  }

  if (!isRecord(value)) {
    return String(value)
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 50)
      .map(([key, nested]) => [key, sanitizeForStorage(nested, depth + 1)])
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function createDeterministicId(kind: string, value: string) {
  return createHash("sha256").update(`${kind}:${value}`).digest("hex")
}
