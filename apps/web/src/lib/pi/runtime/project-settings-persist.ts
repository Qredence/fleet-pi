import { sanitizePortableResourcePaths } from "./durable-project-settings"
import { usesDatabaseBackedProjectSettings } from "./deployed-chat-runtime"
import { getFleetBaseProjectSettings } from "./fleet-default-project-settings"
import { migrateLegacyGatewayProjectOverrides } from "./gateway-settings-migration"
import { compactProjectSettingsForPersist } from "./project-settings-merge"
import {
  loadUserProjectSettings,
  upsertUserProjectSettings,
} from "@/lib/db/user-settings"

export function prepareProjectSettingsForPersist(
  overrides: Record<string, unknown>
) {
  const base = getFleetBaseProjectSettings()
  return compactProjectSettingsForPersist(
    {
      ...base,
      ...sanitizePortableResourcePaths(overrides),
    },
    base
  )
}

export function projectSettingsOverridesEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>
) {
  return JSON.stringify(left) === JSON.stringify(right)
}

type MigratedProjectSettingsResult = {
  overrides: Record<string, unknown>
  /** Compacted record already flushed to `pi_user_settings`; skip the follow-up write. */
  persisted?: Record<string, unknown>
}

/**
 * Apply the legacy Gateway OCC migration to save-time overrides. On DB-backed
 * (Vercel) surfaces, when the migration changed the stored overrides and the
 * current stored row is absent or already migrated, flush the compacted record
 * so the caller's persist is a single upsert. Returns `persisted` so the caller
 * can skip its own write when the flush already wrote the identical record.
 */
export async function prepareProjectSettingsOverridesForPersist(
  overrides: Record<string, unknown>,
  userId: string | undefined
): Promise<MigratedProjectSettingsResult> {
  const migrated = migrateLegacyGatewayProjectOverrides(overrides, userId)
  if (
    !userId ||
    !usesDatabaseBackedProjectSettings() ||
    migrated === overrides
  ) {
    return { overrides: migrated }
  }

  const toPersist = prepareProjectSettingsForPersist(migrated)
  const stored = await loadUserProjectSettings(userId)
  const storedCompacted = stored ? prepareProjectSettingsForPersist(stored) : {}
  if (!projectSettingsOverridesEqual(storedCompacted, toPersist)) {
    await upsertUserProjectSettings(userId, toPersist)
    return { overrides: migrated, persisted: toPersist }
  }

  return { overrides: migrated }
}
