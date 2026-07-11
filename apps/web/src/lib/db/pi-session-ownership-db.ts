import { existsSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { Pool } from "@neondatabase/serverless"
import {
  isVercelDeployment,
  shouldFailClosedOnMirrorError,
} from "../deployment/environment"
import { requiresAuthenticatedMirrorOwner } from "../deployment/trust-zone"
import { logger } from "../logger"
import { resolveVercelUserSessionDir } from "../pi/session-paths"
import {
  isSessionAccessAllowed,
  isSessionOwnershipStatus,
} from "./session-ownership"
import { isPiSessionDeleted } from "./pi-session-tombstones"

export type PostgresQueryClient = {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: Array<unknown>
  ) => Promise<{ rows: Array<T> }>
}

let sharedPool: InstanceType<typeof Pool> | undefined

export function isPiSessionMirrorEnabled() {
  return Boolean(process.env.FLEET_PI_CHAT_DATABASE_URL?.trim())
}

export function getChatPostgresPool(): InstanceType<typeof Pool> | undefined {
  const connectionString = process.env.FLEET_PI_CHAT_DATABASE_URL?.trim()
  if (!connectionString) return undefined
  if (!sharedPool) {
    sharedPool = new Pool({ connectionString })
  }
  return sharedPool
}

export function assertMirrorOwnerForPersistence(userId?: string) {
  if (!requiresAuthenticatedMirrorOwner()) {
    return
  }

  if (!userId) {
    throw new Error(
      "Authenticated owner is required to persist Pi sessions on Vercel."
    )
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

export function isUserScopedEphemeralSessionFile(
  sessionFile: string,
  userId: string
) {
  if (!isVercelDeployment()) return false

  const normalized = resolve(sessionFile)
  const userPrefix = resolveVercelUserSessionDir(userId)
  if (normalized === userPrefix || !normalized.startsWith(`${userPrefix}/`)) {
    return false
  }
  if (!normalized.endsWith(".jsonl")) {
    return false
  }

  try {
    return existsSync(normalized) && statSync(normalized).isFile()
  } catch {
    return false
  }
}

export async function verifySessionOwnership(
  sessionId: string,
  userId: string,
  options: { sessionFile?: string } = {}
): Promise<boolean> {
  if (!isPiSessionMirrorEnabled()) return true

  const failClosedOnError = shouldFailClosedOnMirrorError()
  const pool = getChatPostgresPool()
  if (!pool) return failClosedOnError ? false : true

  try {
    const status = await lookupSessionOwnershipStatus(sessionId, userId)
    if (!status || !isSessionOwnershipStatus(status)) {
      logger.warn(
        { sessionId, userId, status },
        "[pi-session-mirror] unexpected session ownership status"
      )
      return failClosedOnError ? false : true
    }

    if (isSessionAccessAllowed(status, { denyMissing: failClosedOnError })) {
      return true
    }

    if (
      status === "missing" &&
      failClosedOnError &&
      options.sessionFile &&
      !isPiSessionDeleted(sessionId) &&
      isUserScopedEphemeralSessionFile(options.sessionFile, userId)
    ) {
      return true
    }

    return false
  } catch (error) {
    logger.warn(
      { error, sessionId, userId },
      "[pi-session-mirror] failed to verify session ownership"
    )
    return failClosedOnError ? false : true
  }
}

export async function verifyRunOwnership(
  runId: string,
  userId: string
): Promise<boolean> {
  if (!isPiSessionMirrorEnabled()) return true

  const pool = getChatPostgresPool()
  if (!pool) return !shouldFailClosedOnMirrorError()

  const failClosedOnError = shouldFailClosedOnMirrorError()

  try {
    const result = await withUserContext(pool, userId, async (client) =>
      client.query<{ id: string }>(
        `
          SELECT r.id
          FROM pi_runs AS r
          JOIN pi_sessions AS s ON s.id = r.session_id
          WHERE r.id = $1 AND s.user_id = $2
          LIMIT 1
        `,
        [runId, userId]
      )
    )
    return result.rows.length > 0
  } catch (error) {
    logger.warn(
      { error, runId, userId },
      "[pi-session-mirror] failed to verify run ownership"
    )
    return failClosedOnError ? false : true
  }
}

export type OwnedMirrorSessionRow = {
  id: string
  user_id: string | null
  session_file_path: string
  cwd: string
  version: number
  parent_session_file_path: string | null
  name: string | null
}

export type OwnedMirrorSessionLookup = {
  sessionId?: string
  sessionFile?: string
  userId: string
  columns?: "minimal" | "full"
}

type MinimalOwnedMirrorSessionRow = {
  id: string
  session_file_path: string
}

export async function resolveOwnedMirrorSession(
  input: OwnedMirrorSessionLookup & { columns: "minimal" }
): Promise<MinimalOwnedMirrorSessionRow | undefined>
export async function resolveOwnedMirrorSession(
  input: OwnedMirrorSessionLookup & { columns?: "full" }
): Promise<OwnedMirrorSessionRow | undefined>
export async function resolveOwnedMirrorSession(
  input: OwnedMirrorSessionLookup
): Promise<OwnedMirrorSessionRow | MinimalOwnedMirrorSessionRow | undefined> {
  const pool = getChatPostgresPool()
  if (!pool) return undefined

  const columns = input.columns ?? "full"
  const selectColumns =
    columns === "minimal"
      ? "id, session_file_path"
      : `
          id,
          user_id,
          session_file_path,
          cwd,
          version,
          parent_session_file_path,
          name
        `

  if (input.sessionId) {
    const status = await lookupSessionOwnershipStatus(
      input.sessionId,
      input.userId
    )
    if (!status || !isSessionOwnershipStatus(status)) {
      return undefined
    }
    if (
      !isSessionAccessAllowed(status, {
        denyMissing: shouldFailClosedOnMirrorError(),
      })
    ) {
      return undefined
    }
  }

  return withUserContext(pool, input.userId, async (client) => {
    if (input.sessionId) {
      const result = await client.query<
        OwnedMirrorSessionRow | MinimalOwnedMirrorSessionRow
      >(
        `
          SELECT ${selectColumns}
          FROM pi_sessions
          WHERE id = $1 AND user_id = $2
          LIMIT 1
        `,
        [input.sessionId, input.userId]
      )
      return result.rows[0]
    }

    if (!input.sessionFile) {
      return undefined
    }

    const result = await client.query<
      OwnedMirrorSessionRow | MinimalOwnedMirrorSessionRow
    >(
      `
        SELECT ${selectColumns}
        FROM pi_sessions
        WHERE session_file_path = $1 AND user_id = $2
        LIMIT 1
      `,
      [input.sessionFile, input.userId]
    )
    return result.rows[0]
  })
}

/** On conflict, never assign user_id to a previously ownerless row. */
export const PI_SESSION_USER_ID_ON_CONFLICT_SQL =
  "user_id = pi_sessions.user_id"
