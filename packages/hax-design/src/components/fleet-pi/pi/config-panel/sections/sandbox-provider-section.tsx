import {
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Info,
  Loader2,
  Lock,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "../../../../alert"
import { Button } from "../../../../button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../../../input-group"
import { cn } from "../../../../../lib/utils"
import { ItemRow } from "../../../primitives/item-row"
import { RowSurface } from "../../../primitives/surface"
import { SettingsPane } from "../../../primitives/settings-pane"
import {
  HIT_AREA_EXPAND_CLASS,
  HIT_AREA_EXPAND_DENSE_CLASS,
} from "../../../styles/tokens"
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
  const [editing, setEditing] = useState(false)
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

  const isConfigured = Boolean(
    daytonaProvider?.isConfigured && daytonaTargetProvider?.isConfigured
  )

  const resetEditor = () => {
    setApiKey("")
    setTarget("")
    setShowPassword(false)
  }

  const closeEditor = () => {
    setEditing(false)
    resetEditor()
  }

  const handleSave = async () => {
    if (!onUpdateProvider) return
    if (!apiKey.trim() && !target.trim()) return

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
      closeEditor()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update provider"
      )
    }
  }

  const canSave = apiKey.trim().length > 0 || target.trim().length > 0

  return (
    <SettingsPane
      title="Sandbox"
      description="Configure isolated execution environments."
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        <div className="flex flex-col">
          <ItemRow
            interactive={false}
            icon={<HardDrive className="size-4 text-foreground/80" />}
            title="Daytona"
            subtitle="DAYTONA_API_KEY · DAYTONA_TARGET"
            trailing={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  HIT_AREA_EXPAND_DENSE_CLASS,
                  "h-7 px-2 text-xs transition-[background-color,transform] duration-150 active:scale-[0.96]"
                )}
                onClick={() => {
                  if (editing) {
                    closeEditor()
                    return
                  }
                  setEditing(true)
                  resetEditor()
                }}
              >
                {editing ? "Cancel" : isConfigured ? "Update" : "Configure"}
              </Button>
            }
          />

          {editing ? (
            <RowSurface
              tone="inset"
              padding="md"
              className="flex flex-col gap-2 border-t border-border/30"
            >
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Lock />
                </InputGroupAddon>
                <InputGroupInput
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter Daytona API Key..."
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  aria-label="Daytona API key"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    className={cn(
                      HIT_AREA_EXPAND_CLASS,
                      "transition-[background-color,transform] duration-150 active:scale-[0.96]"
                    )}
                    aria-label={showPassword ? "Hide API key" : "Show API key"}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>

              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Globe />
                </InputGroupAddon>
                <InputGroupInput
                  type="text"
                  placeholder="e.g. us-east"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  aria-label="Daytona region or target"
                />
              </InputGroup>

              <Alert className="px-3 py-2">
                <Info />
                <AlertDescription className="text-xs text-pretty">
                  Settings are stored securely in your local environment
                  overrides.
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending || !canSave}
                  onClick={() => void handleSave()}
                >
                  {isPending ? (
                    <Loader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : null}
                  Save
                </Button>
              </div>
            </RowSurface>
          ) : null}
        </div>
      )}
    </SettingsPane>
  )
}
