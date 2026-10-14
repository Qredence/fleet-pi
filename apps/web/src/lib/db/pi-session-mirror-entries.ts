import { logger } from "../logger"
import {
  MIRROR_JSON_SANITIZE_OPTIONS,
  sanitizeJsonForStorage,
} from "./json-storage"
import { insertRowsChunked } from "./postgres-batch"
import { PI_SESSION_USER_ID_ON_CONFLICT_SQL } from "./pi-session-ownership-db"
import type { PostgresQueryClient } from "./pi-session-ownership-db"
import type { SessionEntry } from "@earendil-works/pi-coding-agent"
import type {
  PiSessionEntryMirrorInput,
  PiSessionMirrorInput,
} from "./pi-session-mirror"

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

// On conflict, refresh every mirrored column and bump the sync timestamp —
// unless the canonical entry JSON is unchanged, so replaying the same session
// does not rewrite rows that already match (~10x fewer updates in practice).
// raw_entry is the source of truth; the projected columns (content_text,
// summary, …) only change with it.
const PI_SESSION_ENTRIES_ON_CONFLICT_SQL = `ON CONFLICT (session_id, entry_id) DO UPDATE SET
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
        WHERE pi_session_entries.raw_entry IS DISTINCT FROM EXCLUDED.raw_entry`

async function upsertPiSessionEntriesBatch(
  client: PostgresQueryClient,
  entries: Array<PiSessionEntryMirrorInput>
) {
  // 18 bound columns per row (+ inline now() for synced_at); chunked in
  // groups of 50 to stay within the pg parameter limit.
  await insertRowsChunked(client, {
    table: "pi_session_entries",
    columns: [
      "session_id",
      "entry_id",
      "parent_entry_id",
      "entry_type",
      "role",
      "custom_type",
      "provider",
      "model_id",
      "thinking_level",
      "target_entry_id",
      "from_entry_id",
      "content_text",
      "summary",
      "is_error",
      "tokens_total",
      "cost_total",
      { name: "raw_entry", cast: "jsonb" },
      "entry_timestamp",
      { name: "synced_at", expression: "now()" },
    ],
    rows: entries,
    serializeRow: (entry) => [
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
      JSON.stringify(sanitizeForMirror(entry.rawEntry)),
      entry.entryTimestamp,
    ],
    onConflictSql: PI_SESSION_ENTRIES_ON_CONFLICT_SQL,
  })
}

// Incremental sync: only upsert entries newer than the persisted watermark.
// For a session with N entries, reduces writes from O(N) to O(newEntriesPerTurn).
type PiSessionSyncState = {
  watermark: { entryId: string; entryTimestamp: string | Date } | null
  entryCount: number
}

export async function readPiSessionSyncState(
  client: PostgresQueryClient,
  sessionId: string
): Promise<PiSessionSyncState> {
  const result = await client.query<{
    last_synced_entry_id: string | null
    last_synced_entry_timestamp: string | Date | null
    entry_count: number | null
  }>(
    `SELECT last_synced_entry_id, last_synced_entry_timestamp, entry_count
     FROM pi_sessions
     WHERE id = $1`,
    [sessionId]
  )
  const rows = result.rows
  if (rows.length === 0) {
    return { watermark: null, entryCount: 0 }
  }
  const row = rows[0]
  if (!row.last_synced_entry_id || !row.last_synced_entry_timestamp) {
    return { watermark: null, entryCount: row.entry_count ?? 0 }
  }
  return {
    watermark: {
      entryId: row.last_synced_entry_id,
      entryTimestamp: row.last_synced_entry_timestamp,
    },
    entryCount: row.entry_count ?? 0,
  }
}

function toIsoTimestamp(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString()
}

// A new entry is any entry that comes after the watermark in the recovery
// ordering (entry_timestamp ASC, entry_id ASC). This tie-break guarantees an
// unmirrored entry sharing the watermark's timestamp but with a later id is
// never skipped.
function isEntryAfterWatermark(
  entry: PiSessionEntryMirrorInput,
  watermark: { entryId: string; entryTimestamp: string | Date }
): boolean {
  const watermarkTimestamp = toIsoTimestamp(watermark.entryTimestamp)
  if (entry.entryTimestamp > watermarkTimestamp) return true
  if (entry.entryTimestamp < watermarkTimestamp) return false
  return entry.entryId > watermark.entryId
}

// The watermark must be the maximum entry in the synced batch by the recovery
// ordering, not merely the last array element, so it stays correct even when
// entries with equal timestamps arrive out of id order.
function pickWatermarkEntry(
  entries: Array<PiSessionEntryMirrorInput>
): PiSessionEntryMirrorInput | undefined {
  return entries.reduce<PiSessionEntryMirrorInput | undefined>((max, entry) => {
    if (!max) return entry
    return isEntryAfterWatermark(entry, {
      entryId: max.entryId,
      entryTimestamp: max.entryTimestamp,
    })
      ? entry
      : max
  }, undefined)
}

export async function upsertPiSessionEntriesIncremental(
  client: PostgresQueryClient,
  input: PiSessionMirrorInput,
  priorState: PiSessionSyncState
) {
  // Correctness-first fallbacks: no persisted watermark (first sync) or the
  // input has fewer entries than the DB already holds (compaction/rollback
  // reordering) trigger a full upsert to self-heal — never trust the
  // watermark when in doubt.
  const shouldFullSync =
    !priorState.watermark || input.entryCount < priorState.entryCount

  const newEntries = shouldFullSync
    ? input.entries
    : input.entries.filter((entry) =>
        isEntryAfterWatermark(entry, priorState.watermark!)
      )

  logger.debug(
    {
      sessionId: input.id,
      totalEntries: input.entries.length,
      newEntries: newEntries.length,
      fullSync: shouldFullSync,
      watermarkEntryId: priorState.watermark?.entryId ?? null,
    },
    "[pi-session-mirror] incremental sync delta"
  )

  if (newEntries.length > 0) {
    await upsertPiSessionEntriesBatch(client, newEntries)

    // Advance the watermark to the last synced entry in the SAME transaction
    // as the entries upsert; if the upsert throws, this update is skipped and
    // the transaction rolls back so the watermark never advances past data
    // that was not actually mirrored.
    const watermarkEntry = pickWatermarkEntry(newEntries)
    if (watermarkEntry) {
      await client.query(
        `UPDATE pi_sessions
         SET last_synced_entry_id = $2, last_synced_entry_timestamp = $3
         WHERE id = $1`,
        [input.id, watermarkEntry.entryId, watermarkEntry.entryTimestamp]
      )
    }
  }
}

export async function upsertPiSessionStub(
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
        ${PI_SESSION_USER_ID_ON_CONFLICT_SQL},
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

export function normalizeEntry(entry: SessionEntry): NormalizedSessionEntry {
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
    case "context_edit":
      // Pi 1.x append-only model-context edit. `replacement: null` omits the
      // target from future provider context; otherwise it replaces only the
      // target's content. Raw history is unchanged; recovery replays raw_entry.
      return {
        targetEntryId: entry.targetId,
        contentText:
          entry.replacement === null
            ? "[omitted from context]"
            : textFromUnknown(entry.replacement.content),
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

export function findFirstMessagePreview(entries: Array<SessionEntry>) {
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
  return JSON.stringify(sanitizeForMirror(value))
}

export function sanitizeForMirror(value: unknown): unknown {
  return sanitizeJsonForStorage(value, MIRROR_JSON_SANITIZE_OPTIONS)
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
