import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  writeSync,
} from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
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

    writeRecoveredSessionFile(targetPath.sessionFile, `${lines.join("\n")}\n`)

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
  const resolvedSessionDir = resolve(sessionDir)
  const sessionFile = isPathInside(resolvedSessionDir, normalizedMirrored)
    ? normalizedMirrored
    : join(resolvedSessionDir, `${sessionId}.jsonl`)

  return {
    sessionFile,
    recoveredFromDisk: existsSync(sessionFile),
  }
}

function isPathInside(parent: string, child: string) {
  const path = relative(parent, child)
  return path === "" || (!path.startsWith("..") && !isAbsolute(path))
}

function writeRecoveredSessionFile(sessionFile: string, content: string) {
  const parentDir = dirname(sessionFile)
  mkdirSync(parentDir, { recursive: true, mode: 0o700 })
  try {
    chmodSync(parentDir, 0o700)
  } catch {
    // Parent may already exist with different ownership in tests.
  }
  // lgtm[js/insecure-temporary-file-creation] Vercel Pi sessions are intentionally
  // reconstructed under user-scoped /tmp/.fleet/sessions paths validated above.
  const fd = openSync(sessionFile, "wx", 0o600)
  try {
    writeSync(fd, content, undefined, "utf8")
  } finally {
    closeSync(fd)
  }
}
