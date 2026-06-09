import {
  Cpu,
  Eye,
  EyeOff,
  Info,
  Key,
  Loader2,
  Lock,
  Search,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "../../../../button"
import { Input } from "../../../../input"
import { Badge } from "../../../../badge"
import { Alert, AlertDescription } from "../../../../alert"
import { cn } from "../../../../../lib/utils"
import { FIELD_CONTROL_CLASS } from "../shared/constants"
import { ConfigurationSection } from "../shared/fields"
import { PROVIDER_METADATA } from "../shared/provider-metadata"
import type {
  ChatProviderInfo,
  ChatProviderUpdateRequest,
  ChatProviderUpdateResponse,
} from "../../../../../lib/pi/chat-protocol"

export function ProviderCredentialsSection({
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
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "missing"
  >("all")

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
    if (!apiKey.trim() || !onUpdateProvider) return
    try {
      const result = await onUpdateProvider({
        providerId,
        apiKey: apiKey.trim(),
      })
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
