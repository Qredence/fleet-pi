"use client"

import { useEffect, useState } from "react"
import {
  Folder,
  History,
  Keyboard,
  Library,
  Monitor,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Square,
  Sun,
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@workspace/ui/components/command"
import type { ChatMode, ChatSessionInfo } from "@/lib/pi/chat-protocol"
import type { ThemePreference } from "@/lib/canvas-utils"

export type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  onNewSession: () => void
  onStop: () => void
  onResumeSession: (session: ChatSessionInfo) => void
  onSetRightPanel: (
    panel: "resources" | "workspace" | "configurations" | null
  ) => void
  onThemeChange: (theme: ThemePreference) => void
  sessions: Array<ChatSessionInfo>
  isStreaming: boolean
  themePreference: ThemePreference
}

export function ChatCommandPalette({
  open,
  onOpenChange,
  mode,
  onModeChange,
  onNewSession,
  onStop,
  onResumeSession,
  onSetRightPanel,
  onThemeChange,
  sessions,
  isStreaming,
  themePreference,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("")

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        onOpenChange(!open)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (open) setSearch("")
  }, [open])

  const handleSelect = (callback: () => void) => {
    callback()
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => handleSelect(onNewSession)}
            keywords={["new", "session", "chat"]}
          >
            <Plus className="mr-2 size-4" />
            <span>New session</span>
            <kbd className="ml-auto text-[10px] opacity-50"></kbd>
          </CommandItem>
          {isStreaming && (
            <CommandItem
              onSelect={() => handleSelect(onStop)}
              keywords={["stop", "abort", "cancel"]}
            >
              <Square className="mr-2 size-4" />
              <span>Stop generation</span>
            </CommandItem>
          )}
          <CommandItem
            onSelect={() =>
              handleSelect(() =>
                onModeChange(mode === "agent" ? "plan" : "agent")
              )
            }
            keywords={["mode", "plan", "agent", "switch"]}
          >
            <Sparkles className="mr-2 size-4" />
            <span>Switch to {mode === "agent" ? "Plan" : "Agent"} mode</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Panels">
          <CommandItem
            onSelect={() => handleSelect(() => onSetRightPanel("resources"))}
            keywords={["resources", "skills", "panels"]}
          >
            <Library className="mr-2 size-4" />
            <span>Open Resources</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => onSetRightPanel("workspace"))}
            keywords={["workspace", "files", "panels"]}
          >
            <Folder className="mr-2 size-4" />
            <span>Open Workspace</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect(() => onSetRightPanel("configurations"))
            }
            keywords={["config", "settings", "panels", "theme"]}
          >
            <Settings className="mr-2 size-4" />
            <span>Open Configurations</span>
          </CommandItem>
        </CommandGroup>

        {sessions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Sessions">
              {sessions.map((session) => {
                const label =
                  session.name || session.firstMessage || session.id.slice(0, 8)
                return (
                  <CommandItem
                    key={session.id}
                    onSelect={() =>
                      handleSelect(() => onResumeSession(session))
                    }
                    keywords={["session", label]}
                  >
                    <History className="mr-2 size-4" />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem
            onSelect={() => handleSelect(() => onThemeChange("light"))}
            keywords={["theme", "light"]}
          >
            <Sun className="mr-2 size-4" />
            <span>Light</span>
            {themePreference === "light" && (
              <Keyboard className="ml-auto size-3 opacity-50" />
            )}
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => onThemeChange("dark"))}
            keywords={["theme", "dark"]}
          >
            <Moon className="mr-2 size-4" />
            <span>Dark</span>
            {themePreference === "dark" && (
              <Keyboard className="ml-auto size-3 opacity-50" />
            )}
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => onThemeChange("system"))}
            keywords={["theme", "system"]}
          >
            <Monitor className="mr-2 size-4" />
            <span>System</span>
            {themePreference === "system" && (
              <Keyboard className="ml-auto size-3 opacity-50" />
            )}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
