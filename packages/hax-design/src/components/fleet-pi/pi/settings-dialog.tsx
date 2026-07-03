import {  useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Cpu, HardDrive, Paintbrush, Settings } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../dialog"
import { ScrollArea } from "../../scroll-area"
import { cn } from "../../../lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../ui/breadcrumb"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../../ui/sidebar"

import { useRightPanelContext } from "../layout/right-panel-context"
import { PersonalizationSection } from "./config-panel/sections/personalization-section"
import { ProviderCredentialsSection } from "./config-panel/sections/provider-credentials-section"
import { ModelDefaultsSection } from "./config-panel/sections/model-defaults-section"
import { ResourcesSection } from "./config-panel/sections/resources-section"
import { SandboxProviderSection } from "./config-panel/sections/sandbox-provider-section"

import {
  customModelKey,
  ensureModelEnabled,
  ensureModelPattern,
  isModelEnabled,
  nextEnabledModelPatterns,
  nextProviderModelPatterns,
} from "./config-panel/shared/model-patterns"
import {
  formatPackageSourceRows,
  modelSettings,
  parsePackageSourceRows,
  recommendedModelPatterns,
  resourceSettings,
  sameJson,
  summarizeProviders,
  summarizeResources,
} from "./config-panel/shared/settings-mappers"
import type {ReactNode} from "react";
import type {
  ChatPiSettings,
  ChatPiSettingsUpdate,
} from "../../../lib/pi/chat-protocol"
import type { ConfigModelInfo } from "./config-panel/shared/types"

/**
 * Custom hook to encapsulate the settings dialog state logic, satisfying ESLint function line limits.
 */
function useSettingsForm() {
  const {
    isLoadingProviders,
    isUpdatingProvider,
    models,
    onThemePreferenceChange,
    onUpdateProvider,
    providers = [],
    resources,
    saveSettings,
    selectedModelKey,
    settings,
    settingsLoading,
    themePreference,
  } = useRightPanelContext()

  const [draft, setDraft] = useState<ChatPiSettings | null>(null)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [packageRows, setPackageRows] = useState<Array<string>>([])
  const [packageError, setPackageError] = useState<string | undefined>()
  const [customProvider, setCustomProvider] = useState("")
  const [customModel, setCustomModel] = useState("")
  const [modelFilter, setModelFilter] = useState("")
  const [providerFilter, setProviderFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("appearance")

  const resourceSummary = summarizeResources(resources)

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

  const resourceDirty =
    !!draft &&
    !!settings &&
    (!sameJson(resourceSettings(draft), resourceSettings(settings.effective)) ||
      !sameJson(
        packageRows.filter((row) => row.trim()),
        formatPackageSourceRows(settings.effective.packages)
      ))

  const hasUnsavedChanges = modelDirty || resourceDirty

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
    setDraft((current: ChatPiSettings | null) =>
      current ? updater(current) : current
    )
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

  return {
    isLoadingProviders,
    isUpdatingProvider,
    onThemePreferenceChange,
    onUpdateProvider,
    providers,
    settings,
    settingsLoading,
    themePreference,
    draft,
    savingSection,
    packageRows,
    setPackageRows,
    packageError,
    setPackageError,
    customProvider,
    setCustomProvider,
    customModel,
    setCustomModel,
    modelFilter,
    setModelFilter,
    providerFilter,
    setProviderFilter,
    activeTab,
    setActiveTab,
    resourceSummary,
    modelOptions,
    modelSelectValue,
    providerOptions,
    modelDirty,
    resourceDirty,
    updateDraft,
    handlePackageRowsChange,
    setModelEnabled,
    setProviderEnabled,
    setAllModelsEnabled,
    useRecommendedModels,
    useProviderAsDefault,
    useCustomModel,
    saveSection,
  }
}

type LucideIcon = typeof Cpu

function SidebarNavItem({
  active,
  onClick,
  icon: Icon,
  label,
  status,
}: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
  status: string
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        onClick={onClick}
        className="relative flex h-12 items-center justify-between gap-3 overflow-hidden px-3 py-1.5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/10 transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "bg-muted/40 text-muted-foreground group-hover/sidebar-menu-item:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
          </div>
          <div className="flex min-w-0 flex-col text-left">
            <span className="text-xs font-semibold tracking-wide">{label}</span>
            <span className="mt-0.5 truncate text-[10px] text-muted-foreground/75">
              {status}
            </span>
          </div>
        </div>
        {active && (
          <div className="absolute top-1/4 bottom-1/4 left-0 w-1 rounded-r bg-foreground" />
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function MobileTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
        active
          ? "bg-foreground font-bold text-background"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const {
    isLoadingProviders,
    isUpdatingProvider,
    onThemePreferenceChange,
    onUpdateProvider,
    providers,
    settings,
    settingsLoading,
    themePreference,
    draft,
    savingSection,
    packageRows,
    setPackageRows,
    packageError,
    setPackageError,
    customProvider,
    setCustomProvider,
    customModel,
    setCustomModel,
    modelFilter,
    setModelFilter,
    providerFilter,
    setProviderFilter,
    activeTab,
    setActiveTab,
    resourceSummary,
    modelOptions,
    modelSelectValue,
    providerOptions,
    modelDirty,
    resourceDirty,
    updateDraft,
    handlePackageRowsChange,
    setModelEnabled,
    setProviderEnabled,
    setAllModelsEnabled,
    useRecommendedModels,
    useProviderAsDefault,
    useCustomModel,
    saveSection,
  } = useSettingsForm()

  const formatThemeLabel = (theme: string) => {
    if (!theme) return "System preference"
    return theme.charAt(0).toUpperCase() + theme.slice(1) + " mode"
  }

  const daytonaProvider = providers.find((p) => p.id === "daytona")
  const daytonaTargetProvider = providers.find((p) => p.id === "daytona-target")
  const isSandboxConfigured =
    !!daytonaProvider?.isConfigured && !!daytonaTargetProvider?.isConfigured
  const sandboxStatus = isSandboxConfigured
    ? "Daytona Active"
    : "Not configured"

  const formatProviderName = (prov: string) => {
    if (!prov) return ""
    if (prov.toLowerCase() === "google") return "Google"
    if (prov.toLowerCase() === "anthropic") return "Anthropic"
    if (prov.toLowerCase() === "openai") return "OpenAI"
    return prov.charAt(0).toUpperCase() + prov.slice(1)
  }
  const currentProvider = draft?.defaultProvider ?? ""
  const currentModel = draft?.defaultModel ?? ""
  const truncateModel = (m: string) =>
    m.length > 18 ? m.substring(0, 16) + "..." : m
  const llmStatus = currentModel
    ? `${formatProviderName(currentProvider)}: ${truncateModel(currentModel)}`
    : "Not configured"

  const activeCount = resourceSummary.active
  const stagedCount = resourceSummary.staged
  const piHarnessStatus =
    stagedCount > 0
      ? `${activeCount} active (${stagedCount} staged)`
      : activeCount > 0
        ? `${activeCount} active skills`
        : "0 active skills"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[calc(100%-2rem)] overflow-hidden p-0 sm:max-w-[650px] md:h-[650px] md:max-h-[85vh] md:max-w-[760px] lg:max-w-[860px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>

        <SidebarProvider className="h-full items-start">
          {/* Left Sidebar */}
          <Sidebar
            collapsible="none"
            className="hidden h-full shrink-0 flex-col border-r border-border/40 bg-muted/20 md:flex md:w-[240px]"
          >
            <div className="flex h-14 shrink-0 items-center border-b border-border/40 p-4">
              <h2 className="text-sm font-semibold">Settings</h2>
            </div>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarNavItem
                      active={activeTab === "appearance"}
                      onClick={() => setActiveTab("appearance")}
                      icon={Paintbrush}
                      label="Appearance"
                      status={formatThemeLabel(themePreference)}
                    />
                    <SidebarNavItem
                      active={activeTab === "sandbox"}
                      onClick={() => setActiveTab("sandbox")}
                      icon={HardDrive}
                      label="Sandbox Provider"
                      status={sandboxStatus}
                    />
                    <SidebarNavItem
                      active={activeTab === "llm"}
                      onClick={() => setActiveTab("llm")}
                      icon={Cpu}
                      label="LLM Provider"
                      status={llmStatus}
                    />
                    <SidebarNavItem
                      active={activeTab === "pi-harness"}
                      onClick={() => setActiveTab("pi-harness")}
                      icon={Settings}
                      label="Pi Harness"
                      status={piHarnessStatus}
                    />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          {/* Main Content Pane */}
          <main className="flex h-full flex-1 flex-col overflow-hidden bg-background">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/10 bg-background px-6">
              <div className="flex flex-1 items-center justify-between">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {activeTab === "appearance" && "Appearance"}
                        {activeTab === "sandbox" && "Sandbox Provider"}
                        {activeTab === "llm" && "LLM Provider"}
                        {activeTab === "pi-harness" && "Pi Harness"}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            {/* Mobile Navigation Tabs */}
            <div className="flex shrink-0 scrollbar-none gap-2 overflow-x-auto border-b border-border/10 bg-muted/5 px-6 py-2.5 md:hidden">
              <MobileTabButton
                active={activeTab === "appearance"}
                onClick={() => setActiveTab("appearance")}
              >
                Appearance
              </MobileTabButton>
              <MobileTabButton
                active={activeTab === "sandbox"}
                onClick={() => setActiveTab("sandbox")}
              >
                Sandbox
              </MobileTabButton>
              <MobileTabButton
                active={activeTab === "llm"}
                onClick={() => setActiveTab("llm")}
              >
                LLM Provider
              </MobileTabButton>
              <MobileTabButton
                active={activeTab === "pi-harness"}
                onClick={() => setActiveTab("pi-harness")}
              >
                Pi Harness
              </MobileTabButton>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6">
                {activeTab === "appearance" && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h3 className="text-lg font-medium">Appearance</h3>
                      <p className="text-sm text-muted-foreground">
                        Customize the look and feel of the interface.
                      </p>
                    </div>
                    <PersonalizationSection
                      onThemePreferenceChange={onThemePreferenceChange}
                      themePreference={themePreference}
                    />
                  </div>
                )}

                {activeTab === "sandbox" && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h3 className="text-lg font-medium">Sandbox Provider</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure isolated execution environments.
                      </p>
                    </div>
                    <SandboxProviderSection
                      isLoading={isLoadingProviders ?? false}
                      isPending={isUpdatingProvider ?? false}
                      providers={providers}
                      onUpdateProvider={onUpdateProvider}
                    />
                  </div>
                )}

                {activeTab === "llm" && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h3 className="text-lg font-medium">LLM Provider</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage your AI models and API credentials.
                      </p>
                    </div>
                    <ProviderCredentialsSection
                      isLoading={isLoadingProviders ?? false}
                      isPending={isUpdatingProvider ?? false}
                      providers={providers}
                      onUpdateProvider={onUpdateProvider}
                    />
                    <div className="h-px bg-border/40" />
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
                          enabledModels: ensureModelEnabled(
                            current.enabledModels,
                            model
                          ),
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
                          defaultThinkingLevel:
                            settings.effective.defaultThinkingLevel,
                          enabledModels: settings.effective.enabledModels,
                        }))
                      }}
                      onSave={() =>
                        draft && saveSection("models", modelSettings(draft))
                      }
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
                  </div>
                )}

                {activeTab === "pi-harness" && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h3 className="text-lg font-medium">Pi Harness</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage skills and packages.
                      </p>
                    </div>
                    <ResourcesSection
                      draft={draft}
                      onEnableSkillCommandsChange={(enableSkillCommands) =>
                        updateDraft((current) => ({
                          ...current,
                          enableSkillCommands,
                        }))
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
                          enableSkillCommands:
                            settings.effective.enableSkillCommands,
                        }))
                        setPackageRows(
                          formatPackageSourceRows(settings.effective.packages)
                        )
                        setPackageError(undefined)
                      }}
                      onSave={() =>
                        draft &&
                        saveSection("resources", resourceSettings(draft))
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
                  </div>
                )}
              </div>
            </ScrollArea>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
