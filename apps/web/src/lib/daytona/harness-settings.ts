import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import {
  loadUserProjectSettings,
  upsertUserProjectSettings,
} from "@/lib/db/user-settings"
import { usesDatabaseBackedProjectSettings } from "@/lib/pi/runtime/deployed-chat-runtime"
import {
  prepareProjectSettingsForPersist,
  prepareProjectSettingsOverridesForPersist,
  projectSettingsOverridesEqual,
} from "@/lib/pi/runtime/project-settings-persist"
import {
  projectSettingsPath,
  readRawProjectSettingsFile,
} from "@/lib/pi/runtime/project-settings-file"
import { serializeProjectSettingsPreservingFormat } from "@/lib/pi/runtime/project-settings-format"

const RESOURCE_KEYS = ["skills", "prompts", "extensions", "packages"] as const

export function mergeHarnessSettingArrays(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing }
  for (const key of RESOURCE_KEYS) {
    const incoming = stringList(patch[key])
    if (!incoming) continue
    const current = stringList(next[key]) ?? []
    const seen = new Set(current)
    const merged = [...current]
    for (const value of incoming) {
      if (seen.has(value)) continue
      seen.add(value)
      merged.push(value)
    }
    next[key] = merged
  }
  return next
}

/**
 * Keeps resource_install activation paths. Deployed chat stores them in
 * `pi_user_settings`. Local chat merges them into the project settings file.
 * Returns the merged document so the caller can also place it on the volume.
 */
export async function persistHarnessInstallSettings(input: {
  userId?: string
  cwd: string
  settings: Record<string, unknown>
}): Promise<Record<string, unknown>> {
  if (usesDatabaseBackedProjectSettings() && input.userId) {
    const existing = (await loadUserProjectSettings(input.userId)) ?? {}
    const merged = mergeHarnessSettingArrays(existing, input.settings)
    const prepared = await prepareProjectSettingsOverridesForPersist(
      merged,
      input.userId
    )
    if (!prepared.persisted) {
      const toPersist = prepareProjectSettingsForPersist(prepared.overrides)
      const storedCompacted = prepareProjectSettingsForPersist(existing)
      if (!projectSettingsOverridesEqual(storedCompacted, toPersist)) {
        await upsertUserProjectSettings(input.userId, toPersist)
      }
    }
    return merged
  }

  const raw = await readRawProjectSettingsFile(input.cwd)
  const existing = parseSettings(raw)
  const merged = mergeHarnessSettingArrays(existing, input.settings)
  const next = serializeProjectSettingsPreservingFormat(raw, merged)
  const path = projectSettingsPath(input.cwd)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, next, "utf8")
  return merged
}

function parseSettings(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

function stringList(value: unknown): Array<string> | undefined {
  if (!Array.isArray(value)) return undefined
  const strings = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  )
  return strings
}
