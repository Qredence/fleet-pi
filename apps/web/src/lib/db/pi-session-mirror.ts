import { createHash } from "node:crypto"
import { Pool } from "@neondatabase/serverless"
import { shouldFailClosedOnMirrorError } from "../deployment"
import { logger } from "../logger"
import {
  isSessionAccessAllowed,
  isSessionOwnershipStatus,
} from "./session-ownership"
import type {
  SessionEntry,
  SessionHeader,
  SessionManager,
} from "@earendil-works/pi-coding-agent"
import type {
  ChatMode,
  ChatPlanAction,
  ChatStreamEvent,
} from "@workspace/hax-design/lib/pi/chat-protocol"
import type { ProvenanceMutationKind } from "./workspace-provenance"

let sharedPool: InstanceType<typeof Pool> | undefined

function getChatPostgresPool(): InstanceType<typeof Pool> | undefined {
  const connectionString = process.env.FLEET_PI_CHAT_DATABASE_URL?.trim()
  if (!connectionString) return undefined
  if (!sharedPool) {
    sharedPool = new Pool({ connectionString })
  }
  return sharedPool
}

type QueryResult<T = Record<string, unknown>> = {
  rows: Array<T>
}

export type PostgresQueryClient = {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: Array<unknown>
  ) => Promise<QueryResult<T>>
}

export type PiSessionMirrorInput = {
  id: string
  userId?: string
  sessionFilePath: string
  cwd: string
  version: number
  parentSessionFilePath?: string
  name?: string
  firstMessagePreview?: string
  leafEntryId?: string
  entryCount: number
  messageCount: number
  createdAt: string
  updatedAt: string
  entries: Array<PiSessionEntryMirrorInput>
}

export type PiSessionEntryMirrorInput = {
  sessionId: string
  entryId: string
  parentEntryId: string | null
  entryType: string
  role?: string
  customType?: string
  provider?: string
  modelId?: string
  thinkingLevel?: string
  targetEntryId?: string
  fromEntryId?: string
  contentText?: string
  summary?: string
  isError: boolean
  tokensTotal?: number
  costTotal?: number
  rawEntry: SessionEntry
  entryTimestamp: string
}

type NormalizedSessionEntry = {
  role?: string
  customType?: string
  provider?: string
  modelId?: string
  thinkingLevel?: string
  targetEntryId?: string
  fromEntryId?: string
  contentText?: string
  summary?: string
  isError: boolean
  tokensTotal?: number
  costTotal?: number
}

export type InsertPiRunInput = {
  runId: string
  assistantMessageId: string
  sessionId: string
  sessionFile?: string
  cwd: string
  userId?: string
  mode?: ChatMode
  planAction?: ChatPlanAction
  startedAt: string
}

export type AppendPiRunEventInput = {
  runId: string
  sequence: number
  eventType: ChatStreamEvent["type"]
  summary?: string | null
  payload: unknown
  recordedAt: string
}

export type UpsertPiToolExecutionInput = {
  sessionId: string
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

export type ReplacePiFileMutationsInput = {
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

export function isPiSessionMirrorEnabled() {
  return Boolean(process.env.FLEET_PI_CHAT_DATABASE_URL?.trim())
}

export async function syncPiSessionMirror(
  sessionManager: SessionManager,
  options: { userId?: string } = {}
) {
  if (!isPiSessionMirrorEnabled()) return
  const session = extractPiSessionMirrorInput(sessionManager, options)
  if (!session) return

  await withChatPostgresTransaction(
    (client) => upsertPiSessionMirror(client, session),
    options.userId
  )
}

export interface MirrorMetrics {
  attempts: number
  successes: number
  failures: number
  lastFailureReason?: string
}

export const mirrorMetrics: MirrorMetrics = {
  attempts: 0,
  successes: 0,
  failures: 0,
}

export async function syncPiSessionMirrorSafely(
  sessionManager: SessionManager,
  options: { userId?: string } = {}
) {
  mirrorMetrics.attempts++
  try {
    await syncPiSessionMirror(sessionManager, options)
    mirrorMetrics.successes++
  } catch (error) {
    mirrorMetrics.failures++
    const reason = error instanceof Error ? error.message : String(error)
    mirrorMetrics.lastFailureReason = reason
    if (shouldFailClosedOnMirrorError()) {
      logger.error(
        { error },
        "[pi-session-mirror] sync failure on Vercel (non-fatal)"
      )
      return
    }
    logger.warn({ error }, "[pi-session-mirror] sync failed (non-fatal)")
  }
}

export function extractPiSessionMirrorInput(
  sessionManager: SessionManager,
  options: { userId?: string } = {}
): PiSessionMirrorInput | undefined {
  const header = sessionManager.getHeader()
  const sessionFilePath = sessionManager.getSessionFile()
  if (!header || !sessionFilePath) return undefined

  const entries = sessionManager.getEntries()
  const timestamps = [
    header.timestamp,
    ...entries.map((entry) => entry.timestamp),
  ]
    .filter(Boolean)
    .sort()
  const createdAt = timestamps[0] ?? new Date().toISOString()
  const updatedAt = timestamps[timestamps.length - 1] ?? createdAt

  return {
    id: header.id,
    userId: options.userId,
    sessionFilePath,
    cwd: header.cwd || sessionManager.getCwd(),
    version: header.version ?? 1,
    parentSessionFilePath: header.parentSession,
    name: sessionManager.getSessionName(),
    firstMessagePreview: findFirstMessagePreview(entries),
    leafEntryId: sessionManager.getLeafId() ?? undefined,
    entryCount: entries.length,
    messageCount: entries.filter((entry) => entry.type === "message").length,
    createdAt,
    updatedAt,
    entries: entries.map((entry) => mapSessionEntryToMirrorRow(header, entry)),
  }
}

export function mapSessionEntryToMirrorRow(
  header: Pick<SessionHeader, "id">,
  entry: SessionEntry
): PiSessionEntryMirrorInput {
  const normalized = normalizeEntry(entry)
  return {
    sessionId: header.id,
    entryId: entry.id,
    parentEntryId: entry.parentId,
    entryType: entry.type,
    role: normalized.role,
    customType: normalized.customType,
    provider: normalized.provider,
    modelId: normalized.modelId,
    thinkingLevel: normalized.thinkingLevel,
    targetEntryId: normalized.targetEntryId,
    fromEntryId: normalized.fromEntryId,
    contentText: normalized.contentText,
    summary: normalized.summary,
    isError: normalized.isError,
    tokensTotal: normalized.tokensTotal,
    costTotal: normalized.costTotal,
    rawEntry: entry,
    entryTimestamp: entry.timestamp,
  }
}

export async function withUserContext<T>(
  pool: InstanceType<typeof Pool>,
  userId: string | undefined,
  operation: (client: PostgresQueryClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    if (userId) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [
        userId,
      ])
    }
    return await operation(client)
  } finally {
    if (userId) {
      await client.query("RESET app.current_user_id")
    }
    client.release()
  }
}

export async function fetchUserSessionIds(
  userId: string
): Promise<Array<string>> {
  if (!isPiSessionMirrorEnabled()) return []

  const pool = getChatPostgresPool()
  if (!pool) return []

  try {
    return await withUserContext(pool, userId, async (client) => {
      const result = await client.query<{ id: string }>(
        "SELECT id FROM pi_sessions WHERE user_id = $1",
        [userId]
      )
      return result.rows.map((row) => row.id)
    })
  } catch (error) {
    logger.warn(
      { error, userId },
      "[pi-session-mirror] failed to fetch user session IDs"
    )
    return []
  }
}

export async function lookupSessionOwnershipStatus(
  sessionId: string,
  userId: string
): Promise<string | undefined> {
  const pool = getChatPostgresPool()
  if (!pool) return undefined

  const result = await pool.query<{ status: string }>(
    "SELECT fleet_pi_check_session_owner($1, $2) AS status",
    [sessionId, userId]
  )

  return result.rows[0]?.status
}

export async function lookupSessionIdBySessionFile(
  sessionFile: string
): Promise<string | undefined> {
  const pool = getChatPostgresPool()
  if (!pool) return undefined

  const result = await pool.query<{ session_id: string | null }>(
    "SELECT fleet_pi_lookup_session_id_by_file($1) AS session_id",
    [sessionFile]
  )

  return result.rows[0]?.session_id ?? undefined
}

/**
 * Mirror-backed ownership check. When mirror is disabled (local dev), allows access.
 * Uses SECURITY DEFINER SQL functions so RLS cannot hide foreign-owned rows.
 */
export async function verifySessionOwnership(
  sessionId: string,
  userId: string
): Promise<boolean> {
  if (!isPiSessionMirrorEnabled()) return true

  const pool = getChatPostgresPool()
  if (!pool) return true

  const failClosedOnError = shouldFailClosedOnMirrorError()

  try {
    const status = await lookupSessionOwnershipStatus(sessionId, userId)
    if (!status || !isSessionOwnershipStatus(status)) {
      logger.warn(
        { sessionId, userId, status },
        "[pi-session-mirror] unexpected session ownership status"
      )
      return failClosedOnError ? false : true
    }

    return isSessionAccessAllowed(status)
  } catch (error) {
    logger.warn(
      { error, sessionId, userId },
      "[pi-session-mirror] failed to verify session ownership"
    )
    return failClosedOnError ? false : true
  }
}

export async function upsertPiSessionMirror(
  client: PostgresQueryClient,
  input: PiSessionMirrorInput
) {
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
        user_id = COALESCE(EXCLUDED.user_id, pi_sessions.user_id),
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

  if (input.entries.length > 0) {
    await upsertPiSessionEntriesBatch(client, input.entries)
  }
}

export async function insertPiRunStart(
  client: PostgresQueryClient,
  input: InsertPiRunInput
) {
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
  await client.query(
    `
      INSERT INTO pi_run_events (
        run_id,
        sequence,
        event_type,
        summary,
        payload,
        recorded_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      ON CONFLICT (run_id, sequence) DO UPDATE SET
        event_type = EXCLUDED.event_type,
        summary = EXCLUDED.summary,
        payload = EXCLUDED.payload,
        recorded_at = EXCLUDED.recorded_at
    `,
    [
      input.runId,
      input.sequence,
      input.eventType,
      input.summary ?? null,
      JSON.stringify(sanitizeForJson(input.payload)),
      input.recordedAt,
    ]
  )
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
        `${input.runId}:${input.toolCallId}`
      ),
      input.sessionId,
      input.runId,
      input.toolCallId,
      input.toolName,
      input.state,
      input.isError,
      JSON.stringify(sanitizeForJson(input.input)),
      input.output === null || input.output === undefined
        ? null
        : JSON.stringify(sanitizeForJson(input.output)),
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
  await client.query("DELETE FROM pi_file_mutations WHERE run_id = $1", [
    input.runId,
  ])

  for (const mutation of input.mutations) {
    await client.query(
      `
        INSERT INTO pi_file_mutations (
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        deterministicId(
          "pi-file-mutation",
          `${input.runId}:${mutation.canonicalPath}`
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
      ]
    )
  }
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

export function createChatPostgresOperationQueue() {
  const connectionString = process.env.FLEET_PI_CHAT_DATABASE_URL?.trim()
  if (!connectionString) {
    return {
      enabled: false,
      enqueue: (_operation: (client: PostgresQueryClient) => Promise<void>) =>
        undefined,
      close: () => Promise.resolve(),
    }
  }

  const pool = getChatPostgresPool()!
  let pending: Promise<void> = Promise.resolve()

  const enqueue = (
    operation: (client: PostgresQueryClient) => Promise<void>,
    userId?: string
  ) => {
    pending = pending
      .then(async () => {
        if (userId) {
          // Provide RLS context manually for enqueue since it doesn't use the explicit transaction wrapper
          const client = await pool.connect()
          try {
            await client.query(
              "SELECT set_config('app.current_user_id', $1, true)",
              [userId]
            )
            await operation(client)
          } finally {
            await client.query("RESET app.current_user_id")
            client.release()
          }
        } else {
          await operation(pool)
        }
      })
      .catch((error) => {
        logger.debug(
          { error },
          "[pi-session-mirror] async mirror write failed (non-fatal)"
        )
      })
    return pending
  }

  return {
    enabled: true,
    enqueue,
    close: async () => {
      await pending.catch(() => undefined)
      // Shared pool; do not end it here.
    },
  }
}

export async function withChatPostgresTransaction(
  operation: (client: PostgresQueryClient) => Promise<void>,
  userId?: string
) {
  const pool = getChatPostgresPool()
  if (!pool) return

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    if (userId) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [
        userId,
      ])
    }
    await operation(client)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

async function upsertPiSessionEntriesBatch(
  client: PostgresQueryClient,
  entries: Array<PiSessionEntryMirrorInput>
) {
  if (entries.length === 0) return

  // Build a multi-row VALUES clause with positional parameters.
  // Each row has 18 columns; chunk in groups of 50 to stay within pg param limit.
  const CHUNK_SIZE = 50
  const COLS = 18
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE)
    const values: Array<unknown> = []
    const rowPlaceholders = chunk.map((entry, rowIdx) => {
      const base = rowIdx * COLS + 1
      values.push(
        entry.sessionId,
        entry.entryId,
        entry.parentEntryId,
        entry.entryType,
        entry.role ?? null,
        entry.customType ?? null,
        entry.provider ?? null,
        entry.modelId ?? null,
        entry.thinkingLevel ?? null,
        entry.targetEntryId ?? null,
        entry.fromEntryId ?? null,
        entry.contentText ?? null,
        entry.summary ?? null,
        entry.isError,
        entry.tokensTotal ?? null,
        entry.costTotal ?? null,
        JSON.stringify(sanitizeForJson(entry.rawEntry)),
        entry.entryTimestamp
      )
      const p = (n: number) => `$${base + n}`
      return `(${p(0)},${p(1)},${p(2)},${p(3)},${p(4)},${p(5)},${p(6)},${p(7)},${p(8)},${p(9)},${p(10)},${p(11)},${p(12)},${p(13)},${p(14)},${p(15)},${p(16)}::jsonb,${p(17)},now())`
    })
    await client.query(
      `
        INSERT INTO pi_session_entries (
          session_id, entry_id, parent_entry_id, entry_type,
          role, custom_type, provider, model_id, thinking_level,
          target_entry_id, from_entry_id, content_text, summary,
          is_error, tokens_total, cost_total, raw_entry, entry_timestamp, synced_at
        ) VALUES ${rowPlaceholders.join(",")}
        ON CONFLICT (session_id, entry_id) DO UPDATE SET
          parent_entry_id = EXCLUDED.parent_entry_id,
          entry_type = EXCLUDED.entry_type,
          role = EXCLUDED.role,
          custom_type = EXCLUDED.custom_type,
          provider = EXCLUDED.provider,
          model_id = EXCLUDED.model_id,
          thinking_level = EXCLUDED.thinking_level,
          target_entry_id = EXCLUDED.target_entry_id,
          from_entry_id = EXCLUDED.from_entry_id,
          content_text = EXCLUDED.content_text,
          summary = EXCLUDED.summary,
          is_error = EXCLUDED.is_error,
          tokens_total = EXCLUDED.tokens_total,
          cost_total = EXCLUDED.cost_total,
          raw_entry = EXCLUDED.raw_entry,
          entry_timestamp = EXCLUDED.entry_timestamp,
          synced_at = now()
      `,
      values
    )
  }
}

async function upsertPiSessionStub(
  client: PostgresQueryClient,
  input: {
    sessionId: string
    sessionFile?: string
    cwd: string
    userId?: string
    recordedAt: string
  }
) {
  await client.query(
    `
      INSERT INTO pi_sessions (
        id,
        user_id,
        session_file_path,
        cwd,
        version,
        created_at,
        updated_at,
        last_synced_at
      ) VALUES ($1, $2, $3, $4, 3, $5, $5, now())
      ON CONFLICT (id) DO UPDATE SET
        user_id = COALESCE(EXCLUDED.user_id, pi_sessions.user_id),
        session_file_path = EXCLUDED.session_file_path,
        cwd = EXCLUDED.cwd,
        updated_at = GREATEST(pi_sessions.updated_at, EXCLUDED.updated_at),
        last_synced_at = now()
    `,
    [
      input.sessionId,
      input.userId ?? null,
      input.sessionFile ?? `unknown:${input.sessionId}`,
      input.cwd,
      input.recordedAt,
    ]
  )
}

function normalizeEntry(entry: SessionEntry): NormalizedSessionEntry {
  switch (entry.type) {
    case "message":
      return normalizeMessageEntry(entry)
    case "model_change":
      return {
        provider: entry.provider,
        modelId: entry.modelId,
        contentText: `${entry.provider}/${entry.modelId}`,
        isError: false,
      }
    case "thinking_level_change":
      return {
        thinkingLevel: entry.thinkingLevel,
        contentText: entry.thinkingLevel,
        isError: false,
      }
    case "compaction":
      return {
        summary: entry.summary,
        contentText: entry.summary,
        tokensTotal: entry.tokensBefore,
        isError: false,
      }
    case "branch_summary":
      return {
        fromEntryId: entry.fromId,
        summary: entry.summary,
        contentText: entry.summary,
        isError: false,
      }
    case "custom":
      return {
        customType: entry.customType,
        contentText: textFromUnknown(entry.data),
        isError: false,
      }
    case "custom_message":
      return {
        customType: entry.customType,
        contentText: textFromUnknown(entry.content),
        isError: false,
      }
    case "label":
      return {
        targetEntryId: entry.targetId,
        contentText: entry.label,
        isError: false,
      }
    case "session_info":
      return {
        contentText: entry.name,
        isError: false,
      }
    default:
      return { isError: false }
  }
}

function normalizeMessageEntry(
  entry: Extract<SessionEntry, { type: "message" }>
): NormalizedSessionEntry {
  const message = entry.message as unknown as Record<string, unknown>
  const usage = asRecord(message.usage)
  const cost = asRecord(usage.cost)
  const role = typeof message.role === "string" ? message.role : undefined
  const stopReason =
    typeof message.stopReason === "string" ? message.stopReason : undefined

  return {
    role,
    provider:
      typeof message.provider === "string" ? message.provider : undefined,
    modelId: typeof message.model === "string" ? message.model : undefined,
    contentText: textFromUnknown(message.content),
    isError:
      message.isError === true ||
      stopReason === "error" ||
      stopReason === "aborted",
    tokensTotal:
      typeof usage.totalTokens === "number" ? usage.totalTokens : undefined,
    costTotal: typeof cost.total === "number" ? cost.total : undefined,
  }
}

function findFirstMessagePreview(entries: Array<SessionEntry>) {
  const firstUserMessage = entries.find(
    (entry) =>
      entry.type === "message" &&
      (entry.message as unknown as { role?: unknown }).role === "user"
  ) as Extract<SessionEntry, { type: "message" }> | undefined

  if (!firstUserMessage) return undefined
  const message = firstUserMessage.message as unknown as { content?: unknown }
  return textFromUnknown(message.content)?.slice(0, 280)
}

function textFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    const text = value
      .map((item) => {
        if (!item || typeof item !== "object") return ""
        const record = item as Record<string, unknown>
        if (typeof record.text === "string") return record.text
        if (typeof record.thinking === "string") return record.thinking
        if (record.type === "toolCall" && typeof record.name === "string") {
          return `tool:${record.name}`
        }
        return ""
      })
      .filter(Boolean)
      .join("\n")
    return text || undefined
  }
  if (value === undefined || value === null) return undefined
  return JSON.stringify(sanitizeForJson(value))
}

function sanitizeForJson(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString()
  if (Array.isArray(value)) return value.map(sanitizeForJson)
  if (!value || typeof value !== "object") return value

  const result: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value)) {
    if (typeof nested === "function" || typeof nested === "symbol") continue
    result[key] = sanitizeForJson(nested)
  }
  return result
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function deterministicId(namespace: string, value: string) {
  return createHash("sha256")
    .update(`${namespace}:${value}`)
    .digest("hex")
    .slice(0, 32)
}
