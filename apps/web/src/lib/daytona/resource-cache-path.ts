import { realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative, resolve, sep } from "node:path"
import { SANDBOX_WORKSPACE_ROOT } from "./sandbox-prepare"

export const RESOURCE_CACHE_PREFIX = join(tmpdir(), "fleet-pi-resources-")

function canonicalTempdir() {
  try {
    return realpathSync(tmpdir())
  } catch {
    return tmpdir()
  }
}

const TEMP_ROOTS = new Set([tmpdir(), canonicalTempdir()])

/**
 * Pi needs host files for skill expansion, but its advertised skill paths are
 * read by tools in Daytona. Translate only our disposable cache's Pi subtree
 * onto the currently bound sandbox; this never reads another user's host copy.
 */
export function resourceCachePathToSandbox(path: string): string {
  for (const tempRoot of TEMP_ROOTS) {
    const parts = relative(tempRoot, path).split(sep)
    if (
      !/^fleet-pi-resources-[A-Za-z0-9]{6}$/.test(parts[0]) ||
      parts[1] !== "pi"
    )
      continue
    return resolve(SANDBOX_WORKSPACE_ROOT, "pi", ...parts.slice(2))
  }
  return path
}
