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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "../../alert-dialog"
import { ScrollArea } from "../../scroll-area"
import {
  Breadcrumb,
  BreadcrumbItem,
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
import { DiscreteTabs } from "../primitives/discrete-tab"
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

type LucideIcon = typeof Cpu

type SettingsSectionId =
  | "appearance"
  | "sandbox"
  | "providers"
  | "llm-models"
  | "skills"
  | "pi-harness"

type SettingsSection = {
  id: SettingsSectionId
  title: string
  icon: LucideIcon
}

const SETTINGS_SECTIONS: Array<SettingsSection> = [
  { id: "appearance", title: "Appearance", icon: Paintbrush },
  { id: "sandbox", title: "Sandbox", icon: HardDrive },
  { id: "providers", title: "Providers", icon: KeyRound },
  { id: "llm-models", title: "LLM Models", icon: Cpu },
  { id: "skills", title: "Skills", icon: Sparkles },
  { id: "pi-harness", title: "Pi Harness", icon: Settings },
]

function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value)
}

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
  const [activeTab, setActiveTab] = useState<SettingsSectionId>("appearance")

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

  const resetDraft = () => {
    if (!settings) return
    const nextDraft = settings.effective
    setDraft(nextDraft)
    setPackageRows(formatPackageSourceRows(nextDraft.packages))
    setPackageError(undefined)
  }

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
    hasUnsavedChanges,
    resetDraft,
    updateDraft,
    handlePackageRowsChange,
    setModelEnabled,
    saveSection,
  }
}

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

export function SettingsDialog({
  open,
  onOpenChange,
  initialTab,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, selects this nav tab each time the dialog opens. */
  initialTab?: SettingsSectionId
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
    hasUnsavedChanges,
    resetDraft,
    updateDraft,
    handlePackageRowsChange,
    setModelEnabled,
    saveSection,
  } = useSettingsForm()

  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const activeSection =
    SETTINGS_SECTIONS.find((section) => section.id === activeTab) ??
    SETTINGS_SECTIONS[0]

  const handleOpenChange = (
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) => {
    if (!nextOpen && hasUnsavedChanges) {
      eventDetails?.cancel()
      setDiscardDialogOpen(true)
      return
    }

    onOpenChange(nextOpen)
  }

  const handleDiscardChanges = () => {
    resetDraft()
    setDiscardDialogOpen(false)
    onOpenChange(false)
  }

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

  const panes: Record<SettingsSectionId, () => ReactNode> = {
    appearance: () => (
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
    ),
    sandbox: () => (
      <SandboxProviderSection
        isLoading={isLoadingProviders ?? false}
        isPending={isUpdatingProvider ?? false}
        providers={providers}
        onUpdateProvider={onUpdateProvider}
      />
    ),
    providers: () => (
      <ProviderCredentialsSection
        isLoading={isLoadingProviders ?? false}
        isPending={isUpdatingProvider ?? false}
        providers={providers}
        onUpdateProvider={onUpdateProvider}
      />
    ),
    "llm-models": () => (
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
            defaultThinkingLevel: settings.effective.defaultThinkingLevel,
            enabledModels: settings.effective.enabledModels,
          }))
        }}
        onSave={() => draft && saveSection("models", modelSettings(draft))}
        saving={savingSection === "models"}
        settingsLoading={settingsLoading}
      />
    ),
    skills: () => resourcesPane("skills"),
    "pi-harness": () => resourcesPane("harness"),
  }

  return (
    // Nest AlertDialog under Dialog.Root so Base UI tracks nested open
    // dialogs (Esc / isTopmost). Sibling roots fight Esc and re-prompt.
    <Dialog
      open={open}
      onOpenChange={(nextOpen, eventDetails) =>
        handleOpenChange(nextOpen, eventDetails)
      }
    >
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
                    {SETTINGS_SECTIONS.map((section) => (
                      <SidebarNavItem
                        key={section.id}
                        active={activeTab === section.id}
                        onClick={() => setActiveTab(section.id)}
                        icon={section.icon}
                        label={section.title}
                      />
                    ))}
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
                      Settings
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{activeSection.title}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            <div className="flex min-w-0 shrink-0 overflow-x-auto overscroll-x-contain border-b border-border/10 bg-muted/5 px-4 py-2.5 md:hidden">
              <DiscreteTabs
                aria-label="Settings sections"
                className="min-w-max"
                size="compact"
                tabs={SETTINGS_SECTIONS}
                value={activeTab}
                onValueChange={(next) => {
                  if (isSettingsSectionId(next)) setActiveTab(next)
                }}
              />
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-label={activeSection.title}
                tabIndex={0}
                className="p-6 outline-none"
              >
                {panes[activeTab]()}
              </div>
            </ScrollArea>
          </main>
        </SidebarProvider>
      </DialogContent>

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <div className="flex flex-col gap-2">
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your model and resource changes have not been committed. If you
              leave settings now, those changes will be lost.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardChanges}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
