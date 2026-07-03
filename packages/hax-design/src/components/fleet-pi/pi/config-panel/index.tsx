import { Bot } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { queueLabel } from "../../../../lib/pi/chat-helpers"
import { ConfigurationRow, ConfigurationSection } from "./shared/fields"
import {
  customModelKey,
  ensureModelEnabled,
  ensureModelPattern,
  isModelEnabled,
  nextEnabledModelPatterns,
  nextProviderModelPatterns,
} from "./shared/model-patterns"
import {
  formatPackageSourceRows,
  modelSettings,
  parsePackageSourceRows,
  recommendedModelPatterns,
  resourceSettings,
  runtimeSettings,
  sameJson,
  summarizeProviders,
  summarizeResources,
} from "./shared/settings-mappers"
import { ModelDefaultsSection } from "./sections/model-defaults-section"
import { PersonalizationSection } from "./sections/personalization-section"
import { ProviderCredentialsSection } from "./sections/provider-credentials-section"
import { ResourcesSection } from "./sections/resources-section"
import { RuntimePolicySection } from "./sections/runtime-policy-section"
import { RuntimeStatusSection } from "./sections/runtime-status-section"
import type { ConfigModelInfo } from "./shared/types"
import type { ChatStatus } from "../../../agent-elements/chat-types"
import type {
  ChatMode,
  ChatPiSettings,
  ChatPiSettingsUpdate,
  ChatProviderInfo,
  ChatProviderUpdateRequest,
  ChatProviderUpdateResponse,
  ChatResourcesResponse,
  ChatSettingsResponse,
  QueueState,
} from "../../../../lib/pi/chat-protocol"
import type { ThemePreference } from "../../../../lib/canvas-utils"

export type { ConfigModelInfo } from "./shared/types"

export function ConfigurationsPanelContent({
  activityLabel,
  isLoadingProviders = false,
  isUpdatingProvider = false,
  mode,
  models,
  onThemePreferenceChange,
  onUpdateProvider,
  planLabel,
  providers = [],
  queue,
  resources,
  saveSettings,
  selectedModelKey,
  settings,
  settingsError,
  settingsLoading,
  status,
  themePreference,
}: {
  activityLabel?: string
  isLoadingProviders?: boolean
  isUpdatingProvider?: boolean
  mode: ChatMode
  models: Array<ConfigModelInfo>
  onThemePreferenceChange: (preference: ThemePreference) => void
  onUpdateProvider?: (
    request: ChatProviderUpdateRequest
  ) => Promise<ChatProviderUpdateResponse>
  planLabel?: string
  providers?: Array<ChatProviderInfo>
  queue: QueueState
  resources: ChatResourcesResponse | null
  saveSettings: (settings: ChatPiSettingsUpdate) => Promise<void>
  selectedModelKey?: string
  settings: ChatSettingsResponse | null
  settingsError: Error | null
  settingsLoading: boolean
  status: ChatStatus
  themePreference: ThemePreference
}) {
  const [draft, setDraft] = useState<ChatPiSettings | null>(null)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [packageRows, setPackageRows] = useState<Array<string>>([])
  const [packageError, setPackageError] = useState<string | undefined>()
  const [customProvider, setCustomProvider] = useState("")
  const [customModel, setCustomModel] = useState("")
  const [modelFilter, setModelFilter] = useState("")
  const [providerFilter, setProviderFilter] = useState("all")
  const resourceSummary = summarizeResources(resources)
  const queueDescription = queueLabel(queue) ?? "No queued prompts"
  const runtimeStatus =
    status === "streaming"
      ? "Streaming"
      : status === "submitted"
        ? "Submitting"
        : status === "error"
          ? "Error"
          : "Ready"

  const modelOptions = useMemo(() => {
    if (!draft?.defaultProvider || !draft.defaultModel) return models
    if (
      models.some(
        (model) =>
          model.provider === draft.defaultProvider &&
          model.modelId === draft.defaultModel
      )
    ) {
      return models
    }

    return [
      {
        id: customModelKey(draft.defaultProvider, draft.defaultModel),
        name: draft.defaultModel,
        provider: draft.defaultProvider,
        modelId: draft.defaultModel,
        available: false,
      },
      ...models,
    ]
  }, [draft, models])

  const modelSelectValue = useMemo(() => {
    if (!draft) return selectedModelKey ?? ""
    return (
      modelOptions.find(
        (model) =>
          model.provider === draft.defaultProvider &&
          model.modelId === draft.defaultModel
      )?.id ??
      selectedModelKey ??
      ""
    )
  }, [draft, modelOptions, selectedModelKey])
  const providerOptions = useMemo(
    () => summarizeProviders(modelOptions, draft?.enabledModels),
    [draft?.enabledModels, modelOptions]
  )

  const modelDirty =
    !!draft &&
    !!settings &&
    !sameJson(modelSettings(draft), modelSettings(settings.effective))
  const runtimeDirty =
    !!draft &&
    !!settings &&
    !sameJson(runtimeSettings(draft), runtimeSettings(settings.effective))
  const resourceDirty =
    !!draft &&
    !!settings &&
    (!sameJson(resourceSettings(draft), resourceSettings(settings.effective)) ||
      !sameJson(
        packageRows.filter((row) => row.trim()),
        formatPackageSourceRows(settings.effective.packages)
      ))
  const hasUnsavedChanges = modelDirty || runtimeDirty || resourceDirty

  useEffect(() => {
    if (!settings) return

    const nextDraft = settings.effective
    const nextPackageRows = formatPackageSourceRows(nextDraft.packages)
    const nextCustomProvider = nextDraft.defaultProvider ?? ""
    const nextCustomModel = nextDraft.defaultModel ?? ""

    if (draft && hasUnsavedChanges) return
    if (
      draft &&
      sameJson(draft, nextDraft) &&
      sameJson(packageRows, nextPackageRows) &&
      customProvider === nextCustomProvider &&
      customModel === nextCustomModel &&
      packageError === undefined
    ) {
      return
    }

    setDraft(nextDraft)
    setPackageRows(nextPackageRows)
    setPackageError(undefined)
    setCustomProvider(nextCustomProvider)
    setCustomModel(nextCustomModel)
  }, [
    customModel,
    customProvider,
    draft,
    hasUnsavedChanges,
    packageError,
    packageRows,
    settings,
  ])

  const updateDraft = (
    updater: (current: ChatPiSettings) => ChatPiSettings
  ) => {
    setDraft((current) => (current ? updater(current) : current))
  }

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

  const setModelEnabled = (model: ConfigModelInfo, enabled: boolean) => {
    updateDraft((current) => ({
      ...current,
      enabledModels: nextEnabledModelPatterns({
        currentPatterns: current.enabledModels,
        enabled,
        model,
        models: modelOptions,
      }),
    }))
  }

  const setProviderEnabled = (provider: string, enabled: boolean) => {
    updateDraft((current) => ({
      ...current,
      enabledModels: nextProviderModelPatterns({
        currentPatterns: current.enabledModels,
        enabled,
        models: modelOptions,
        provider,
      }),
    }))
  }

  const setAllModelsEnabled = (enabled: boolean) => {
    updateDraft((current) => ({
      ...current,
      enabledModels: enabled ? undefined : [],
    }))
  }

  const useRecommendedModels = () => {
    updateDraft((current) => ({
      ...current,
      enabledModels: recommendedModelPatterns(current),
    }))
  }

  const useProviderAsDefault = (provider: string) => {
    const providerModels = modelOptions.filter(
      (model) => model.provider === provider
    )
    const activeModel =
      providerModels.find((model) =>
        isModelEnabled(model, draft?.enabledModels)
      ) ?? providerModels.at(0)

    if (!activeModel) {
      updateDraft((current) => ({
        ...current,
        defaultProvider: provider,
      }))
      return
    }

    updateDraft((current) => ({
      ...current,
      defaultProvider: provider,
      defaultModel: activeModel.modelId,
      enabledModels: ensureModelEnabled(current.enabledModels, activeModel),
    }))
  }

  const useCustomModel = () => {
    const provider = customProvider.trim()
    const model = customModel.trim()
    if (!provider || !model) {
      toast.error("Custom provider and model are required")
      return
    }
    updateDraft((current) => ({
      ...current,
      defaultProvider: provider,
      defaultModel: model,
      enabledModels: ensureModelPattern(current.enabledModels, provider, model),
    }))
  }

  const saveSection = async (section: string, update: ChatPiSettingsUpdate) => {
    setSavingSection(section)
    try {
      await saveSettings(update)
      toast.success("Pi settings saved")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Settings save failed"
      )
    } finally {
      setSavingSection(null)
    }
  }

  return (
    <div className="space-y-3" data-testid="configurations-tab">
      <PersonalizationSection
        onThemePreferenceChange={onThemePreferenceChange}
        themePreference={themePreference}
      />

      <RuntimeStatusSection
        activityLabel={activityLabel}
        mode={mode}
        planLabel={planLabel}
        queue={queue}
        queueDescription={queueDescription}
        runtimeStatus={runtimeStatus}
        settings={settings}
        settingsError={settingsError}
        settingsLoading={settingsLoading}
      />

      <ProviderCredentialsSection
        isLoading={isLoadingProviders}
        isPending={isUpdatingProvider}
        providers={providers}
        onUpdateProvider={onUpdateProvider}
      />

      <ModelDefaultsSection
        customModel={customModel}
        customProvider={customProvider}
        draft={draft}
        modelDirty={modelDirty}
        modelFilter={modelFilter}
        modelOptions={modelOptions}
        modelSelectValue={modelSelectValue}
        onConnectProvider={(provider) => {
          setCustomProvider(provider)
          setCustomModel("")
        }}
        onCustomModelChange={setCustomModel}
        onCustomProviderChange={setCustomProvider}
        onModelDefault={(model) =>
          updateDraft((current) => ({
            ...current,
            defaultProvider: model.provider,
            defaultModel: model.modelId,
            enabledModels: ensureModelEnabled(current.enabledModels, model),
          }))
        }
        onModelFilterChange={setModelFilter}
        onModelToggle={setModelEnabled}
        onProviderDefault={useProviderAsDefault}
        onProviderFilterChange={setProviderFilter}
        onProviderToggle={setProviderEnabled}
        onRevert={() => {
          if (!settings) return
          updateDraft((current) => ({
            ...current,
            defaultProvider: settings.effective.defaultProvider,
            defaultModel: settings.effective.defaultModel,
            defaultThinkingLevel: settings.effective.defaultThinkingLevel,
            enabledModels: settings.effective.enabledModels,
          }))
        }}
        onSave={() => draft && saveSection("models", modelSettings(draft))}
        onSetAllModels={setAllModelsEnabled}
        onThinkingLevelChange={(value) =>
          updateDraft((current) => ({
            ...current,
            defaultThinkingLevel: value,
          }))
        }
        onUseCustomModel={useCustomModel}
        onUseRecommended={useRecommendedModels}
        providerFilter={providerFilter}
        providerOptions={providerOptions}
        saving={savingSection === "models"}
        settingsLoading={settingsLoading}
      />

      <RuntimePolicySection
        draft={draft}
        onCompactionEnabledChange={(enabled) =>
          updateDraft((current) => ({
            ...current,
            compaction: { ...current.compaction, enabled },
          }))
        }
        onCompactionKeepRecentTokensChange={(keepRecentTokens) =>
          updateDraft((current) => ({
            ...current,
            compaction: { ...current.compaction, keepRecentTokens },
          }))
        }
        onCompactionReserveTokensChange={(reserveTokens) =>
          updateDraft((current) => ({
            ...current,
            compaction: { ...current.compaction, reserveTokens },
          }))
        }
        onFollowUpModeChange={(followUpMode) =>
          updateDraft((current) => ({ ...current, followUpMode }))
        }
        onRetryBaseDelayMsChange={(baseDelayMs) =>
          updateDraft((current) => ({
            ...current,
            retry: { ...current.retry, baseDelayMs },
          }))
        }
        onRetryEnabledChange={(enabled) =>
          updateDraft((current) => ({
            ...current,
            retry: { ...current.retry, enabled },
          }))
        }
        onRetryMaxRetriesChange={(maxRetries) =>
          updateDraft((current) => ({
            ...current,
            retry: { ...current.retry, maxRetries },
          }))
        }
        onRevert={() => {
          if (!settings) return
          updateDraft((current) => ({
            ...current,
            compaction: settings.effective.compaction,
            retry: settings.effective.retry,
            steeringMode: settings.effective.steeringMode,
            followUpMode: settings.effective.followUpMode,
            transport: settings.effective.transport,
          }))
        }}
        onSave={() => draft && saveSection("runtime", runtimeSettings(draft))}
        onSteeringModeChange={(steeringMode) =>
          updateDraft((current) => ({ ...current, steeringMode }))
        }
        onTransportChange={(transport) =>
          updateDraft((current) => ({ ...current, transport }))
        }
        runtimeDirty={runtimeDirty}
        saving={savingSection === "runtime"}
        settingsLoading={settingsLoading}
      />

      <ResourcesSection
        draft={draft}
        onEnableSkillCommandsChange={(enableSkillCommands) =>
          updateDraft((current) => ({ ...current, enableSkillCommands }))
        }
        onExtensionsChange={(extensions) =>
          updateDraft((current) => ({ ...current, extensions }))
        }
        onPackageRowsChange={handlePackageRowsChange}
        onPromptsChange={(prompts) =>
          updateDraft((current) => ({ ...current, prompts }))
        }
        onRevert={() => {
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
        }}
        onSave={() =>
          draft && saveSection("resources", resourceSettings(draft))
        }
        onSkillsChange={(skills) =>
          updateDraft((current) => ({ ...current, skills }))
        }
        onThemesChange={(themes) =>
          updateDraft((current) => ({ ...current, themes }))
        }
        packageError={packageError}
        packageRows={packageRows}
        resourceDirty={resourceDirty}
        resourceSummary={resourceSummary}
        saving={savingSection === "resources"}
        settingsLoading={settingsLoading}
      />

      <ConfigurationSection icon={Bot} label="Runtime Models">
        <ConfigurationRow
          description={`${models.length} registry models discovered. Manage provider and model activation above.`}
          status="Catalog"
          title="Model registry"
        />
      </ConfigurationSection>
    </div>
  )
}
