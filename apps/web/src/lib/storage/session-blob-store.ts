import { basename } from "node:path"
import { createRequestLogger } from "@/lib/logger"
import {
  buildSessionObjectKey,
  downloadObjectToFile,
  isObjectStorageEnabled,
  uploadFileToObjectStorage,
} from "@/lib/storage/object-storage"

const log = createRequestLogger("session-blob-store")

export async function hydrateSessionFileFromObjectStorage(input: {
  userId?: string
  sessionId?: string
  sessionFile: string
}) {
  if (!isObjectStorageEnabled() || !input.userId || !input.sessionId) {
    return false
  }

  const key = buildSessionObjectKey(input.userId, input.sessionId)
  try {
    const hydrated = await downloadObjectToFile({
      bucket: "sessions",
      key,
      destinationPath: input.sessionFile,
    })
    if (!hydrated) {
      log.info({ sessionId: input.sessionId, key }, "session blob hydrate miss")
    }
    return hydrated
  } catch (error) {
    log.warn(
      {
        sessionId: input.sessionId,
        key,
        error: error instanceof Error ? error.message : String(error),
      },
      "session blob hydrate failed"
    )
    return false
  }
}

export async function persistSessionFileToObjectStorage(input: {
  userId?: string
  sessionId?: string
  sessionFile: string
}) {
  if (!isObjectStorageEnabled() || !input.userId || !input.sessionId) {
    return false
  }

  const key = buildSessionObjectKey(input.userId, input.sessionId)
  try {
    return await uploadFileToObjectStorage({
      bucket: "sessions",
      key,
      sourcePath: input.sessionFile,
      contentType: "application/x-ndjson",
    })
  } catch (error) {
    log.warn(
      {
        sessionId: input.sessionId,
        key,
        error: error instanceof Error ? error.message : String(error),
      },
      "session blob persist failed"
    )
    return false
  }
}

export function inferSessionIdFromFile(sessionFile: string) {
  const fileName = basename(sessionFile)
  return fileName.replace(/\.jsonl$/i, "")
}
