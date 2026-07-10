import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { shouldFailClosedOnMirrorError } from "../deployment/environment"
import { logger } from "../logger"
import {
  getChatPostgresPool,
  isPiSessionMirrorEnabled,
  resolveOwnedMirrorSession,
  withUserContext,
} from "./pi-session-ownership-db"
import type {
  SessionEntry,
  SessionHeader,
} from "@earendil-works/pi-coding-agent"

type MirrorEntryRow = {
  entry_id: string
  parent_entry_id: string | null
  raw_entry: SessionEntry
  entry_timestamp: string
}

export type SessionRecoveryResult = {
  recovered: boolean
  sessionFile?: string
  reason?: string
}

export async function recoverOwnedSessionFile(input: {
  sessionId?: string
  sessionFile?: string
  userId: string
  sessionDir: string
}): Promise<SessionRecoveryResult> {
  if (!isPiSessionMirrorEnabled()) {
    return { recovered: false, reason: "mirror-disabled" }
  }

  const pool = getChatPostgresPool()
  if (!pool) {
    return { recovered: false, reason: "mirror-unavailable" }
  }

  try {
    const session = await resolveOwnedMirrorSession({
      sessionId: input.sessionId,
      sessionFile: input.sessionFile,
      userId: input.userId,
    })
    if (!session) {
      return { recovered: false, reason: "session-not-owned-or-missing" }
    }

    const targetPath = resolveRecoveredSessionPath(
      session.session_file_path,
      input.sessionDir,
      session.id
    )

    if (targetPath.recoveredFromDisk) {
      return {
        recovered: true,
        sessionFile: targetPath.sessionFile,
        reason: "existing-jsonl",
      }
    }

    const entries = await fetchMirrorEntries(pool, session.id, input.userId)
    if (entries.length === 0) {
      return { recovered: false, reason: "mirror-empty" }
    }

    const header: SessionHeader = {
      type: "session",
      version: session.version,
      id: session.id,
      timestamp: entries[0]?.entry_timestamp ?? new Date().toISOString(),
      cwd: session.cwd,
      ...(session.parent_session_file_path
        ? { parentSession: session.parent_session_file_path }
        : {}),
    }

    const lines = [
      JSON.stringify(header),
      ...entries.map((entry) => JSON.stringify(entry.raw_entry)),
    ]

    mkdirSync(dirname(targetPath.sessionFile), { recursive: true })
    writeFileSync(targetPath.sessionFile, `${lines.join("\n")}\n`, "utf8")

    logger.info(
      { sessionId: session.id, sessionFile: targetPath.sessionFile },
      "[pi-session-recovery] restored session JSONL from Neon mirror"
    )

    return {
      recovered: true,
      sessionFile: targetPath.sessionFile,
      reason: "reconstructed-from-mirror",
    }
  } catch (error) {
    logger.warn(
      { error, sessionId: input.sessionId, sessionFile: input.sessionFile },
      "[pi-session-recovery] failed to recover session"
    )
    return {
      recovered: false,
      reason: shouldFailClosedOnMirrorError()
        ? "recovery-failed"
        : "recovery-skipped",
    }
  }
}

async function fetchMirrorEntries(
  pool: NonNullable<ReturnType<typeof getChatPostgresPool>>,
  sessionId: string,
  userId: string
) {
  return withUserContext(pool, userId, async (client) => {
    const result = await client.query<MirrorEntryRow>(
      `
        SELECT entry_id, parent_entry_id, raw_entry, entry_timestamp
        FROM pi_session_entries
        WHERE session_id = $1
        ORDER BY entry_timestamp ASC, entry_id ASC
      `,
      [sessionId]
    )
    return result.rows
  })
}

function resolveRecoveredSessionPath(
  mirroredPath: string,
  sessionDir: string,
  sessionId: string
) {
  const normalizedMirrored = resolve(mirroredPath)
  const sessionFile = normalizedMirrored.startsWith(sessionDir)
    ? normalizedMirrored
    : join(sessionDir, `${sessionId}.jsonl`)

  return {
    sessionFile,
    recoveredFromDisk: existsSync(sessionFile),
  }
}
