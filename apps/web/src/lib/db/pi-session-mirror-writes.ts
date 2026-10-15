import { deterministicId } from "./json-storage"
import {
  PI_SESSION_USER_ID_ON_CONFLICT_SQL,
  assertMirrorOwnerForPersistence,
} from "./pi-session-ownership-db"
import { insertRowsChunked } from "./postgres-batch"
import {
  readPiSessionSyncState,
  sanitizeForMirror,
  upsertPiSessionEntriesIncremental,
  upsertPiSessionStub,
} from "./pi-session-mirror-entries"
import type { PostgresQueryClient } from "./pi-session-ownership-db"
import type {
  AppendPiRunEventInput,
  InsertPiRunInput,
  PiSessionMirrorInput,
  ReplacePiFileMutationsInput,
  UpsertPiToolExecutionInput,
} from "./pi-session-mirror"

export async function upsertPiSessionMirror(
  client: PostgresQueryClient,
  input: PiSessionMirrorInput
) {
  // Read the persisted sync watermark + prior entry count BEFORE the session
  // upsert below, which overwrites `entry_count` with the incoming value.
  const priorState =
    input.entries.length > 0
      ? await readPiSessionSyncState(client, input.id)
      : null

  await client.query(
    `
      INSERT INTO pi_sessions (
        id,
        user_id,
        session_file_path,
        cwd,
        version,
        parent_session_file_path,
        name,
        first_message_preview,
        leaf_entry_id,
        entry_count,
        message_count,
        created_at,
        updated_at,
        last_synced_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now()
      )
      ON CONFLICT (id) DO UPDATE SET
        ${PI_SESSION_USER_ID_ON_CONFLICT_SQL},
        session_file_path = EXCLUDED.session_file_path,
        cwd = EXCLUDED.cwd,
        version = EXCLUDED.version,
        parent_session_file_path = EXCLUDED.parent_session_file_path,
        name = EXCLUDED.name,
        first_message_preview = EXCLUDED.first_message_preview,
        leaf_entry_id = EXCLUDED.leaf_entry_id,
        entry_count = EXCLUDED.entry_count,
        message_count = EXCLUDED.message_count,
        updated_at = EXCLUDED.updated_at,
        last_synced_at = now()
    `,
    [
      input.id,
      input.userId ?? null,
      input.sessionFilePath,
      input.cwd,
      input.version,
      input.parentSessionFilePath ?? null,
      input.name ?? null,
      input.firstMessagePreview ?? null,
      input.leafEntryId ?? null,
      input.entryCount,
      input.messageCount,
      input.createdAt,
      input.updatedAt,
    ]
  )

  if (input.entries.length > 0 && priorState) {
    // Incremental sync: only upsert entries newer than the persisted watermark
    await upsertPiSessionEntriesIncremental(client, input, priorState)
  }
}

export async function insertPiRunStart(
  client: PostgresQueryClient,
  input: InsertPiRunInput
) {
  assertMirrorOwnerForPersistence(input.userId)
  await upsertPiSessionStub(client, {
    sessionId: input.sessionId,
    sessionFile: input.sessionFile,
    cwd: input.cwd,
    userId: input.userId,
    recordedAt: input.startedAt,
  })

  const turn = await client.query<{ nextTurnIndex: number | string | null }>(
    `
      SELECT COALESCE(MAX(session_turn_index) + 1, 1) AS "nextTurnIndex"
      FROM pi_runs
      WHERE session_id = $1
    `,
    [input.sessionId]
  )
  const sessionTurnIndex = Number(turn.rows[0]?.nextTurnIndex ?? 1)

  await client.query(
    `
      INSERT INTO pi_runs (
        id,
        session_id,
        assistant_message_id,
        session_turn_index,
        mode,
        plan_action,
        status,
        started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', $7)
      ON CONFLICT (id) DO UPDATE SET
        session_id = EXCLUDED.session_id,
        assistant_message_id = EXCLUDED.assistant_message_id,
        mode = EXCLUDED.mode,
        plan_action = EXCLUDED.plan_action,
        status = 'in_progress',
        started_at = EXCLUDED.started_at,
        completed_at = NULL,
        error_message = NULL
    `,
    [
      input.runId,
      input.sessionId,
      input.assistantMessageId,
      sessionTurnIndex,
      input.mode ?? null,
      input.planAction ?? null,
      input.startedAt,
    ]
  )
}

export async function appendPiRunEvent(
  client: PostgresQueryClient,
  input: AppendPiRunEventInput
) {
  await appendPiRunEvents(client, [input])
}

const PI_RUN_EVENTS_COLUMNS = [
  "run_id",
  "sequence",
  "event_type",
  "summary",
  { name: "payload", cast: "jsonb" },
  "recorded_at",
] as const

const PI_RUN_EVENTS_ON_CONFLICT_SQL = `ON CONFLICT (run_id, sequence) DO UPDATE SET
          event_type = EXCLUDED.event_type,
          summary = EXCLUDED.summary,
          payload = EXCLUDED.payload,
          recorded_at = EXCLUDED.recorded_at`

/**
 * Batch-inserts run stream events in a single chunked multi-row INSERT. The
 * mirror sink buffers events per run and flushes them here at finalize/close,
 * so a turn with N events costs ~N/50 round trips instead of one INSERT per
 * event (run events were the only mirror table still writing row-by-row while
 * session entries and file mutations already batch through insertRowsChunked).
 */
export async function appendPiRunEvents(
  client: PostgresQueryClient,
  events: Array<AppendPiRunEventInput>
) {
  await insertRowsChunked(client, {
    table: "pi_run_events",
    columns: [...PI_RUN_EVENTS_COLUMNS],
    rows: events,
    serializeRow: (input) => [
      input.runId,
      input.sequence,
      input.eventType,
      input.summary ?? null,
      JSON.stringify(sanitizeForMirror(input.payload)),
      input.recordedAt,
    ],
    onConflictSql: PI_RUN_EVENTS_ON_CONFLICT_SQL,
  })
}

export async function upsertPiToolExecution(
  client: PostgresQueryClient,
  input: UpsertPiToolExecutionInput
) {
  await client.query(
    `
      INSERT INTO pi_tool_executions (
        id,
        session_id,
        run_id,
        tool_call_id,
        tool_name,
        state,
        is_error,
        input,
        output,
        claimed_paths,
        first_sequence,
        last_sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12)
      ON CONFLICT (run_id, tool_call_id) DO UPDATE SET
        tool_name = EXCLUDED.tool_name,
        state = EXCLUDED.state,
        is_error = EXCLUDED.is_error,
        input = EXCLUDED.input,
        output = COALESCE(EXCLUDED.output, pi_tool_executions.output),
        claimed_paths = EXCLUDED.claimed_paths,
        first_sequence = LEAST(pi_tool_executions.first_sequence, EXCLUDED.first_sequence),
        last_sequence = GREATEST(pi_tool_executions.last_sequence, EXCLUDED.last_sequence)
    `,
    [
      deterministicId(
        "pi-tool-execution",
        `${input.runId}:${input.toolCallId}`,
        { hexLength: 32 }
      ),
      input.sessionId,
      input.runId,
      input.toolCallId,
      input.toolName,
      input.state,
      input.isError,
      JSON.stringify(sanitizeForMirror(input.input)),
      input.output === null || input.output === undefined
        ? null
        : JSON.stringify(sanitizeForMirror(input.output)),
      input.claimedPaths,
      input.firstSequence,
      input.lastSequence,
    ]
  )
}

export async function replacePiFileMutations(
  client: PostgresQueryClient,
  input: ReplacePiFileMutationsInput
) {
  // Delete existing mutations for this run
  await client.query("DELETE FROM pi_file_mutations WHERE run_id = $1", [
    input.runId,
  ])

  // Batch insert all mutations in a single query instead of one INSERT per mutation
  await insertRowsChunked(client, {
    table: "pi_file_mutations",
    columns: [
      "id",
      "run_id",
      "canonical_path",
      "kind",
      "tool_call_id",
      "event_sequence",
      "before_digest",
      "after_digest",
      "before_size",
      "after_size",
      "summary",
      "recorded_at",
    ],
    rows: input.mutations,
    serializeRow: (mutation) => [
      deterministicId(
        "pi-file-mutation",
        `${input.runId}:${mutation.canonicalPath}`,
        { hexLength: 32 }
      ),
      input.runId,
      mutation.canonicalPath,
      mutation.kind,
      mutation.toolCallId ?? null,
      mutation.eventSequence ?? null,
      mutation.beforeDigest ?? null,
      mutation.afterDigest ?? null,
      mutation.beforeSize ?? null,
      mutation.afterSize ?? null,
      mutation.summary ?? null,
      input.recordedAt,
    ],
  })
}

export async function finalizePiRun(
  client: PostgresQueryClient,
  input: {
    runId: string
    status: "completed" | "errored" | "aborted"
    assistantPreview?: string | null
    errorMessage?: string | null
    completedAt: string
  }
) {
  await client.query(
    `
      UPDATE pi_runs
      SET status = $2,
          assistant_preview = $3,
          error_message = $4,
          event_count = (
            SELECT COUNT(*) FROM pi_run_events WHERE run_id = $1
          ),
          tool_call_count = (
            SELECT COUNT(*) FROM pi_tool_executions WHERE run_id = $1
          ),
          mutation_count = (
            SELECT COUNT(*) FROM pi_file_mutations WHERE run_id = $1
          ),
          completed_at = $5
      WHERE id = $1
    `,
    [
      input.runId,
      input.status,
      input.assistantPreview ?? null,
      input.errorMessage ?? null,
      input.completedAt,
    ]
  )
}

export {
  createChatPostgresOperationQueue,
  withChatPostgresTransaction,
} from "./pi-session-postgres"
