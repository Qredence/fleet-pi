import { Eye, EyeOff, HardDrive, Info, Loader2, Lock } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "../../../../button"
import { Input } from "../../../../input"
import { Badge } from "../../../../badge"
import { Alert, AlertDescription } from "../../../../alert"
import { cn } from "../../../../../lib/utils"
import { FIELD_CONTROL_CLASS } from "../shared/constants"
import { SectionSurface } from "../../../primitives/surface"
import { ConfigurationSection } from "../shared/fields"
import type {
  ChatProviderInfo,
  ChatProviderUpdateRequest,
  ChatProviderUpdateResponse,
} from "../../../../../lib/pi/chat-protocol"

export function SandboxProviderSection({
  isLoading,
  isPending,
  onUpdateProvider,
  providers,
}: {
  isLoading: boolean
  isPending: boolean
  onUpdateProvider?: (
    request: ChatProviderUpdateRequest
  ) => Promise<ChatProviderUpdateResponse>
  providers: Array<ChatProviderInfo>
}) {
  const [editing, setEditing] = useState<boolean>(false)
  const [apiKey, setApiKey] = useState("")
  const [target, setTarget] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const daytonaProvider = useMemo(
    () => providers.find((p) => p.id === "daytona"),
    [providers]
  )
  const daytonaTargetProvider = useMemo(
    () => providers.find((p) => p.id === "daytona-target"),
    [providers]
  )

  const isConfigured =
    daytonaProvider?.isConfigured && daytonaTargetProvider?.isConfigured

  const handleSave = async () => {
    if (!onUpdateProvider) return

    // We update them sequentially
    try {
      if (apiKey.trim()) {
        await onUpdateProvider({
          providerId: "daytona",
          apiKey: apiKey.trim(),
        })
      }
      if (target.trim()) {
        await onUpdateProvider({
          providerId: "daytona-target",
          apiKey: target.trim(),
        })
      }

      toast.success("Sandbox Provider updated successfully")
      setEditing(false)
      setApiKey("")
      setTarget("")
      setShowPassword(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update provider"
      )
    }
  }

  return (
    <ConfigurationSection icon={HardDrive} label="Daytona Workspace">
      <SectionSurface elevation="raised">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="shrink-0 rounded-md border border-border/20 bg-foreground/5 p-1 text-foreground/60 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <Lock className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold tracking-wide text-foreground/85">
              Daytona Settings
            </div>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-foreground/45">
              Securely store your Daytona credentials to enable secure, isolated
              sandboxes.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-[11px] text-foreground/40">
            <Loader2 className="h-3 w-3 animate-spin text-foreground/45" />
            <span>Loading...</span>
          </div>
        ) : (
          <div className="mt-4 flex flex-col rounded-[10px] border border-border/30 bg-background/30 p-2.5 transition-all duration-300">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-[8px] border border-border/20 bg-background/50",
                    isConfigured && "border-primary/20 bg-primary/5"
                  )}
                >
                  <HardDrive
                    className={cn(
                      "h-4 w-4",
                      isConfigured ? "text-primary" : "text-foreground/35"
                    )}
                  />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[11.5px] leading-tight font-bold text-foreground/80">
                    Daytona
                  </span>
                  <span className="mt-0.5 truncate font-mono text-[9.5px] text-foreground/35">
                    DAYTONA_API_KEY / DAYTONA_TARGET
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {isConfigured ? (
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
                    editing &&
                      "bg-foreground/5 font-semibold text-foreground/70"
                  )}
                  onClick={() => {
                    setEditing(!editing)
                    setApiKey("")
                    setTarget("")
                    setShowPassword(false)
                  }}
                >
                  {editing ? "Cancel" : isConfigured ? "Update" : "Configure"}
                </Button>
              </div>
            </div>

            <div
              className={cn(
                "grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                editing
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <div className="mt-3 flex flex-col gap-4 border-t border-border/15 pt-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-bold tracking-wide text-foreground/45 uppercase">
                      API Key
                    </label>
                    <div className="relative flex items-center">
                      <div className="pointer-events-none absolute left-2.5 text-foreground/30">
                        <Lock className="h-3.5 w-3.5" />
                      </div>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter Daytona API Key..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className={cn(
                          FIELD_CONTROL_CLASS,
                          "w-full border-border/40 bg-background/50 pr-8 pl-8.5 text-[11px] transition-all duration-150 focus:border-border/80 focus-visible:ring-foreground/5 focus-visible:ring-offset-0"
                        )}
                      />
                      <button
                        type="button"
                        className="absolute right-2.5 cursor-pointer text-foreground/35 transition-all duration-200 hover:scale-110 hover:text-foreground/75 active:scale-95"
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

                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-bold tracking-wide text-foreground/45 uppercase">
                      Region / Target
                    </label>
                    <div className="relative flex items-center">
                      <Input
                        type="text"
                        placeholder="e.g. us-east"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className={cn(
                          FIELD_CONTROL_CLASS,
                          "w-full border-border/40 bg-background/50 text-[11px] transition-all duration-150 focus:border-border/80 focus-visible:ring-foreground/5 focus-visible:ring-offset-0"
                        )}
                      />
                    </div>
                  </div>

                  <Alert variant="default" className="px-3 py-2.5">
                    <Info className="h-4 w-4 text-foreground/50" />
                    <AlertDescription className="mt-0 text-[10px] leading-relaxed text-foreground/60">
                      Settings are stored securely in your local environment
                      overrides.
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-center justify-end gap-1.5 border-t border-border/10 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 cursor-pointer rounded-[6px] px-2.5 text-[10px] text-foreground/40 hover:text-foreground/75"
                      onClick={() => {
                        setEditing(false)
                        setApiKey("")
                        setTarget("")
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
                      disabled={isPending || (!apiKey.trim() && !target.trim())}
                      onClick={handleSave}
                    >
                      {isPending ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Saving
                        </span>
                      ) : (
                        "Save Settings"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </SectionSurface>
    </ConfigurationSection>
  )
}
