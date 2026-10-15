import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
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
} from "../../breadcrumb"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../../sidebar"
import { DiscreteTabs } from "../primitives/discrete-tab"
import { settingsSectionPanes } from "./settings/settings-dialog-panes"
import { useSettingsForm } from "./settings/use-settings-form"
import { SETTINGS_SECTIONS, isSettingsSectionId } from "./settings-sections"
import type { SettingsSectionId } from "./settings-sections"
import type { LucideIcon } from "lucide-react"

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
  const form = useSettingsForm()
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [discardReason, setDiscardReason] = useState<"resource" | "model">(
    "resource"
  )
  const activeSection =
    SETTINGS_SECTIONS.find((section) => section.id === form.activeTab) ??
    SETTINGS_SECTIONS[0]
  const panes = settingsSectionPanes(form)

  const handleOpenChange = (
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) => {
    if (nextOpen) {
      onOpenChange(true)
      return
    }

    eventDetails?.cancel()
    void (async () => {
      const result = await form.requestCloseSettings()
      if (result === "close") {
        onOpenChange(false)
        return
      }
      if (result === "wait") {
        toast.message("Saving model list…")
        return
      }
      setDiscardReason(form.resourceDirty ? "resource" : "model")
      setDiscardDialogOpen(true)
    })()
  }

  const handleDiscardChanges = () => {
    form.resetDraft()
    form.resetCommittedModelBaseline()
    setDiscardDialogOpen(false)
    onOpenChange(false)
  }

  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      form.resetCommittedModelBaseline()
      if (initialTab) form.setActiveTab(initialTab)
    }
    wasOpenRef.current = open
  }, [form, initialTab, open])

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

        <SidebarProvider
          className="h-full min-h-0"
          enableKeyboardShortcut={false}
          persistState={false}
        >
          <Sidebar
            collapsible="none"
            className="hidden h-full shrink-0 flex-col border-r border-border/40 bg-muted/20 md:flex md:w-[240px]"
          >
            <div className="flex h-14 shrink-0 items-center border-b border-border/40 p-4">
              <span className="text-sm font-semibold">Settings</span>
            </div>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {SETTINGS_SECTIONS.map((section) => (
                      <SidebarNavItem
                        key={section.id}
                        active={form.activeTab === section.id}
                        onClick={() => form.setActiveTab(section.id)}
                        icon={section.icon}
                        label={section.title}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

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
                value={form.activeTab}
                onValueChange={(next) => {
                  if (isSettingsSectionId(next)) form.setActiveTab(next)
                }}
              />
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div
                id={`panel-${form.activeTab}`}
                role="tabpanel"
                aria-label={activeSection.title}
                tabIndex={0}
                className="p-6 outline-none"
              >
                {panes[form.activeTab]()}
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
              {discardReason === "resource"
                ? "Your resource changes have not been committed. If you leave settings now, those changes will be lost."
                : "Your model list could not be saved. If you leave settings now, those changes will be lost."}
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
