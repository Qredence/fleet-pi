import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const PROJECT_SETTINGS_PATH = ".pi/settings.json"

export function projectSettingsPath(projectRoot: string) {
  return join(projectRoot, PROJECT_SETTINGS_PATH)
}

export async function readProjectSettingsFile(projectRoot: string) {
  try {
    const content = await readFile(projectSettingsPath(projectRoot), "utf8")
    const parsed = JSON.parse(content) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return {}
    throw error
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}
