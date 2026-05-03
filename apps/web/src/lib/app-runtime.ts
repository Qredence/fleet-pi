import { realpathSync } from "node:fs"
import { resolve } from "node:path"

const DEFAULT_PROJECT_ROOT = process.cwd()

export function getDefaultProjectRoot() {
  return realpathSync(
    resolve(process.env.FLEET_PI_REPO_ROOT ?? DEFAULT_PROJECT_ROOT)
  )
}
