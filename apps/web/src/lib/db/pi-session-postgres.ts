import { logger } from "../logger"
import { resolveChatDatabaseUrl } from "./chat-database-url"
import { getChatPostgresPool, withUserContext } from "./pi-session-ownership-db"
import type { PostgresQueryClient } from "./pi-session-ownership-db"

export function createChatPostgresOperationQueue() {
  const connectionString = resolveChatDatabaseUrl()
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
          await withUserContext(pool, userId, operation)
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

  await withUserContext(pool, userId, operation)
}
