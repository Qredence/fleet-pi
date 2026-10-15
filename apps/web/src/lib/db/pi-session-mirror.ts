import { shouldFailClosedOnFunctionMirrorWrite } from "../deployment/trust-zone"
import { logger } from "../logger"
import {
  assertMirrorOwnerForPersistence,
  getChatPostgresPool,
  isPiSessionMirrorEnabled,
  withUserContext,
} from "./pi-session-ownership-db"
import { isPiSessionDeleted } from "./pi-session-tombstones"
import {
  findFirstMessagePreview,
  normalizeEntry,
} from "./pi-session-mirror-entries"
import {
  appendPiRunEvent,
  appendPiRunEvents,
  createChatPostgresOperationQueue,
  finalizePiRun,
  insertPiRunStart,
  replacePiFileMutations,
  upsertPiSessionMirror,
  upsertPiToolExecution,
  withChatPostgresTransaction,
} from "./pi-session-mirror-writes"
import type { PostgresQueryClient } from "./pi-session-ownership-db"
import type {
  SessionEntry,
  SessionHeader,
  SessionManager,
} from "@earendil-works/pi-coding-agent"
import type {
  ChatMode,
  ChatPlanAction,
  ChatStreamEvent,
} from "@workspace/pi-protocol/chat-protocol"
import type { ProvenanceMutationKind } from "./workspace-provenance"

export {
  appendPiRunEvent,
  appendPiRunEvents,
  createChatPostgresOperationQueue,
  finalizePiRun,
  insertPiRunStart,
  replacePiFileMutations,
  upsertPiSessionMirror,
  upsertPiToolExecution,
  withChatPostgresTransaction,
}

export type { PostgresQueryClient } from "./pi-session-ownership-db"

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

export async function syncPiSessionMirror(
  sessionManager: SessionManager,
  options: { userId?: string } = {}
) {
  if (!isPiSessionMirrorEnabled()) return
  assertMirrorOwnerForPersistence(options.userId)
  const session = extractPiSessionMirrorInput(sessionManager, options)
  if (!session) return
  if (isPiSessionDeleted(session.id)) {
    logger.info(
      { sessionId: session.id },
      "[pi-session-mirror] skipping sync for deleted session"
    )
    return
  }

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
    if (shouldFailClosedOnFunctionMirrorWrite()) {
      logger.error(
        { error },
        "[pi-session-mirror] sync failure; failing the turn"
      )
      throw error
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

/** Session list row read back from the Neon mirror (`pi_sessions`). */
export type PiSessionSummaryRow = {
  id: string
  session_file_path: string
  cwd: string
  name: string | null
  first_message_preview: string | null
  message_count: number
  created_at: string | Date
  updated_at: string | Date
}

const PI_SESSION_SUMMARY_LIMIT = 500

/**
 * Lists the caller's mirrored sessions, newest first. Must run inside
 * `withUserContext` so FORCE RLS scopes rows to `app.current_user_id`; the
 * explicit `user_id` predicate keeps the index path and fails closed if the
 * RLS context is ever missing. Tombstoned sessions are excluded.
 */
export async function queryUserSessionSummaries(
  client: PostgresQueryClient,
  userId: string
): Promise<Array<PiSessionSummaryRow>> {
  const result = await client.query<PiSessionSummaryRow>(
    `
      SELECT
        s.id,
        s.session_file_path,
        s.cwd,
        s.name,
        s.first_message_preview,
        s.message_count,
        s.created_at,
        s.updated_at
      FROM pi_sessions s
      WHERE s.user_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM pi_session_tombstones t WHERE t.session_id = s.id
        )
      ORDER BY s.updated_at DESC
      LIMIT ${PI_SESSION_SUMMARY_LIMIT}
    `,
    [userId]
  )
  return result.rows.filter((row) => !isPiSessionDeleted(row.id))
}

/**
 * Reads the caller's session list from Postgres (pooled `fleet_pi_app`
 * connection, RLS via `app.current_user_id`). Returns [] when the mirror is
 * disabled or the read fails, matching `fetchUserSessionIds` (fail closed).
 */
export async function fetchUserSessionSummaries(
  userId: string
): Promise<Array<PiSessionSummaryRow>> {
  if (!isPiSessionMirrorEnabled()) return []

  const pool = getChatPostgresPool()
  if (!pool) return []

  try {
    return await withUserContext(pool, userId, (client) =>
      queryUserSessionSummaries(client, userId)
    )
  } catch (error) {
    logger.warn(
      { error, userId },
      "[pi-session-mirror] failed to fetch user session summaries"
    )
    return []
  }
}
