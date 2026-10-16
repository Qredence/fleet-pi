import { logger } from "../logger"
import {
  getChatPostgresPool,
  isPiSessionMirrorEnabled,
  withUserContext,
} from "./pi-session-ownership-db"
import { isPiSessionDeleted } from "./pi-session-tombstones"
import type { PostgresQueryClient } from "./pi-session-ownership-db"

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
