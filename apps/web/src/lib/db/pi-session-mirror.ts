import { shouldFailClosedOnFunctionMirrorWrite } from "../deployment/trust-zone"
import { logger } from "../logger"
import {
  assertMirrorOwnerForPersistence,
  isPiSessionMirrorEnabled,
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

export {
  fetchUserSessionIds,
  fetchUserSessionSummaries,
  queryUserSessionSummaries,
} from "./pi-session-mirror-reads"
export type { PiSessionSummaryRow } from "./pi-session-mirror-reads"
