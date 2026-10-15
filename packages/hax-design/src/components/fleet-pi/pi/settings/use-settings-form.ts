import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  useChatPanelDataContext,
  useSettingsActionsContext,
} from "../../layout/right-panel-context"
import {
  sameJson,
  summarizeResources,
} from "../config-panel/shared/settings-mappers"
import { useModelDefaultsForm } from "./use-model-defaults-form"
import { useResourcesForm } from "./use-resources-form"
import type { SettingsSectionId } from "../settings-sections"
import type {
  ChatPiSettings,
  ChatPiSettingsUpdate,
} from "@workspace/pi-protocol/chat-protocol"

/**
 * Thin composer over the per-section form hooks; keeps the dialog-level
 * draft core, tab state, saving orchestration, and the discard flow.
 */
export function useSettingsForm() {
  const {
    isLoadingProviders,
    isUpdatingProvider,
    modelCatalog,
    onDiscoverModels,
    onRemoveProvider,
    onThemePreferenceChange,
    onUpdateProvider,
    providers = [],
    saveSettings,
    settings,
    settingsLoading,
    themePreference,
  } = useSettingsActionsContext()
  const { models, resources } = useChatPanelDataContext()

  const [draft, setDraft] = useState<ChatPiSettings | null>(null)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SettingsSectionId>("appearance")

  const resourceSummary = summarizeResources(resources)

  const updateDraft = (
    updater: (current: ChatPiSettings) => ChatPiSettings
  ) => {
    setDraft((current: ChatPiSettings | null) =>
      current ? updater(current) : current
    )
  }

  const {
    packageRows,
    packageError,
    resourceDirty,
    handlePackageRowsChange,
    revertResourceDraft,
  } = useResourcesForm({ draft, settings, updateDraft })

  const {
    modelFilter,
    setModelFilter,
    modelOptions,
    modelDirty,
    addModels,
    removeModel,
    discoverProvider,
    discoveringProviderId,
    commitModelSettings,
    revertModelDraft,
    resetCommittedModelBaseline,
  } = useModelDefaultsForm({
    draft,
    setDraft,
    updateDraft,
    settings,
    providers,
    models,
    modelCatalog,
    onDiscoverModels,
    saveSettings,
    setSavingSection,
  })

  const hasUnsavedChanges = modelDirty || resourceDirty

  const resetDraft = () => {
    if (!settings) return
    // Only the draft is owned here; package rows/error reconcile in
    // useResourcesForm's sync effect once draft settles.
    setDraft(settings.effective)
  }

  useEffect(() => {
    if (!settings) return

    const nextDraft = settings.effective

    if (draft && hasUnsavedChanges) return
    if (draft && sameJson(draft, nextDraft)) return

    setDraft(nextDraft)
  }, [draft, hasUnsavedChanges, settings])

  const saveSection = async (section: string, update: ChatPiSettingsUpdate) => {
    if (section === "models" && draft) {
      const saved = await commitModelSettings(draft)
      if (!saved) {
        throw new Error("Settings save failed")
      }
      return
    }

    setSavingSection(section)
    try {
      await saveSettings(update)
      toast.success("Pi settings saved")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Settings save failed"
      )
      throw error
    } finally {
      setSavingSection(null)
    }
  }

  const requestCloseSettings = async (): Promise<
    "close" | "discard-prompt" | "wait"
  > => {
    if (savingSection === "models") return "wait"
    if (resourceDirty) return "discard-prompt"
    // modelDirty already requires a non-null draft
    if (modelDirty && draft) {
      return (await commitModelSettings(draft, { silent: true }))
        ? "close"
        : "discard-prompt"
    }
    return "close"
  }

  return {
    isLoadingProviders,
    isUpdatingProvider,
    onThemePreferenceChange,
    onRemoveProvider,
    onUpdateProvider,
    providers,
    resources,
    settings,
    settingsLoading,
    themePreference,
    draft,
    savingSection,
    packageRows,
    packageError,
    modelFilter,
    setModelFilter,
    activeTab,
    setActiveTab,
    resourceSummary,
    modelOptions,
    modelDirty,
    resourceDirty,
    revertResourceDraft,
    revertModelDraft,
    resetDraft,
    updateDraft,
    handlePackageRowsChange,
    addModels,
    removeModel,
    discoverProvider,
    discoveringProviderId,
    saveSection,
    requestCloseSettings,
    resetCommittedModelBaseline,
    chatModels: models,
  }
}
