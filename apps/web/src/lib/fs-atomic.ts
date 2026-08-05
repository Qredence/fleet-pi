import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

/**
 * Atomically writes `content` to `filePath` via a same-directory temp file +
 * rename, so a crash mid-write cannot leave a truncated target. Cleans up the
 * temp file when the write or rename fails.
 *
 * The temp file is created with mode `0600` (owner read/write only) so
 * secret-bearing targets (e.g. `.env.local`, `.fleet/providers.*.json`) never
 * become world-readable under a permissive umask; the rename preserves it.
 *
 * @param filePath - Destination path (its parent directory is created on demand)
 * @param content - UTF-8 content to persist
 */
export async function writeFileAtomic(filePath: string, content: string) {
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  try {
    await writeFile(tempPath, content, { encoding: "utf8", mode: 0o600 })
    await rename(tempPath, filePath)
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {})
    throw error
  }
}
