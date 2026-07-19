import { sanitizePortableResourcePaths } from "./durable-project-settings"
import { FLEET_PI_BASE_PROJECT_SETTINGS } from "./fleet-default-project-settings"
import { compactProjectSettingsForPersist } from "./project-settings-merge"

export function prepareProjectSettingsForPersist(
  overrides: Record<string, unknown>
) {
  return compactProjectSettingsForPersist({
    ...FLEET_PI_BASE_PROJECT_SETTINGS,
    ...sanitizePortableResourcePaths(overrides),
  })
}

export function projectSettingsOverridesEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>
) {
  return JSON.stringify(left) === JSON.stringify(right)
}
