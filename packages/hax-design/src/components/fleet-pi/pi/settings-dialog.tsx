import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Cpu,
  HardDrive,
  KeyRound,
  Paintbrush,
  Settings,
  Sparkles,
} from "lucide-react"

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
  nextEnabledModelPatterns,
} from "./config-panel/shared/model-patterns"
import {
  formatPackageSourceRows,
  modelSettings,
  parsePackageSourceRows,
  resourceSettings,
  sameJson,
  summarizeResources,
} from "./config-panel/shared/settings-mappers"
import type { ReactNode } from "react"
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
    settings,
    settingsLoading,
    themePreference,
  } = useRightPanelContext()

  const [draft, setDraft] = useState<ChatPiSettings | null>(null)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [packageRows, setPackageRows] = useState<Array<string>>([])
  const [packageError, setPackageError] = useState<string | undefined>()
  const [modelFilter, setModelFilter] = useState("")
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

    if (draft && hasUnsavedChanges) return
    if (
      draft &&
      sameJson(draft, nextDraft) &&
      sameJson(packageRows, nextPackageRows) &&
      packageError === undefined
    ) {
      return
    }

    setDraft(nextDraft)
    setPackageRows(nextPackageRows)
    setPackageError(undefined)
  }, [draft, hasUnsavedChanges, packageError, packageRows, settings])

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
    resources,
    settings,
    settingsLoading,
    themePreference,
    draft,
    savingSection,
    packageRows,
    setPackageRows,
    packageError,
    setPackageError,
    modelFilter,
    setModelFilter,
    activeTab,
    setActiveTab,
    resourceSummary,
    modelOptions,
    modelDirty,
    resourceDirty,
    updateDraft,
    handlePackageRowsChange,
    setModelEnabled,
    saveSection,
  }
}

type LucideIcon = typeof Cpu

function SidebarNavItem({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} onClick={onClick}>
        <Icon />
        <span>{label}</span>
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
        "relative rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-[background-color,color,transform] duration-150 after:absolute after:inset-x-0 after:-top-1 after:-bottom-1 active:scale-[0.96]",
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
  initialTab,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, selects this nav tab each time the dialog opens. */
  initialTab?: string
}) {
  const {
    isLoadingProviders,
    isUpdatingProvider,
    onThemePreferenceChange,
    onUpdateProvider,
    providers,
    resources,
    settings,
    settingsLoading,
    themePreference,
    draft,
    savingSection,
    packageRows,
    setPackageRows,
    packageError,
    setPackageError,
    modelFilter,
    setModelFilter,
    activeTab,
    setActiveTab,
    resourceSummary,
    modelOptions,
    modelDirty,
    resourceDirty,
    updateDraft,
    handlePackageRowsChange,
    setModelEnabled,
    saveSection,
  } = useSettingsForm()

  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (open && !wasOpenRef.current && initialTab) {
      setActiveTab(initialTab)
    }
    wasOpenRef.current = open
  }, [initialTab, open, setActiveTab])

  const resourcesPane = (scope: "skills" | "harness") => (
    <ResourcesSection
      scope={scope}
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
          enableSkillCommands: settings.effective.enableSkillCommands,
        }))
        setPackageRows(formatPackageSourceRows(settings.effective.packages))
        setPackageError(undefined)
      }}
      onSave={() => draft && saveSection("resources", resourceSettings(draft))}
      onSkillsChange={(skills) =>
        updateDraft((current) => ({ ...current, skills }))
      }
      onThemesChange={(themes) =>
        updateDraft((current) => ({ ...current, themes }))
      }
      packageError={packageError}
      packageRows={packageRows}
      resourceDirty={resourceDirty}
      resources={resources}
      resourceSummary={resourceSummary}
      saving={savingSection === "resources"}
      settingsLoading={settingsLoading}
    />
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[calc(100%-2rem)] overflow-hidden p-0 sm:max-w-[650px] md:h-[650px] md:max-h-[85vh] md:max-w-[760px] lg:max-w-[860px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>

        <SidebarProvider className="h-full min-h-0">
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
                    />
                    <SidebarNavItem
                      active={activeTab === "sandbox"}
                      onClick={() => setActiveTab("sandbox")}
                      icon={HardDrive}
                      label="Sandbox"
                    />
                    <SidebarNavItem
                      active={activeTab === "providers"}
                      onClick={() => setActiveTab("providers")}
                      icon={KeyRound}
                      label="Providers"
                    />
                    <SidebarNavItem
                      active={activeTab === "llm-models"}
                      onClick={() => setActiveTab("llm-models")}
                      icon={Cpu}
                      label="LLM Models"
                    />
                    <SidebarNavItem
                      active={activeTab === "skills"}
                      onClick={() => setActiveTab("skills")}
                      icon={Sparkles}
                      label="Skills"
                    />
                    <SidebarNavItem
                      active={activeTab === "pi-harness"}
                      onClick={() => setActiveTab("pi-harness")}
                      icon={Settings}
                      label="Pi Harness"
                    />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          {/* Main Content Pane */}
          <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
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
                        {activeTab === "sandbox" && "Sandbox"}
                        {activeTab === "providers" && "Providers"}
                        {activeTab === "llm-models" && "LLM Models"}
                        {activeTab === "skills" && "Skills"}
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
                active={activeTab === "providers"}
                onClick={() => setActiveTab("providers")}
              >
                Providers
              </MobileTabButton>
              <MobileTabButton
                active={activeTab === "llm-models"}
                onClick={() => setActiveTab("llm-models")}
              >
                LLM Models
              </MobileTabButton>
              <MobileTabButton
                active={activeTab === "skills"}
                onClick={() => setActiveTab("skills")}
              >
                Skills
              </MobileTabButton>
              <MobileTabButton
                active={activeTab === "pi-harness"}
                onClick={() => setActiveTab("pi-harness")}
              >
                Pi Harness
              </MobileTabButton>
            </div>

            <ScrollArea className="min-h-0 flex-1">
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
                  <SandboxProviderSection
                    isLoading={isLoadingProviders ?? false}
                    isPending={isUpdatingProvider ?? false}
                    providers={providers}
                    onUpdateProvider={onUpdateProvider}
                  />
                )}

                {activeTab === "providers" && (
                  <ProviderCredentialsSection
                    isLoading={isLoadingProviders ?? false}
                    isPending={isUpdatingProvider ?? false}
                    providers={providers}
                    onUpdateProvider={onUpdateProvider}
                  />
                )}

                {activeTab === "llm-models" && (
                  <ModelDefaultsSection
                    draft={draft}
                    modelDirty={modelDirty}
                    modelFilter={modelFilter}
                    modelOptions={modelOptions}
                    onModelFilterChange={setModelFilter}
                    onModelToggle={setModelEnabled}
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
                    saving={savingSection === "models"}
                    settingsLoading={settingsLoading}
                  />
                )}

                {activeTab === "skills" && resourcesPane("skills")}

                {activeTab === "pi-harness" && resourcesPane("harness")}
              </div>
            </ScrollArea>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
