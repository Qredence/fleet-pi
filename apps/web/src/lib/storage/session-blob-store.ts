import { basename } from "node:path"
import {
  buildSessionObjectKey,
  downloadObjectToFile,
  isObjectStorageEnabled,
  uploadFileToObjectStorage,
} from "@/lib/storage/object-storage"

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
    return await downloadObjectToFile({
      bucket: "sessions",
      key,
      destinationPath: input.sessionFile,
    })
  } catch {
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
  return uploadFileToObjectStorage({
    bucket: "sessions",
    key,
    sourcePath: input.sessionFile,
    contentType: "application/x-ndjson",
  })
}

export function inferSessionIdFromFile(sessionFile: string) {
  const fileName = basename(sessionFile)
  return fileName.replace(/\.jsonl$/i, "")
}
