import { unlinkSync } from "node:fs"
import { logger } from "../logger"
import {
  getChatPostgresPool,
  isPiSessionMirrorEnabled,
  resolveOwnedMirrorSession,
  withUserContext,
} from "./pi-session-ownership-db"

export type SessionDeletionResult = {
  deleted: boolean
  sessionId?: string
  sessionFile?: string
  reason?: string
}

export type UserPiDataEraseResult =
  | { ok: true; erasedSessions: number; erasedProviders: number }
  | { ok: false; reason: string }

export async function deleteOwnedPiSession(input: {
  sessionId?: string
  sessionFile?: string
  userId: string
}): Promise<SessionDeletionResult> {
  if (!isPiSessionMirrorEnabled()) {
    return { deleted: false, reason: "mirror-disabled" }
  }

  const pool = getChatPostgresPool()
  if (!pool) {
    return { deleted: false, reason: "mirror-unavailable" }
  }

  try {
    const resolved = await resolveOwnedMirrorSession({
      ...input,
      columns: "minimal",
    })
    if (!resolved) {
      return { deleted: false, reason: "session-not-owned-or-missing" }
    }

    await withUserContext(pool, input.userId, async (client) => {
      await client.query(
        "DELETE FROM pi_sessions WHERE id = $1 AND user_id = $2",
        [resolved.id, input.userId]
      )
    })

    try {
      unlinkSync(resolved.session_file_path)
    } catch {
      // Ephemeral Vercel JSONL may already be gone.
    }

    logger.info(
      { sessionId: resolved.id, userId: input.userId },
      "[pi-session-deletion] deleted owned Pi session"
    )

    return {
      deleted: true,
      sessionId: resolved.id,
      sessionFile: resolved.session_file_path,
    }
  } catch (error) {
    logger.warn(
      { error, sessionId: input.sessionId, sessionFile: input.sessionFile },
      "[pi-session-deletion] failed to delete session"
    )
    return { deleted: false, reason: "delete-failed" }
  }
}

export async function eraseUserPiData(
  userId: string
): Promise<UserPiDataEraseResult> {
  if (!isPiSessionMirrorEnabled()) {
    return { ok: true, erasedSessions: 0, erasedProviders: 0 }
  }

  const pool = getChatPostgresPool()
  if (!pool) {
    return { ok: false, reason: "mirror-unavailable" }
  }

  try {
    const erased = await withUserContext(pool, userId, async (client) => {
      await client.query("BEGIN")
      try {
        const sessions = await client.query<{
          id: string
          session_file_path: string
        }>("SELECT id, session_file_path FROM pi_sessions WHERE user_id = $1", [
          userId,
        ])

        await client.query("DELETE FROM pi_sessions WHERE user_id = $1", [
          userId,
        ])
        const providers = await client.query<{ id: string }>(
          "DELETE FROM pi_user_providers WHERE user_id = $1 RETURNING id",
          [userId]
        )

        await client.query("COMMIT")

        for (const row of sessions.rows) {
          try {
            unlinkSync(row.session_file_path)
          } catch {
            // ignore missing ephemeral files
          }
        }

        return {
          erasedSessions: sessions.rows.length,
          erasedProviders: providers.rows.length,
        }
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    })

    return { ok: true, ...erased }
  } catch (error) {
    logger.warn(
      { error, userId },
      "[pi-session-deletion] failed to erase user Pi data"
    )
    return { ok: false, reason: "erase-failed" }
  }
}
