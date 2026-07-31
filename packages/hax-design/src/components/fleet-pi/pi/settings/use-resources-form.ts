import { useState } from "react"

import {
  formatPackageSourceRows,
  parsePackageSourceRows,
  resourceSettings,
  sameJson,
} from "../config-panel/shared/settings-mappers"
import type {
  ChatPiSettings,
  ChatSettingsResponse,
} from "../../../../lib/pi/chat-protocol"

/**
 * Owns the resource-editing slice of the settings form: package source rows,
 * parse errors, resource dirty detection, and the resources revert.
 */
export function useResourcesForm({
  draft,
  settings,
  updateDraft,
}: {
  draft: ChatPiSettings | null
  settings: ChatSettingsResponse | null
  updateDraft: (updater: (current: ChatPiSettings) => ChatPiSettings) => void
}) {
  const [packageRows, setPackageRows] = useState<Array<string>>([])
  const [packageError, setPackageError] = useState<string | undefined>()

  const resourceDirty =
    !!draft &&
    !!settings &&
    (!sameJson(resourceSettings(draft), resourceSettings(settings.effective)) ||
      !sameJson(
        packageRows.filter((row) => row.trim()),
        formatPackageSourceRows(settings.effective.packages)
      ))

  const handlePackageRowsChange = (rows: Array<string>) => {
    setPackageRows(rows)
    try {
      const packages = parsePackageSourceRows(rows)
      setPackageError(undefined)
      updateDraft((current) => ({ ...current, packages }))
    } catch (error) {
      setPackageError(error instanceof Error ? error.message : String(error))
    }
  }

  const revertResourceDraft = () => {
    if (!settings) return
    updateDraft((current) => ({
      ...current,
      packages: settings.effective.packages,
      extensions: settings.effective.extensions,
      skills: settings.effective.skills,
      prompts: settings.effective.prompts,
      themes: settings.effective.themes,
      enableSkillCommands: settings.effective.enableSkillCommands,
    }))
    setPackageRows(formatPackageSourceRows(settings.effective.packages))
    setPackageError(undefined)
  }

  return {
    packageRows,
    setPackageRows,
    packageError,
    setPackageError,
    resourceDirty,
    handlePackageRowsChange,
    revertResourceDraft,
  }
}
