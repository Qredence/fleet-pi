import { Eye, EyeOff, Info, Loader2, Lock, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "../../../../alert"
import { Badge } from "../../../../badge"
import { Button } from "../../../../button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../../../input-group"
import { TabsSubtle, TabsSubtleItem } from "../../../../tabs-subtle"
import { cn } from "../../../../../lib/utils"
import { ItemRow } from "../../../primitives/item-row"
import { PROVIDER_METADATA } from "../shared/provider-metadata"
import { ProviderBrandIcon } from "../shared/provider-brand-icon"
import { CREDENTIAL_UI_PROVIDERS } from "../../../../../lib/pi/provider-catalog"
import type {
  ChatProviderInfo,
  ChatProviderUpdateRequest,
  ChatProviderUpdateResponse,
} from "../../../../../lib/pi/chat-protocol"

const STATUS_FILTERS = ["all", "active", "missing"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const credentialProviderIds = useMemo(
    () => new Set(CREDENTIAL_UI_PROVIDERS.map((provider) => provider.id)),
    []
  )

  const credentialProviders = useMemo(
    () =>
      providers.filter((provider) => credentialProviderIds.has(provider.id)),
    [credentialProviderIds, providers]
  )

  const filterCounts = useMemo(() => {
    const active = credentialProviders.filter((p) => p.isConfigured).length
    const missing = credentialProviders.length - active
    return {
      all: credentialProviders.length,
      active,
      missing,
    }
  }, [credentialProviders])

  const filteredProviders = useMemo(() => {
    return credentialProviders.filter((provider) => {
      const matchesSearch =
        provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.envVarName.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && provider.isConfigured) ||
        (statusFilter === "missing" && !provider.isConfigured)

      return matchesSearch && matchesStatus
    })
  }, [credentialProviders, searchQuery, statusFilter])

  const selectedFilterIndex = STATUS_FILTERS.indexOf(statusFilter)

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
          { duration: 5000 }
        )
      } else {
        toast.success("Provider credentials applied to your active sessions.")
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

  const closeEditor = () => {
    setEditingProvider(null)
    setApiKey("")
    setShowPassword(false)
  }

  return (
    <div className="mx-1 flex flex-col gap-1.5">
      {!isLoading && credentialProviders.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="text"
              placeholder="Search credentials…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search credentials"
            />
          </InputGroup>

          <TabsSubtle
            idPrefix="provider-status"
            selectedIndex={selectedFilterIndex}
            onSelect={(index) => {
              setStatusFilter(STATUS_FILTERS[index] ?? "all")
            }}
          >
            {STATUS_FILTERS.map((filter, index) => (
              <TabsSubtleItem
                key={filter}
                index={index}
                label={`${filter.charAt(0).toUpperCase()}${filter.slice(1)} (${filterCounts[filter]})`}
              />
            ))}
          </TabsSubtle>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Loading providers…</span>
        </div>
      ) : credentialProviders.length === 0 ? (
        <p className="py-6 text-center text-xs text-pretty text-muted-foreground">
          No providers discovered.
        </p>
      ) : filteredProviders.length === 0 ? (
        <p className="py-6 text-center text-xs text-pretty text-muted-foreground">
          No matching providers found.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filteredProviders.map((provider) => {
            const isEditing = editingProvider === provider.id
            const meta = PROVIDER_METADATA[provider.id] ?? {
              placeholder: "Enter credentials…",
              help: "Stored securely in your local environment overrides.",
            }

            return (
              <div key={provider.id} className="flex flex-col gap-1.5">
                <ItemRow
                  interactive={false}
                  icon={
                    <ProviderBrandIcon
                      provider={provider.id}
                      className={cn(
                        !provider.isConfigured && "opacity-50 grayscale"
                      )}
                    />
                  }
                  title={provider.name}
                  subtitle={provider.envVarName}
                  trailing={
                    <>
                      <Badge
                        variant={
                          provider.isConfigured ? "default" : "secondary"
                        }
                      >
                        {provider.isConfigured ? "Active" : "Missing"}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          if (isEditing) {
                            closeEditor()
                            return
                          }
                          setEditingProvider(provider.id)
                          setApiKey("")
                          setShowPassword(false)
                        }}
                      >
                        {isEditing
                          ? "Cancel"
                          : provider.isConfigured
                            ? "Update"
                            : "Configure"}
                      </Button>
                    </>
                  }
                />

                {isEditing ? (
                  <div className="mx-1 flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/20 p-2.5">
                    <InputGroup>
                      <InputGroupAddon align="inline-start">
                        <Lock />
                      </InputGroupAddon>
                      <InputGroupInput
                        type={showPassword ? "text" : "password"}
                        placeholder={meta.placeholder}
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        aria-label={`${provider.name} API key`}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          size="icon-xs"
                          aria-label={
                            showPassword ? "Hide API key" : "Show API key"
                          }
                          onClick={() => setShowPassword((current) => !current)}
                        >
                          {showPassword ? <EyeOff /> : <Eye />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>

                    <Alert className="px-3 py-2">
                      <Info />
                      <AlertDescription className="text-xs text-pretty">
                        {meta.help}
                      </AlertDescription>
                    </Alert>

                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={closeEditor}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending || !apiKey.trim()}
                        onClick={() => handleSave(provider.id)}
                      >
                        {isPending ? (
                          <Loader2
                            className="animate-spin"
                            data-icon="inline-start"
                          />
                        ) : null}
                        Save key
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
