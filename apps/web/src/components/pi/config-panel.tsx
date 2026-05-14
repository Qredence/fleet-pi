/* eslint-disable max-lines -- The configurations surface intentionally keeps closely related section editors together. */
/* eslint-disable max-lines-per-function -- The top-level panel coordinates shared dirty/revert/save state across sections. */
import {
  Activity,
  Bot,
  Cable,
  Check,
  Cpu,
  Info,
  Monitor,
  Moon,
  Palette,
  PlugZap,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  Save,
  Search,
  Sun,
  Trash2,
  Wrench,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Select } from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import type {
  ChatDeliveryMode,
  ChatMode,
  ChatPackageSource,
  ChatPiSettings,
  ChatPiSettingsUpdate,
  ChatResourcesResponse,
  ChatSettingsResponse,
  ChatThinkingLevel,
  ChatTransport,
} from "@/lib/pi/chat-protocol"
import type { ThemePreference } from "@/lib/canvas-utils"
import type { QueueState } from "@/lib/pi/chat-fetch"
import type { ChatStatus } from "@workspace/ui/components/agent-elements/chat-types"
import { queueLabel } from "@/lib/pi/chat-helpers"

const THINKING_LEVELS: Array<ChatThinkingLevel> = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]
const DELIVERY_MODES: Array<ChatDeliveryMode> = ["one-at-a-time", "all"]
const TRANSPORTS: Array<ChatTransport> = ["auto", "sse", "websocket"]
const FIELD_CONTROL_CLASS =
  "h-8 rounded-[7px] border-border/50 bg-background/70 px-2 py-1.5 text-[12px] text-foreground/70 placeholder:text-foreground/25 focus-visible:border-foreground/25 focus-visible:ring-2 focus-visible:ring-foreground/10"

export type ConfigModelInfo = {
  id: string
  name: string
  provider: string
  modelId: string
  version?: string
  reasoning?: boolean
  available?: boolean
  thinkingLevel?: ChatThinkingLevel
}

type ProviderSummary = {
  active: number
  available: number
  provider: string
  total: number
}

export function ConfigurationsPanelContent({
  activityLabel,
  mode,
  models,
  onThemePreferenceChange,
  planLabel,
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
  mode: ChatMode
  models: Array<ConfigModelInfo>
  onThemePreferenceChange: (preference: ThemePreference) => void
  planLabel?: string
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

      <ConfigurationSection icon={Cpu} label="Model Defaults">
        <EditableSection
          dirty={modelDirty}
          disabled={!draft || settingsLoading}
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
          saving={savingSection === "models"}
          title="Providers and models"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
            <DefaultModelSummary
              model={modelOptions.find((item) => item.id === modelSelectValue)}
              provider={draft?.defaultProvider}
            />
            <FieldLabel label="Thinking">
              <Select
                aria-label="Thinking level"
                value={draft?.defaultThinkingLevel ?? ""}
                disabled={!draft}
                onValueChange={(nextValue) => {
                  const value = nextValue as ChatThinkingLevel
                  updateDraft((current) => ({
                    ...current,
                    defaultThinkingLevel: value,
                  }))
                }}
                className={FIELD_CONTROL_CLASS}
                options={THINKING_LEVELS.map((level) => ({
                  label: level,
                  value: level,
                }))}
              />
            </FieldLabel>
          </div>
          <ProviderManagementList
            defaultProvider={draft?.defaultProvider}
            onConnect={(provider) => {
              setCustomProvider(provider)
              setCustomModel("")
            }}
            onDefault={useProviderAsDefault}
            onToggle={setProviderEnabled}
            providers={providerOptions}
          />
          <CustomModelEditor
            model={customModel}
            onModelChange={setCustomModel}
            onUse={useCustomModel}
            onProviderChange={setCustomProvider}
            provider={customProvider}
            providers={providerOptions.map((item) => item.provider)}
          />
          <ModelActivationList
            defaultModel={draft?.defaultModel}
            defaultProvider={draft?.defaultProvider}
            enabledPatterns={draft?.enabledModels}
            filter={modelFilter}
            models={modelOptions}
            onDefault={(model) =>
              updateDraft((current) => ({
                ...current,
                defaultProvider: model.provider,
                defaultModel: model.modelId,
                enabledModels: ensureModelEnabled(current.enabledModels, model),
              }))
            }
            onFilterChange={setModelFilter}
            onProviderFilterChange={setProviderFilter}
            onSetAll={setAllModelsEnabled}
            onToggle={setModelEnabled}
            onUseRecommended={useRecommendedModels}
            providerFilter={providerFilter}
            providers={providerOptions}
          />
        </EditableSection>
      </ConfigurationSection>

      <ConfigurationSection icon={Wrench} label="Runtime Policy">
        <EditableSection
          dirty={runtimeDirty}
          disabled={!draft || settingsLoading}
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
          saving={savingSection === "runtime"}
          title="Delivery, compaction, retry"
        >
          <div className="grid grid-cols-2 gap-2">
            <ToggleField
              checked={draft?.compaction.enabled ?? true}
              disabled={!draft}
              label="Compaction"
              onChange={(enabled) =>
                updateDraft((current) => ({
                  ...current,
                  compaction: { ...current.compaction, enabled },
                }))
              }
            />
            <ToggleField
              checked={draft?.retry.enabled ?? true}
              disabled={!draft}
              label="Retry"
              onChange={(enabled) =>
                updateDraft((current) => ({
                  ...current,
                  retry: { ...current.retry, enabled },
                }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Reserve tokens"
              min={1}
              value={draft?.compaction.reserveTokens ?? 16384}
              onChange={(reserveTokens) =>
                updateDraft((current) => ({
                  ...current,
                  compaction: { ...current.compaction, reserveTokens },
                }))
              }
            />
            <NumberField
              label="Recent tokens"
              min={1}
              value={draft?.compaction.keepRecentTokens ?? 20000}
              onChange={(keepRecentTokens) =>
                updateDraft((current) => ({
                  ...current,
                  compaction: { ...current.compaction, keepRecentTokens },
                }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Max retries"
              min={0}
              value={draft?.retry.maxRetries ?? 3}
              onChange={(maxRetries) =>
                updateDraft((current) => ({
                  ...current,
                  retry: { ...current.retry, maxRetries },
                }))
              }
            />
            <NumberField
              label="Base delay ms"
              min={0}
              value={draft?.retry.baseDelayMs ?? 2000}
              onChange={(baseDelayMs) =>
                updateDraft((current) => ({
                  ...current,
                  retry: { ...current.retry, baseDelayMs },
                }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Steering"
              value={draft?.steeringMode ?? "one-at-a-time"}
              values={DELIVERY_MODES}
              onChange={(steeringMode) =>
                updateDraft((current) => ({ ...current, steeringMode }))
              }
            />
            <SelectField
              label="Follow-ups"
              value={draft?.followUpMode ?? "one-at-a-time"}
              values={DELIVERY_MODES}
              onChange={(followUpMode) =>
                updateDraft((current) => ({ ...current, followUpMode }))
              }
            />
          </div>
          <SelectField
            label="Transport"
            value={draft?.transport ?? "auto"}
            values={TRANSPORTS}
            onChange={(transport) =>
              updateDraft((current) => ({ ...current, transport }))
            }
          />
        </EditableSection>
      </ConfigurationSection>

      <ConfigurationSection icon={Cable} label="Resources">
        <ConfigurationRow
          description={
            resourceSummary.total > 0
              ? `${resourceSummary.total} cataloged resources. ${resourceSummary.reloadRequired} require a reload.`
              : "No resources are currently cataloged."
          }
          status={resourceSummary.total > 0 ? "Cataloged" : "Empty"}
          title="Resource catalog"
        />
        <EditableSection
          dirty={resourceDirty}
          disabled={!draft || settingsLoading || !!packageError}
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
          saving={savingSection === "resources"}
          title="Packages and paths"
        >
          <InlineNotice>
            Resource changes are project-scoped and become reliable in a new or
            reloaded Pi session.
          </InlineNotice>
          <FieldLabel label="Packages">
            <StringListEditor
              addLabel="Add package"
              emptyLabel="No Pi packages configured."
              placeholder='npm:pi-skills or {"source":"npm:pkg"}'
              values={packageRows}
              onChange={handlePackageRowsChange}
            />
            {packageError ? (
              <p className="text-[11px] leading-4 text-red-300">
                {packageError}
              </p>
            ) : null}
          </FieldLabel>
          <PathListField
            label="Extensions"
            values={draft?.extensions ?? []}
            addLabel="Add extension path"
            onChange={(extensions) =>
              updateDraft((current) => ({ ...current, extensions }))
            }
          />
          <PathListField
            label="Skills"
            values={draft?.skills ?? []}
            addLabel="Add skill path"
            onChange={(skills) =>
              updateDraft((current) => ({ ...current, skills }))
            }
          />
          <PathListField
            label="Prompts"
            values={draft?.prompts ?? []}
            addLabel="Add prompt path"
            onChange={(prompts) =>
              updateDraft((current) => ({ ...current, prompts }))
            }
          />
          <PathListField
            label="Themes"
            values={draft?.themes ?? []}
            addLabel="Add theme path"
            onChange={(themes) =>
              updateDraft((current) => ({ ...current, themes }))
            }
          />
          <ToggleField
            checked={draft?.enableSkillCommands ?? true}
            disabled={!draft}
            label="Skill slash commands"
            onChange={(enableSkillCommands) =>
              updateDraft((current) => ({ ...current, enableSkillCommands }))
            }
          />
        </EditableSection>
      </ConfigurationSection>

      <PersonalizationSection
        onThemePreferenceChange={onThemePreferenceChange}
        themePreference={themePreference}
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

function RuntimeStatusSection({
  activityLabel,
  mode,
  planLabel,
  queue,
  queueDescription,
  runtimeStatus,
  settings,
  settingsError,
  settingsLoading,
}: {
  activityLabel?: string
  mode: ChatMode
  planLabel?: string
  queue: QueueState
  queueDescription: string
  runtimeStatus: string
  settings: ChatSettingsResponse | null
  settingsError: Error | null
  settingsLoading: boolean
}) {
  return (
    <ConfigurationSection icon={Activity} label="Runtime">
      <ConfigurationRow
        description={activityLabel ?? "Idle and waiting for the next prompt."}
        status={runtimeStatus}
        title="Request status"
      />
      <ConfigurationRow
        description={queueDescription}
        status={
          queue.followUp.length + queue.steering.length > 0 ? "Active" : "Idle"
        }
        title="Prompt queue"
      />
      <ConfigurationRow
        description={
          planLabel ??
          (mode === "plan"
            ? "Plan mode is enabled and ready for the next planning turn."
            : mode === "harness"
              ? "Harness mode is active for agent-workspace architecture management."
              : "No active plan decision is pending.")
        }
        status={
          mode === "plan"
            ? "Plan mode"
            : mode === "harness"
              ? "Harness mode"
              : "Agent mode"
        }
        title="Plan state"
      />
      <ConfigurationRow
        description={
          settingsError
            ? settingsError.message
            : settings
              ? `Project settings are loaded from ${settings.projectPath}.`
              : "Loading project-scoped Pi settings."
        }
        status={settingsError ? "Error" : settingsLoading ? "Loading" : "Ready"}
        title="Settings source"
      />
    </ConfigurationSection>
  )
}

function PersonalizationSection({
  onThemePreferenceChange,
  themePreference,
}: {
  onThemePreferenceChange: (preference: ThemePreference) => void
  themePreference: ThemePreference
}) {
  return (
    <ConfigurationSection icon={Palette} label="Personalization">
      <div className="rounded-[8px] border border-border/60 bg-foreground/2 px-2.5 py-2">
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-foreground/75">
              Theme
            </div>
            <p className="mt-0.5 text-[11px] leading-4 text-foreground/40">
              Choose Light, Dark, or follow the system appearance.
            </p>
          </div>
        </div>
        <div className="flex rounded-[7px] bg-foreground/5 p-0.5">
          <ThemeSegment
            active={themePreference === "light"}
            icon={Sun}
            label="Light"
            onClick={() => onThemePreferenceChange("light")}
          />
          <ThemeSegment
            active={themePreference === "dark"}
            icon={Moon}
            label="Dark"
            onClick={() => onThemePreferenceChange("dark")}
          />
          <ThemeSegment
            active={themePreference === "system"}
            icon={Monitor}
            label="System"
            onClick={() => onThemePreferenceChange("system")}
          />
        </div>
      </div>
    </ConfigurationSection>
  )
}

function EditableSection({
  children,
  dirty,
  disabled,
  onRevert,
  onSave,
  saving,
  title,
}: {
  children: ReactNode
  dirty: boolean
  disabled: boolean
  onRevert: () => void
  onSave: () => void
  saving: boolean
  title: string
}) {
  return (
    <div className="rounded-[8px] border border-border/60 bg-foreground/2 px-2.5 py-2">
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-foreground/75">
            {title}
          </div>
          <p className="mt-0.5 text-[11px] leading-4 text-foreground/40">
            {dirty
              ? "Unsaved project override changes."
              : "Project override is current."}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-foreground/35 hover:bg-foreground/6 hover:text-foreground/65"
          disabled={!dirty || disabled || saving}
          onClick={onRevert}
          aria-label={`Revert ${title}`}
          title="Revert"
        >
          <RotateCcw />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-border/60 bg-background/65 text-[11px] text-foreground/55 hover:bg-foreground/6 hover:text-foreground/75"
          disabled={!dirty || disabled || saving}
          onClick={onSave}
        >
          <Save data-icon="inline-start" />
          <span>{saving ? "Saving" : "Save"}</span>
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function FieldLabel({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-foreground/45">
        {label}
      </span>
      {children}
    </label>
  )
}

function SelectField<T extends string>({
  label,
  onChange,
  value,
  values,
}: {
  label: string
  onChange: (value: T) => void
  value: T
  values: Array<T>
}) {
  return (
    <FieldLabel label={label}>
      <Select
        aria-label={label}
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as T)}
        className={FIELD_CONTROL_CLASS}
        options={values.map((item) => ({ label: item, value: item }))}
      />
    </FieldLabel>
  )
}

function NumberField({
  label,
  min,
  onChange,
  value,
}: {
  label: string
  min: number
  onChange: (value: number) => void
  value: number
}) {
  return (
    <FieldLabel label={label}>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10)
          onChange(Number.isFinite(parsed) ? Math.max(min, parsed) : min)
        }}
        className={FIELD_CONTROL_CLASS}
      />
    </FieldLabel>
  )
}

function ToggleField({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex h-8 items-center justify-between gap-3 rounded-[7px] border border-border/50 bg-background/40 px-2">
      <span className="truncate text-[11px] font-medium text-foreground/60">
        {label}
      </span>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </label>
  )
}

function DefaultModelSummary({
  model,
  provider,
}: {
  model?: ConfigModelInfo
  provider?: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[7px] border border-border/50 bg-background/40 px-2 py-1.5">
      <Bot className="shrink-0 text-foreground/35" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium text-foreground/75">
          {model?.name ?? model?.modelId ?? "No default model"}
        </div>
        <p className="truncate text-[11px] leading-4 text-foreground/35">
          {provider && model
            ? `${provider} / ${model.modelId}`
            : "Choose a model from the managed list below."}
        </p>
      </div>
    </div>
  )
}

function ProviderManagementList({
  defaultProvider,
  onConnect,
  onDefault,
  onToggle,
  providers,
}: {
  defaultProvider?: string
  onConnect: (provider: string) => void
  onDefault: (provider: string) => void
  onToggle: (provider: string, enabled: boolean) => void
  providers: Array<ProviderSummary>
}) {
  if (providers.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] font-medium text-foreground/45">
        Providers
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {providers.map((provider) => {
          const active = provider.active > 0
          const isDefault = provider.provider === defaultProvider
          return (
            <div
              className="flex min-w-0 items-center gap-2 rounded-[7px] border border-border/50 bg-background/40 px-2 py-1.5"
              key={provider.provider}
            >
              <Switch
                aria-label={`Activate provider ${provider.provider}`}
                checked={active}
                onCheckedChange={(checked) =>
                  onToggle(provider.provider, checked)
                }
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[12px] font-medium text-foreground/70">
                    {provider.provider}
                  </span>
                  {isDefault ? <StatusPill>Default</StatusPill> : null}
                </div>
                <p className="truncate text-[11px] leading-4 text-foreground/35">
                  {provider.active} of {provider.total} active
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-foreground/40"
                onClick={() => onConnect(provider.provider)}
                title="Prepare custom model for this provider"
                aria-label={`Connect provider ${provider.provider}`}
              >
                <PlugZap />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-foreground/45"
                disabled={isDefault}
                onClick={() => onDefault(provider.provider)}
              >
                Use
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PathListField({
  addLabel,
  label,
  onChange,
  values,
}: {
  addLabel: string
  label: string
  onChange: (values: Array<string>) => void
  values: Array<string>
}) {
  return (
    <FieldLabel label={label}>
      <StringListEditor
        addLabel={addLabel}
        emptyLabel={`No ${label.toLowerCase()} configured.`}
        placeholder="../agent-workspace/pi/path"
        values={values}
        onChange={onChange}
      />
    </FieldLabel>
  )
}

function StringListEditor({
  addLabel,
  emptyLabel,
  onChange,
  placeholder,
  values,
}: {
  addLabel: string
  emptyLabel: string
  onChange: (values: Array<string>) => void
  placeholder?: string
  values: Array<string>
}) {
  const [newValue, setNewValue] = useState("")
  const rows = values.length > 0 ? values : []

  const updateRow = (index: number, value: string) => {
    const next = rows.map((item, itemIndex) =>
      itemIndex === index ? value : item
    )
    onChange(next)
  }

  const removeRow = (index: number) => {
    onChange(rows.filter((_, itemIndex) => itemIndex !== index))
  }

  const addRow = () => {
    const trimmed = newValue.trim()
    if (!trimmed) return
    onChange(addUnique(rows, trimmed))
    setNewValue("")
  }

  return (
    <div className="space-y-1.5">
      {rows.length > 0 ? (
        <div className="space-y-1">
          {rows.map((value, index) => (
            <div
              className="flex min-w-0 items-center gap-1 rounded-[7px] border border-border/50 bg-background/40 p-1"
              key={`${value}-${index}`}
            >
              <Input
                aria-label={`${addLabel} ${index + 1}`}
                value={value}
                onChange={(event) => updateRow(index, event.target.value)}
                className={cn(
                  FIELD_CONTROL_CLASS,
                  "h-7 border-transparent bg-transparent focus-visible:ring-0"
                )}
              />
              <Button
                type="button"
                aria-label={`Remove ${value || "row"}`}
                title="Remove"
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-foreground/35 hover:text-red-300"
                onClick={() => removeRow(index)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[7px] border border-dashed border-border/50 bg-background/30 px-2 py-2 text-[11px] leading-4 text-foreground/35">
          {emptyLabel}
        </div>
      )}
      <div className="flex min-w-0 items-center gap-1">
        <Input
          aria-label={addLabel}
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addRow()
            }
          }}
          placeholder={placeholder}
          className={FIELD_CONTROL_CLASS}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 border-border/60 bg-background/65 text-[11px] text-foreground/55"
          onClick={addRow}
          disabled={!newValue.trim()}
        >
          <Plus data-icon="inline-start" />
          Add
        </Button>
      </div>
    </div>
  )
}

function ModelActivationList({
  defaultModel,
  defaultProvider,
  enabledPatterns,
  filter,
  models,
  onDefault,
  onFilterChange,
  onProviderFilterChange,
  onSetAll,
  onToggle,
  onUseRecommended,
  providerFilter,
  providers,
}: {
  defaultModel?: string
  defaultProvider?: string
  enabledPatterns?: Array<string>
  filter: string
  models: Array<ConfigModelInfo>
  onDefault: (model: ConfigModelInfo) => void
  onFilterChange: (value: string) => void
  onProviderFilterChange: (value: string) => void
  onSetAll: (enabled: boolean) => void
  onToggle: (model: ConfigModelInfo, enabled: boolean) => void
  onUseRecommended: () => void
  providerFilter: string
  providers: Array<ProviderSummary>
}) {
  if (models.length === 0) return null

  const normalizedFilter = filter.trim().toLowerCase()
  const visibleModels = models.filter((model) => {
    const providerMatch =
      providerFilter === "all" || model.provider === providerFilter
    const textMatch =
      !normalizedFilter ||
      [model.name, model.modelId, model.provider, model.id]
        .join(" ")
        .toLowerCase()
        .includes(normalizedFilter)
    return providerMatch && textMatch
  })
  const activeCount = models.filter((model) =>
    isModelEnabled(model, enabledPatterns)
  ).length

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-foreground/45">
          Model activation
        </div>
        <StatusPill>
          {activeCount} / {models.length} active
        </StatusPill>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-1">
        <div className="relative min-w-0">
          <Search className="absolute top-2 left-2 text-foreground/25" />
          <Input
            aria-label="Search models"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder="Search model or provider"
            className={cn(FIELD_CONTROL_CLASS, "pl-7")}
          />
        </div>
        <Select
          aria-label="Filter provider"
          value={providerFilter}
          onValueChange={onProviderFilterChange}
          className={FIELD_CONTROL_CLASS}
          options={[
            { label: "All providers", value: "all" },
            ...providers.map((provider) => ({
              label: provider.provider,
              value: provider.provider,
            })),
          ]}
        />
      </div>
      <div className="grid grid-cols-3 gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-border/60 bg-background/65 text-[11px] text-foreground/55"
          onClick={() => onSetAll(true)}
        >
          <Power data-icon="inline-start" />
          All
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-border/60 bg-background/65 text-[11px] text-foreground/55"
          onClick={() => onSetAll(false)}
        >
          <PowerOff data-icon="inline-start" />
          None
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-border/60 bg-background/65 text-[11px] text-foreground/55"
          onClick={onUseRecommended}
        >
          <Check data-icon="inline-start" />
          Default
        </Button>
      </div>
      <div
        className="max-h-100 space-y-1 overflow-y-auto pr-1"
        data-testid="runtime-models-list"
      >
        {visibleModels.length === 0 ? (
          <div className="rounded-[7px] border border-dashed border-border/50 bg-background/30 px-2 py-2 text-[11px] leading-4 text-foreground/35">
            No models match this filter.
          </div>
        ) : null}
        {visibleModels.map((model) => {
          const active = isModelEnabled(model, enabledPatterns)
          const isDefault =
            model.provider === defaultProvider && model.modelId === defaultModel
          return (
            <div
              className="flex min-w-0 items-center gap-2 rounded-[7px] border border-border/50 bg-background/40 px-2 py-1.5"
              key={model.id}
            >
              <Switch
                aria-label={`Activate ${model.name}`}
                checked={active}
                onCheckedChange={(checked) => onToggle(model, checked)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[12px] font-medium text-foreground/70">
                    {model.name}
                  </span>
                  <StatusPill
                    className={
                      active
                        ? "bg-emerald-500/10 text-emerald-200"
                        : "bg-foreground/5 text-foreground/30"
                    }
                  >
                    {active ? "Active" : "Disabled"}
                  </StatusPill>
                  {isDefault ? <StatusPill>Default</StatusPill> : null}
                </div>
                <p className="truncate text-[11px] leading-4 text-foreground/35">
                  {model.provider} / {model.modelId}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 text-[11px] text-foreground/45"
                disabled={isDefault}
                onClick={() => onDefault(model)}
              >
                Use
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CustomModelEditor({
  model,
  onModelChange,
  onProviderChange,
  onUse,
  provider,
  providers,
}: {
  model: string
  onModelChange: (value: string) => void
  onProviderChange: (value: string) => void
  onUse: () => void
  provider: string
  providers: Array<string>
}) {
  return (
    <div className="rounded-[7px] border border-border/50 bg-background/40 p-2">
      <div className="mb-1.5 text-[11px] font-medium text-foreground/45">
        Connect custom provider/model
      </div>
      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto] gap-1">
        <Input
          aria-label="Custom provider"
          value={provider}
          onChange={(event) => onProviderChange(event.target.value)}
          className={FIELD_CONTROL_CLASS}
          placeholder="provider"
          list="pi-config-providers"
        />
        <datalist id="pi-config-providers">
          {providers.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <Input
          aria-label="Custom model"
          value={model}
          onChange={(event) => onModelChange(event.target.value)}
          placeholder="model-id"
          className={FIELD_CONTROL_CLASS}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-border/60 bg-background/65 text-[11px] text-foreground/55"
          onClick={onUse}
        >
          <Plus data-icon="inline-start" />
          Add
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-foreground/35">
        Provider credentials stay in environment or Pi auth storage; this adds
        the provider/model default for new requests.
      </p>
    </div>
  )
}

function InlineNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-[7px] border border-border/50 bg-background/40 px-2 py-1.5 text-[11px] leading-4 text-foreground/45">
      <Info className="mt-0.5 size-3 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function ConfigurationSection({
  children,
  icon: Icon,
  label,
}: {
  children: ReactNode
  icon: LucideIcon
  label: string
}) {
  return (
    <div className="py-1">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium tracking-normal text-foreground/35 uppercase">
        <Icon className="size-3" />
        <span>{label}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function ConfigurationRow({
  description,
  status,
  title,
}: {
  description: string
  status: string
  title: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[8px] border border-border/60 bg-foreground/2 px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[12px] font-medium text-foreground/75">
            {title}
          </span>
          <span className="shrink-0 rounded-lg bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/35">
            {status}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-foreground/40">
          {description}
        </p>
      </div>
    </div>
  )
}

function StatusPill({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-lg bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/35",
        className
      )}
    >
      {children}
    </span>
  )
}

function ThemeSegment({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? "outline" : "ghost"}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 min-w-0 flex-1 justify-center gap-1 rounded-[6px] border-transparent px-2 text-[11px] font-medium shadow-none",
        active
          ? "border-border/60 bg-background text-foreground/75"
          : "text-foreground/40 hover:bg-transparent hover:text-foreground/65"
      )}
    >
      {active ? (
        <Check data-icon="inline-start" />
      ) : (
        <Icon data-icon="inline-start" />
      )}
      <span className="truncate">{label}</span>
    </Button>
  )
}

function modelSettings(settings: ChatPiSettings): ChatPiSettingsUpdate {
  return {
    defaultProvider: settings.defaultProvider,
    defaultModel: settings.defaultModel,
    defaultThinkingLevel: settings.defaultThinkingLevel,
    enabledModels:
      settings.enabledModels === undefined
        ? null
        : sanitizeStringList(settings.enabledModels),
  }
}

function runtimeSettings(settings: ChatPiSettings): ChatPiSettingsUpdate {
  return {
    compaction: settings.compaction,
    retry: settings.retry,
    steeringMode: settings.steeringMode,
    followUpMode: settings.followUpMode,
    transport: settings.transport,
  }
}

function resourceSettings(settings: ChatPiSettings): ChatPiSettingsUpdate {
  return {
    packages: settings.packages,
    extensions: sanitizeStringList(settings.extensions),
    skills: sanitizeStringList(settings.skills),
    prompts: sanitizeStringList(settings.prompts),
    themes: sanitizeStringList(settings.themes),
    enableSkillCommands: settings.enableSkillCommands,
  }
}

function summarizeResources(resources: ChatResourcesResponse | null) {
  const catalog = resources
    ? [
        ...resources.skills,
        ...resources.prompts,
        ...resources.extensions,
        ...resources.packages,
        ...resources.themes,
        ...resources.agentsFiles,
      ]
    : []

  return {
    active: catalog.filter((item) => item.activationStatus === "active").length,
    staged: catalog.filter((item) => item.activationStatus === "staged").length,
    reloadRequired: catalog.filter(
      (item) => item.activationStatus === "reload-required"
    ).length,
    diagnostics: resources?.diagnostics ?? [],
    total: catalog.length,
  }
}

function formatPackageSourceRows(values: Array<ChatPackageSource>) {
  return values.map((item) =>
    typeof item === "string" ? item : JSON.stringify(item)
  )
}

function parsePackageSourceRows(rows: Array<string>): Array<ChatPackageSource> {
  return rows
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (!line.startsWith("{")) return line
      const parsed = JSON.parse(line) as unknown
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Package JSON entries must be objects.")
      }
      return parsed as Record<string, unknown>
    })
}

function addUnique(values: Array<string>, value: string) {
  return values.includes(value) ? values : [...values, value]
}

function sanitizeStringList(values: Array<string>) {
  return values.map((item) => item.trim()).filter(Boolean)
}

function recommendedModelPatterns(
  settings: Pick<ChatPiSettings, "defaultModel" | "defaultProvider">
) {
  return settings.defaultProvider && settings.defaultModel
    ? [modelPattern(settings.defaultProvider, settings.defaultModel)]
    : []
}

function summarizeProviders(
  models: Array<ConfigModelInfo>,
  enabledPatterns: Array<string> | undefined
): Array<ProviderSummary> {
  const providers = new Map<string, ProviderSummary>()
  for (const model of models) {
    const current = providers.get(model.provider) ?? {
      active: 0,
      available: 0,
      provider: model.provider,
      total: 0,
    }
    current.total += 1
    if (model.available !== false) current.available += 1
    if (isModelEnabled(model, enabledPatterns)) current.active += 1
    providers.set(model.provider, current)
  }
  return [...providers.values()].sort((left, right) =>
    left.provider.localeCompare(right.provider)
  )
}

function customModelKey(provider: string, model: string) {
  return `${provider}/${model}`
}

function isModelEnabled(
  model: ConfigModelInfo,
  patterns: Array<string> | undefined
) {
  if (patterns === undefined) return true
  if (patterns.length === 0) return false
  return patterns.some((pattern) => modelMatchesPattern(model, pattern))
}

function nextEnabledModelPatterns({
  currentPatterns,
  enabled,
  model,
  models,
}: {
  currentPatterns: Array<string> | undefined
  enabled: boolean
  model: ConfigModelInfo
  models: Array<ConfigModelInfo>
}) {
  if (currentPatterns === undefined && enabled) return undefined

  const current = currentPatterns ?? []
  const knownModelPatterns = new Set(
    models.map((item) => modelPatternFor(item))
  )
  const activeKnown = new Set(
    models
      .filter((item) => isModelEnabled(item, currentPatterns))
      .map((item) => modelPatternFor(item))
  )

  if (enabled) {
    activeKnown.add(modelPatternFor(model))
  } else {
    activeKnown.delete(modelPatternFor(model))
  }

  const preservedPatterns = current.filter((pattern) => {
    if (knownModelPatterns.has(pattern)) return false
    return enabled || !modelMatchesPattern(model, pattern)
  })
  const next = [...preservedPatterns, ...activeKnown]

  if (
    preservedPatterns.length === 0 &&
    models.every((item) => activeKnown.has(modelPatternFor(item)))
  ) {
    return undefined
  }

  return next
}

function nextProviderModelPatterns({
  currentPatterns,
  enabled,
  models,
  provider,
}: {
  currentPatterns: Array<string> | undefined
  enabled: boolean
  models: Array<ConfigModelInfo>
  provider: string
}) {
  if (currentPatterns === undefined && enabled) return undefined

  const providerModels = models.filter((model) => model.provider === provider)
  const providerPattern = `${provider}/*`
  if (enabled) {
    return addUnique(
      withoutProviderPatterns(currentPatterns ?? [], providerModels, provider),
      providerPattern
    )
  }

  const remainingActive = models
    .filter(
      (model) =>
        model.provider !== provider && isModelEnabled(model, currentPatterns)
    )
    .map((model) => modelPatternFor(model))
  const preserved = withoutProviderPatterns(
    currentPatterns ?? [],
    providerModels,
    provider
  )
  return [...preserved, ...remainingActive]
}

function withoutProviderPatterns(
  patterns: Array<string>,
  providerModels: Array<ConfigModelInfo>,
  provider: string
) {
  return patterns.filter((pattern) => {
    if (pattern === `${provider}/*`) return false
    return !providerModels.some((model) => modelMatchesPattern(model, pattern))
  })
}

function ensureModelEnabled(
  patterns: Array<string> | undefined,
  model: ConfigModelInfo
) {
  if (patterns === undefined) return undefined
  if (patterns.some((pattern) => modelMatchesPattern(model, pattern))) {
    return patterns
  }
  return addUnique(patterns, modelPatternFor(model))
}

function ensureModelPattern(
  patterns: Array<string> | undefined,
  provider: string,
  modelId: string
) {
  if (patterns === undefined) return undefined
  return addUnique(patterns, modelPattern(provider, modelId))
}

function modelMatchesPattern(model: ConfigModelInfo, pattern: string) {
  const normalizedPattern = stripThinkingLevel(pattern.trim()).toLowerCase()
  const candidates = [
    model.id,
    model.modelId,
    model.name,
    modelPatternFor(model),
  ].map((value) => value.toLowerCase())

  if (!hasGlobCharacters(normalizedPattern)) {
    return candidates.includes(normalizedPattern)
  }

  const matcher = new RegExp(
    `^${normalizedPattern
      .split("")
      .map((character) =>
        character === "*"
          ? ".*"
          : character === "?"
            ? "."
            : escapeRegExp(character)
      )
      .join("")}$`
  )
  return candidates.some((candidate) => matcher.test(candidate))
}

function modelPatternFor(model: ConfigModelInfo) {
  return modelPattern(model.provider, model.modelId)
}

function modelPattern(provider: string, modelId: string) {
  return `${provider}/${modelId}`
}

function stripThinkingLevel(pattern: string) {
  const separatorIndex = pattern.lastIndexOf(":")
  if (separatorIndex === -1) return pattern
  const suffix = pattern.slice(separatorIndex + 1)
  return THINKING_LEVELS.includes(suffix as ChatThinkingLevel)
    ? pattern.slice(0, separatorIndex)
    : pattern
}

function hasGlobCharacters(pattern: string) {
  return pattern.includes("*") || pattern.includes("?")
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}
