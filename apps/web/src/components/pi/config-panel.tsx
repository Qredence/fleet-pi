/* eslint-disable max-lines -- The configurations surface intentionally keeps closely related section editors together. */
/* eslint-disable max-lines-per-function -- The top-level panel coordinates shared dirty/revert/save state across sections. */
import {
  Activity,
  Bot,
  Brain,
  Cable,
  Check,
  Cpu,
  Eye,
  EyeOff,
  Info,
  Key,
  Loader2,
  Lock,
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
  Server,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Wind,
  Wrench,
  Zap,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Select } from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { Badge } from "@workspace/ui/components/badge"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
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
import { useChatProviders, useUpdateChatProvider } from "@/lib/pi/chat-queries"

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

      <ProviderCredentialsSection />

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
  const isQueueActive = queue.followUp.length + queue.steering.length > 0

  return (
    <ConfigurationSection icon={Activity} label="Runtime">
      <div className="space-y-2.5 rounded-[10px] border border-border/40 bg-background/30 p-3 shadow-lg backdrop-blur-md">
        {/* Info Header */}
        <div className="flex min-w-0 items-start gap-2">
          <div className="rounded-md border border-border/20 bg-foreground/5 p-1 text-foreground/50 shadow-sm">
            <Activity className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold tracking-wide text-foreground/80">
              System Core Telemetry
            </div>
            <p className="text-[10px] leading-relaxed text-foreground/45">
              Live observability monitors for active streaming controllers,
              prompts backlog, and workspace settings.
            </p>
          </div>
        </div>

        {/* 2x2 Telemetry Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Card 1: Request Status */}
          <div className="group flex flex-col rounded-[8px] border border-border/20 bg-foreground/[0.015] p-2 transition-all duration-200 hover:-translate-y-[1px] hover:border-border/45 hover:bg-foreground/[0.035] hover:shadow-sm">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold tracking-wide text-foreground/50 uppercase">
                Core Request
              </span>
              {runtimeStatus === "Streaming" ? (
                <Badge variant="default" className="gap-1.5 shadow-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-background opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-background"></span>
                  </span>
                  Streaming
                </Badge>
              ) : runtimeStatus === "Submitting" ? (
                <Badge variant="secondary" className="gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground"></span>
                  </span>
                  Submitting
                </Badge>
              ) : runtimeStatus === "Error" ? (
                <Badge variant="destructive">Error</Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-primary/20 bg-primary/10 text-primary"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary"></span>
                  </span>
                  Ready
                </Badge>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-foreground/40 transition-colors group-hover:text-foreground/60">
              {activityLabel ?? "Idle and waiting for the next prompt."}
            </p>
          </div>

          {/* Card 2: Prompt Queue */}
          <div className="group flex flex-col rounded-[8px] border border-border/20 bg-foreground/[0.015] p-2 transition-all duration-200 hover:-translate-y-[1px] hover:border-border/45 hover:bg-foreground/[0.035] hover:shadow-sm">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold tracking-wide text-foreground/50 uppercase">
                Prompts Queue
              </span>
              {isQueueActive ? (
                <Badge variant="secondary" className="gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground"></span>
                  </span>
                  Active ({queue.followUp.length + queue.steering.length})
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-transparent bg-foreground/5 text-foreground/50"
                >
                  Idle
                </Badge>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-foreground/40 transition-colors group-hover:text-foreground/60">
              {queueDescription}
            </p>
          </div>

          {/* Card 3: Plan State */}
          <div className="group flex flex-col rounded-[8px] border border-border/20 bg-foreground/[0.015] p-2 transition-all duration-200 hover:-translate-y-[1px] hover:border-border/45 hover:bg-foreground/[0.035] hover:shadow-sm">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold tracking-wide text-foreground/50 uppercase">
                Plan Context
              </span>
              {mode === "plan" ? (
                <Badge variant="default" className="gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-background opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-background"></span>
                  </span>
                  Planning
                </Badge>
              ) : mode === "harness" ? (
                <Badge
                  variant="outline"
                  className="border-primary/20 bg-primary/10 text-primary"
                >
                  Harness
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-transparent bg-foreground/5 text-foreground/50"
                >
                  Agent
                </Badge>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-foreground/40 transition-colors group-hover:text-foreground/60">
              {planLabel ??
                (mode === "plan"
                  ? "Planning Turn: Streaming steps proposal."
                  : mode === "harness"
                    ? "Harness Turn: Sandbox active."
                    : "Autonomous coding execution active.")}
            </p>
          </div>

          {/* Card 4: Settings Source */}
          <div className="group flex flex-col rounded-[8px] border border-border/20 bg-foreground/[0.015] p-2 transition-all duration-200 hover:-translate-y-[1px] hover:border-border/45 hover:bg-foreground/[0.035] hover:shadow-sm">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold tracking-wide text-foreground/50 uppercase">
                Settings Sync
              </span>
              {settingsError ? (
                <Badge variant="destructive">Error</Badge>
              ) : settingsLoading ? (
                <Badge variant="outline" className="gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading
                </Badge>
              ) : (
                <Badge variant="default" className="shadow-sm">
                  Synced
                </Badge>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-foreground/40 transition-colors group-hover:text-foreground/60">
              {settingsError
                ? settingsError.message
                : settings
                  ? `Active config loaded from ${settings.projectPath.replace(/^.*\/fleet-pi\//, "")}`
                  : "Resolving active project-scoped Pi properties..."}
            </p>
          </div>
        </div>
      </div>
    </ConfigurationSection>
  )
}

const PROVIDER_METADATA: Record<
  string,
  {
    icon: LucideIcon
    placeholder: string
    help: string
  }
> = {
  "amazon-bedrock": {
    icon: Server,
    placeholder: "Bedrock region (e.g. us-east-1)",
    help: "Amazon Bedrock reads AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION from your local shell or AWS configuration file.",
  },
  openai: {
    icon: Sparkles,
    placeholder: "sk-proj-...",
    help: "Stored securely in your root .env.local file. Overrides the active OPENAI_API_KEY environment variable.",
  },
  anthropic: {
    icon: Bot,
    placeholder: "sk-ant-...",
    help: "Stored securely in your root .env.local file. Overrides the active ANTHROPIC_API_KEY environment variable.",
  },
  "google-vertex": {
    icon: ShieldCheck,
    placeholder: "Path to service account JSON, or credentials text...",
    help: "Stored securely in your root .env.local file. Overrides the active GOOGLE_APPLICATION_CREDENTIALS environment variable.",
  },
  "google-genai": {
    icon: Brain,
    placeholder: "AIzaSy...",
    help: "Stored securely in your root .env.local file. Overrides the active GEMINI_API_KEY environment variable.",
  },
  mistral: {
    icon: Wind,
    placeholder: "Your Mistral API key...",
    help: "Stored securely in your root .env.local file. Overrides the active MISTRAL_API_KEY environment variable.",
  },
  groq: {
    icon: Zap,
    placeholder: "gsk_...",
    help: "Stored securely in your root .env.local file. Overrides the active GROQ_API_KEY environment variable.",
  },
  ollama: {
    icon: Cpu,
    placeholder: "http://localhost:11434 (default)",
    help: "Configure local Ollama execution endpoints. Overrides the active OLLAMA_BASE_URL environment variable.",
  },
}

function ProviderCredentialsSection() {
  const { data, isLoading } = useChatProviders()
  const { mutateAsync: updateProvider, isPending } = useUpdateChatProvider()
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "missing"
  >("all")

  const providers = data?.providers ?? []

  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.envVarName.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && p.isConfigured) ||
        (statusFilter === "missing" && !p.isConfigured)

      return matchesSearch && matchesStatus
    })
  }, [providers, searchQuery, statusFilter])

  const handleSave = async (providerId: string) => {
    if (!apiKey.trim()) return
    try {
      const result = await updateProvider({ providerId, apiKey: apiKey.trim() })
      if (result.reloadRequired) {
        toast.success(
          "Provider credentials saved. Reload the page to apply to active sessions.",
          {
            duration: 5000,
          }
        )
      } else {
        toast.success("Provider credentials updated successfully")
      }
      setEditingProvider(null)
      setApiKey("")
      setShowPassword(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update provider"
      )
    }
  }

  return (
    <ConfigurationSection icon={Key} label="Provider Credentials">
      <div className="space-y-3.5 rounded-[10px] border border-border/40 bg-background/30 p-3.5 shadow-lg backdrop-blur-md">
        {/* Info Header */}
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="shrink-0 rounded-md border border-border/20 bg-foreground/5 p-1 text-foreground/60 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <Lock className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold tracking-wide text-foreground/85">
              Credentials Vault
            </div>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-foreground/45">
              Securely store credentials in your local environment `.env.local`.
              Overrides apply instantly to the active workspace process.
            </p>
          </div>
        </div>

        {/* Search & Status Filters */}
        {!isLoading && providers.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border/15 bg-foreground/[0.015] p-2 shadow-inner">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3 w-3 text-foreground/30" />
              <Input
                type="text"
                placeholder="Search credentials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 w-full rounded-[6px] border-border/30 bg-background/40 pr-2 pl-7 text-[11px] transition-all duration-150 placeholder:text-foreground/20 focus-visible:border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/10"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "active", "missing"] as const).map((filter) => {
                const count = providers.filter((p) => {
                  if (filter === "all") return true
                  if (filter === "active") return p.isConfigured
                  return !p.isConfigured
                }).length

                return (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={cn(
                      "flex-1 cursor-pointer rounded-[5px] border py-1 text-[10px] font-medium capitalize transition-all duration-200",
                      statusFilter === filter
                        ? "border-border/30 bg-foreground/5 font-semibold text-foreground/80 shadow-sm"
                        : "border-transparent text-foreground/45 hover:bg-foreground/[0.01] hover:text-foreground/75"
                    )}
                  >
                    {filter}{" "}
                    <span className="font-normal opacity-55">({count})</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-[11px] text-foreground/40">
            <Loader2 className="h-3 w-3 animate-spin text-foreground/45" />
            <span>Decrypting providers...</span>
          </div>
        ) : providers.length === 0 ? (
          <p className="py-3 text-center text-[11.5px] text-foreground/40">
            No providers discovered.
          </p>
        ) : filteredProviders.length === 0 ? (
          <div className="py-4 text-center text-[11px] text-foreground/35">
            No matching providers found.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredProviders.map((p) => {
              const isEditing = editingProvider === p.id
              const meta = PROVIDER_METADATA[p.id] ?? {
                icon: Cpu,
                placeholder: "Enter credentials...",
                help: "Stored securely in your local environment overrides.",
              }
              const IconComponent = meta.icon

              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-col rounded-[10px] border border-border/30 bg-background/30 p-2.5 transition-all duration-300 hover:-translate-y-[1px] hover:border-border/45 hover:bg-foreground/[0.02] hover:shadow-sm",
                    isEditing &&
                      "translate-y-0 border-border/50 bg-foreground/[0.015] shadow-md sm:col-span-2",
                    p.isConfigured &&
                      !isEditing &&
                      "border-primary/30 shadow-[0_0_8px_rgba(0,0,0,0.05)]"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={cn(
                          "flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-[8px] border border-border/20 bg-background/50 transition-all duration-300",
                          p.isConfigured && "border-primary/20 bg-primary/5"
                        )}
                      >
                        <IconComponent
                          className={cn(
                            "h-4 w-4",
                            p.isConfigured
                              ? "text-primary"
                              : "text-foreground/35"
                          )}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[11.5px] leading-tight font-bold text-foreground/80">
                          {p.name}
                        </span>
                        <span className="mt-0.5 truncate font-mono text-[9.5px] text-foreground/35">
                          {p.envVarName}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {p.isConfigured ? (
                        <Badge variant="default" className="gap-1.5 shadow-sm">
                          <span className="relative flex h-1 w-1">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-background opacity-75"></span>
                            <span className="relative inline-flex h-1 w-1 rounded-full bg-background"></span>
                          </span>
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Missing</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-6 cursor-pointer rounded-[5px] px-2 text-[10px] text-foreground/50 transition-all duration-200 hover:bg-foreground/5 hover:text-foreground/80",
                          isEditing &&
                            "bg-foreground/5 font-semibold text-foreground/70"
                        )}
                        onClick={() => {
                          setEditingProvider(isEditing ? null : p.id)
                          setApiKey("")
                          setShowPassword(false)
                        }}
                      >
                        {isEditing
                          ? "Cancel"
                          : p.isConfigured
                            ? "Update"
                            : "Configure"}
                      </Button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-3 flex flex-col gap-2.5 border-t border-border/15 pt-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9.5px] font-bold tracking-wide text-foreground/45 uppercase">
                          {p.name} API Key / Config Value
                        </label>
                        <div className="relative flex items-center">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder={meta.placeholder}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className={cn(
                              FIELD_CONTROL_CLASS,
                              "w-full border-border/40 bg-background/50 pr-8 text-[11px] focus:border-border/80 focus-visible:ring-foreground/5 focus-visible:ring-offset-0"
                            )}
                          />
                          <button
                            type="button"
                            className="absolute right-2 cursor-pointer text-foreground/35 transition-colors duration-150 hover:text-foreground/60"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <Alert variant="default" className="px-3 py-2.5">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="mt-0 text-[10px] leading-relaxed text-foreground/60">
                          {meta.help}
                        </AlertDescription>
                      </Alert>

                      <div className="mt-1 flex items-center justify-end gap-1.5 border-t border-border/10 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 cursor-pointer rounded-[6px] px-2.5 text-[10px] text-foreground/40 hover:text-foreground/75"
                          onClick={() => {
                            setEditingProvider(null)
                            setApiKey("")
                            setShowPassword(false)
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className={cn(
                            "h-7 cursor-pointer rounded-[6px] bg-foreground px-3 text-[10px] font-bold text-background transition-all duration-150 hover:bg-foreground/90 disabled:opacity-50",
                            "shadow-sm active:scale-95"
                          )}
                          disabled={isPending || !apiKey.trim()}
                          onClick={() => handleSave(p.id)}
                        >
                          {isPending ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Saving
                            </span>
                          ) : (
                            "Save Key"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
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
  const haloColor =
    themePreference === "light"
      ? "shadow-[0_0_15px_rgba(245,158,11,0.08)] border-amber-500/10"
      : themePreference === "dark"
        ? "shadow-[0_0_15px_rgba(139,92,246,0.08)] border-violet-500/10"
        : "shadow-[0_0_15px_rgba(100,116,139,0.08)] border-slate-500/10"

  return (
    <ConfigurationSection icon={Palette} label="Personalization">
      <div
        className={cn(
          "space-y-3 rounded-[10px] border border-border/30 bg-background/30 p-3.5 shadow-md backdrop-blur-md transition-all duration-300",
          haloColor
        )}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="shrink-0 rounded-md border border-border/20 bg-foreground/5 p-1 text-foreground/50 shadow-sm">
            <Palette className="h-3.5 w-3.5 text-foreground/60" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold tracking-wide text-foreground/80">
              Interface Customization
            </div>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-foreground/45">
              Personalize theme preference settings. System preference
              coordinates with host browser rendering.
            </p>
          </div>
        </div>

        <div className="relative flex rounded-[8px] border border-border/10 bg-foreground/5 p-0.5">
          <ThemeSegment
            active={themePreference === "light"}
            icon={Sun}
            label="Light"
            activeGlow="border-primary/20 bg-background text-primary shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            onClick={() => onThemePreferenceChange("light")}
          />
          <ThemeSegment
            active={themePreference === "dark"}
            icon={Moon}
            label="Dark"
            activeGlow="border-primary/20 bg-background text-primary shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            onClick={() => onThemePreferenceChange("dark")}
          />
          <ThemeSegment
            active={themePreference === "system"}
            icon={Monitor}
            label="System"
            activeGlow="border-primary/20 bg-background text-primary shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            onClick={() => onThemePreferenceChange("system")}
          />
        </div>
      </div>
    </ConfigurationSection>
  )
}

function ThemeSegment({
  active,
  icon: Icon,
  label,
  activeGlow,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  activeGlow: string
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
        "h-7 min-w-0 flex-1 cursor-pointer justify-center gap-1.5 rounded-[6px] border-transparent px-2 text-[10.5px] font-bold shadow-none transition-all duration-300",
        active
          ? activeGlow
          : "text-foreground/40 hover:bg-transparent hover:text-foreground/65"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Button>
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
    <div
      className={cn(
        "space-y-3.5 rounded-[10px] border border-border/30 bg-background/30 p-3.5 shadow-md backdrop-blur-md transition-all duration-300",
        dirty && "border-primary/30 shadow-[0_0_12px_rgba(0,0,0,0.05)]"
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5 border-b border-border/10 pb-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold tracking-wide text-foreground/80">
            {title}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {dirty ? (
              <Badge variant="secondary" className="gap-1.5 shadow-sm">
                <span className="relative flex h-1 w-1">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-75"></span>
                  <span className="relative inline-flex h-1 w-1 rounded-full bg-foreground"></span>
                </span>
                Unsaved changes
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-primary/20 bg-primary/10 text-primary"
              >
                <Check className="h-2 w-2" />
                In sync
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-7 w-7 cursor-pointer rounded-[6px] p-0 text-foreground/35 transition-all duration-150 hover:bg-foreground/5 hover:text-foreground/65 disabled:opacity-35",
              !dirty && "hidden"
            )}
            disabled={!dirty || disabled || saving}
            onClick={onRevert}
            aria-label={`Revert ${title}`}
            title="Revert changes"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-7 cursor-pointer rounded-[6px] border-border/45 bg-background/50 px-2.5 text-[10px] font-bold text-foreground/60 shadow-sm transition-all duration-200 hover:bg-foreground/5 hover:text-foreground/80 disabled:opacity-40",
              dirty &&
                "border-primary/30 text-primary shadow-sm hover:bg-primary/5 hover:text-primary/90 active:scale-95"
            )}
            disabled={!dirty || disabled || saving}
            onClick={onSave}
          >
            {saving ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin text-foreground/50" />
                Saving
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Save className="h-3 w-3" />
                Commit
              </span>
            )}
          </Button>
        </div>
      </div>
      <div className="space-y-3.5">{children}</div>
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
      <span className="text-[10px] font-bold tracking-wide text-foreground/45 uppercase">
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
    <label className="flex h-8.5 cursor-pointer items-center justify-between gap-3 rounded-[8px] border border-border/30 bg-background/40 px-2.5 transition-all duration-200 hover:border-border/45 hover:bg-foreground/[0.015]">
      <span className="truncate text-[11px] font-semibold text-foreground/65">
        {label}
      </span>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="scale-90"
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
  const meta = provider ? PROVIDER_METADATA[provider] : null
  const IconComponent = meta?.icon ?? Bot
  const hasReasoning = model?.reasoning === true

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[10px] border border-border/30 bg-gradient-to-br from-background/95 via-foreground/[0.005] to-foreground/[0.03] p-2.5 shadow-md transition-all duration-300 hover:border-border/45">
      {/* Dynamic Brand Processor Container */}
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-300",
          "border-primary/20 bg-primary/5 shadow-[0_0_8px_rgba(0,0,0,0.05)]"
        )}
      >
        <IconComponent
          className={cn("h-4.5 w-4.5 animate-pulse", "text-primary")}
        />
      </div>

      {/* Model Information */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-bold tracking-wide text-foreground/85">
          {model?.name ?? model?.modelId ?? "No active default model"}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="truncate font-mono text-[9.5px] font-semibold tracking-tight text-foreground/40">
            {provider && model
              ? `${provider}/${model.modelId}`
              : "Choose a default model below"}
          </span>
          {hasReasoning && (
            <Badge
              variant="secondary"
              className="gap-0.5 shadow-[0_0_6px_rgba(0,0,0,0.05)]"
            >
              Reasoning
            </Badge>
          )}
          {model?.available !== false && (
            <Badge
              variant="outline"
              className="gap-0.5 border-primary/20 bg-primary/10 text-primary"
            >
              Stream
            </Badge>
          )}
        </div>
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
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-bold tracking-wide text-foreground/45 uppercase">
        Providers Network
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((provider) => {
          const active = provider.active > 0
          const isDefault = provider.provider === defaultProvider
          const meta = PROVIDER_METADATA[provider.provider] ?? {
            icon: Cpu,
          }
          const IconComponent = meta.icon

          return (
            <div
              key={provider.provider}
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-[8px] border border-border/30 bg-background/30 p-2 transition-all duration-300 hover:-translate-y-[1px] hover:border-border/45 hover:bg-foreground/[0.02] hover:shadow-sm",
                isDefault && "border-primary/30 bg-primary/[0.015] shadow-sm"
              )}
            >
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  aria-label={`Activate provider ${provider.provider}`}
                  checked={active}
                  onCheckedChange={(checked) =>
                    onToggle(provider.provider, checked)
                  }
                  className="scale-90"
                />
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-[6px] border border-border/20 bg-background/50 text-foreground/50 transition-all duration-300",
                    active && "border-primary/20 bg-primary/5"
                  )}
                >
                  <IconComponent
                    className={cn(
                      "h-3.5 w-3.5",
                      active ? "text-primary" : "text-foreground/35"
                    )}
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[11.5px] leading-none font-semibold text-foreground/75">
                    {provider.provider}
                  </span>
                  {isDefault && (
                    <Badge variant="default" className="shadow-sm">
                      Default
                    </Badge>
                  )}
                </div>
                <p className="mt-1 truncate text-[9.5px] leading-none text-foreground/40">
                  {provider.active} / {provider.total} active
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 w-6 rounded-[5px] text-foreground/35 transition-all duration-200 hover:bg-foreground/5 hover:text-foreground/60"
                  onClick={() => onConnect(provider.provider)}
                  title="Prepare custom model for this provider"
                  aria-label={`Connect provider ${provider.provider}`}
                >
                  <PlugZap className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 rounded-[5px] px-2 text-[10px] text-foreground/45 transition-all duration-200 hover:bg-foreground/5 hover:text-foreground/75",
                    isDefault && "cursor-not-allowed opacity-30"
                  )}
                  disabled={isDefault}
                  onClick={() => onDefault(provider.provider)}
                >
                  Use
                </Button>
              </div>
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
    <div className="space-y-2">
      {rows.length > 0 ? (
        <div className="space-y-1.5 rounded-lg border border-border/20 bg-background/15 p-2">
          {rows.map((value, index) => (
            <div
              key={`${value}-${index}`}
              className="group flex min-w-0 items-center gap-1.5 rounded-md border border-border/20 bg-background/40 px-2 py-0.5 shadow-sm transition-all duration-200 hover:border-border/30 hover:bg-background/55"
            >
              <Input
                aria-label={`${addLabel} ${index + 1}`}
                value={value}
                onChange={(event) => updateRow(index, event.target.value)}
                className={cn(
                  FIELD_CONTROL_CLASS,
                  "h-7 flex-1 border-transparent bg-transparent px-1 text-[11px] leading-none font-medium text-foreground/75 focus-visible:border-transparent focus-visible:ring-0"
                )}
              />
              <button
                type="button"
                aria-label={`Remove ${value || "row"}`}
                title="Remove"
                className="flex h-5.5 w-5.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground/30 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 hover:shadow-[0_0_6px_rgba(239,68,68,0.2)]"
                onClick={() => removeRow(index)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[8px] border border-dashed border-border/25 bg-background/10 px-3 py-3 text-center text-[11px] leading-relaxed font-medium text-foreground/35">
          {emptyLabel}
        </div>
      )}
      <div className="flex min-w-0 items-center gap-1.5">
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
          className="h-8 shrink-0 cursor-pointer rounded-[7px] border-border/45 bg-background/65 text-[11px] font-semibold text-foreground/75 shadow-sm transition-all duration-150 hover:bg-foreground/5 disabled:opacity-50"
          onClick={addRow}
          disabled={!newValue.trim()}
        >
          <Plus className="mr-1 h-3.5 w-3.5 text-foreground/60" />
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
    <div className="flex flex-col gap-2.5">
      {/* Header and Pill */}
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border/10 pb-1.5">
        <div className="text-[11px] font-bold tracking-wide text-foreground/45 uppercase">
          Model Routing Registry
        </div>
        <Badge variant="default" className="shadow-sm">
          {activeCount} / {models.length} Activated
        </Badge>
      </div>

      {/* Toolbar Search + Filter */}
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-1.5 rounded-lg border border-border/15 bg-foreground/[0.015] p-1 shadow-inner">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 h-3 w-3 text-foreground/30" />
          <Input
            aria-label="Search models"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder="Search model ID or brand..."
            className={cn(FIELD_CONTROL_CLASS, "w-full pl-7.5")}
          />
        </div>
        <Select
          aria-label="Filter provider"
          value={providerFilter}
          onValueChange={onProviderFilterChange}
          className={FIELD_CONTROL_CLASS}
          options={[
            { label: "All Providers", value: "all" },
            ...providers.map((p) => ({
              label: p.provider,
              value: p.provider,
            })),
          ]}
        />
      </div>

      {/* Action Pills */}
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7.5 cursor-pointer rounded-[6px] border-border/35 bg-background/40 text-[10.5px] font-semibold text-foreground/60 transition-all duration-150 hover:bg-foreground/5"
          onClick={() => onSetAll(true)}
        >
          <Power className="mr-1.5 h-3 w-3 text-foreground/45" />
          Enable All
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7.5 cursor-pointer rounded-[6px] border-border/35 bg-background/40 text-[10.5px] font-semibold text-foreground/60 transition-all duration-150 hover:bg-foreground/5"
          onClick={() => onSetAll(false)}
        >
          <PowerOff className="mr-1.5 h-3 w-3 text-foreground/45" />
          Disable All
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7.5 cursor-pointer rounded-[6px] border-border/35 bg-background/40 text-[10.5px] font-semibold text-foreground/60 transition-all duration-150 hover:bg-foreground/5"
          onClick={onUseRecommended}
        >
          <Check className="mr-1.5 h-3 w-3 text-foreground/45" />
          Recommended
        </Button>
      </div>

      {/* Scrollable Model List */}
      <div
        className="max-h-80 scrollbar-thin scrollbar-thumb-foreground/10 space-y-1.5 overflow-y-auto pr-1"
        data-testid="runtime-models-list"
      >
        {visibleModels.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-border/25 bg-background/10 px-3 py-4 text-center text-[11px] leading-relaxed text-foreground/35">
            No models found matching the search criteria.
          </div>
        ) : null}
        {visibleModels.map((model) => {
          const active = isModelEnabled(model, enabledPatterns)
          const isDefault =
            model.provider === defaultProvider && model.modelId === defaultModel

          return (
            <div
              key={model.id}
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-[8px] border border-border/25 bg-background/40 px-2.5 py-2 transition-all duration-200 hover:translate-x-[2px] hover:border-border/45 hover:bg-foreground/[0.025]",
                isDefault && "border-blue-500/25 bg-blue-500/[0.01]"
              )}
            >
              <Switch
                aria-label={`Activate ${model.name}`}
                checked={active}
                onCheckedChange={(checked) => onToggle(model, checked)}
                className="scale-90"
              />

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[11.5px] leading-tight font-bold text-foreground/75">
                    {model.name}
                  </span>
                  {isDefault && (
                    <Badge variant="default" className="shadow-sm">
                      Default
                    </Badge>
                  )}
                  {model.reasoning && (
                    <Badge variant="secondary" className="gap-0.5 shadow-sm">
                      Reason
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate font-mono text-[10px] leading-none tracking-tight text-foreground/40">
                  <span className={cn("font-semibold", "text-primary/70")}>
                    {model.provider}
                  </span>{" "}
                  / {model.modelId}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6.5 shrink-0 rounded-[5px] px-2 text-[10px] text-foreground/45 transition-all duration-250 hover:bg-foreground/5 hover:text-foreground/75",
                  isDefault && "cursor-not-allowed opacity-30"
                )}
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
    <div className="space-y-2.5 rounded-[10px] border border-border/30 bg-background/30 p-3.5 shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        <Wrench className="h-3.5 w-3.5 text-foreground/50" />
        <span className="text-[11.5px] font-semibold tracking-wide text-foreground/75">
          Connect Custom Endpoint
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto] items-end gap-1.5">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-medium tracking-wider text-foreground/45 uppercase">
            Provider
          </label>
          <Input
            aria-label="Custom provider"
            value={provider}
            onChange={(event) => onProviderChange(event.target.value)}
            className={FIELD_CONTROL_CLASS}
            placeholder="e.g. openrouter"
            list="pi-config-providers"
          />
          <datalist id="pi-config-providers">
            {providers.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-medium tracking-wider text-foreground/45 uppercase">
            Model Identifier
          </label>
          <Input
            aria-label="Custom model"
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            placeholder="e.g. deepseek/deepseek-chat"
            className={FIELD_CONTROL_CLASS}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 cursor-pointer rounded-[7px] border-border/45 bg-background/65 text-[11px] font-semibold text-foreground/75 shadow-sm transition-all duration-200 hover:bg-foreground/5 disabled:opacity-50"
          onClick={onUse}
          disabled={!provider.trim() || !model.trim()}
        >
          <Plus className="mr-1 h-3.5 w-3.5 text-foreground/60" />
          Connect
        </Button>
      </div>
      <div className="flex items-start gap-1.5 rounded border border-border/10 bg-foreground/[0.015] p-2 text-[9.5px] leading-normal text-foreground/45">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/35" />
        <span>
          Local or self-hosted endpoint configurations. Valid model patterns are
          resolved automatically to instantiate a project-scoped session.
        </span>
      </div>
    </div>
  )
}

function InlineNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[8px] border border-border/15 bg-foreground/[0.015] p-2.5 text-[10px] leading-normal text-foreground/50">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/40" />
      <span className="font-medium">{children}</span>
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
