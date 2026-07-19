import { ArrowLeft, Info, Plus, Search, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "../../../../alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "../../../../alert-dialog"
import { Button } from "../../../../button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../../../input-group"
import { Spinner } from "../../../../spinner"
import { cn } from "../../../../../lib/utils"
import { ItemRow } from "../../../primitives/item-row"
import { HIT_AREA_EXPAND_DENSE_CLASS } from "../../../styles/tokens"
import { RowSurface } from "../../../primitives/surface"
import { SettingsPane } from "../../../primitives/settings-pane"
import {
  CREDENTIAL_UI_PROVIDERS,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
  PROVIDER_METADATA,
} from "../shared/provider-metadata"
import { ProviderBrandIcon } from "../shared/provider-brand-icon"
import { ProviderCredentialFields } from "../shared/provider-credential-fields"
import type {
  ChatProviderInfo,
  ChatProviderRemoveRequest,
  ChatProviderRemoveResponse,
  ChatProviderUpdateRequest,
  ChatProviderUpdateResponse,
} from "../../../../../lib/pi/chat-protocol"

function isOpenAiChatCompletionsProvider(providerId: string) {
  return providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID
}

function providerMatchesQuery(provider: ChatProviderInfo, query: string) {
  if (!query) return true
  const haystack = [
    provider.name,
    provider.envVarName,
    provider.id,
    isOpenAiChatCompletionsProvider(provider.id)
      ? "api key base url model name chat completions"
      : "",
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(query)
}

export function ProviderCredentialsSection({
  isLoading,
  isPending,
  onRemoveProvider,
  onUpdateProvider,
  providers,
}: {
  isLoading: boolean
  isPending: boolean
  onRemoveProvider?: (
    request: ChatProviderRemoveRequest
  ) => Promise<ChatProviderRemoveResponse>
  onUpdateProvider?: (
    request: ChatProviderUpdateRequest
  ) => Promise<ChatProviderUpdateResponse>
  providers: Array<ChatProviderInfo>
}) {
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [modelId, setModelId] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [addPickerOpen, setAddPickerOpen] = useState(false)
  const [addPickerQuery, setAddPickerQuery] = useState("")
  const [confirmRemoveProvider, setConfirmRemoveProvider] =
    useState<ChatProviderInfo | null>(null)

  const credentialProviderIds = useMemo(
    () => new Set(CREDENTIAL_UI_PROVIDERS.map((provider) => provider.id)),
    []
  )

  const credentialProviders = useMemo(
    () =>
      providers.filter((provider) => credentialProviderIds.has(provider.id)),
    [credentialProviderIds, providers]
  )

  const activeProviders = useMemo(
    () => credentialProviders.filter((provider) => provider.isConfigured),
    [credentialProviders]
  )

  const unconfiguredProviders = useMemo(
    () => credentialProviders.filter((provider) => !provider.isConfigured),
    [credentialProviders]
  )

  const filteredActiveProviders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return activeProviders
    return activeProviders.filter(
      (provider) =>
        provider.name.toLowerCase().includes(query) ||
        provider.envVarName.toLowerCase().includes(query)
    )
  }, [activeProviders, searchQuery])

  const filteredPickerAvailable = useMemo(() => {
    const query = addPickerQuery.trim().toLowerCase()
    return unconfiguredProviders.filter((provider) =>
      providerMatchesQuery(provider, query)
    )
  }, [addPickerQuery, unconfiguredProviders])

  const filteredPickerConfigured = useMemo(() => {
    const query = addPickerQuery.trim().toLowerCase()
    return activeProviders.filter((provider) =>
      providerMatchesQuery(provider, query)
    )
  }, [activeProviders, addPickerQuery])

  const pickerHasResults =
    filteredPickerAvailable.length > 0 || filteredPickerConfigured.length > 0

  const editingUnconfiguredProvider =
    editingProvider &&
    !activeProviders.some((provider) => provider.id === editingProvider)
      ? (credentialProviders.find((entry) => entry.id === editingProvider) ??
        null)
      : null

  const resetEditor = () => {
    setApiKey("")
    setBaseUrl("")
    setModelId("")
    setShowPassword(false)
    setAttemptedSave(false)
  }

  const closeEditor = () => {
    setEditingProvider(null)
    resetEditor()
  }

  const openEditor = (providerId: string) => {
    setAddPickerOpen(false)
    setAddPickerQuery("")
    setEditingProvider(providerId)
    resetEditor()
  }

  const openAddPicker = () => {
    closeEditor()
    setAddPickerQuery("")
    setAddPickerOpen(true)
  }

  const closeAddPicker = () => {
    setAddPickerOpen(false)
    setAddPickerQuery("")
  }

  const selectProviderFromPicker = (providerId: string) => {
    openEditor(providerId)
  }

  const handleSave = async (providerId: string) => {
    if (!onUpdateProvider) return

    setAttemptedSave(true)
    const openAiChat = isOpenAiChatCompletionsProvider(providerId)
    if (!apiKey.trim()) return
    if (openAiChat && (!baseUrl.trim() || !modelId.trim())) return

    try {
      await onUpdateProvider({
        providerId,
        apiKey: apiKey.trim(),
        ...(openAiChat
          ? {
              baseUrl: baseUrl.trim(),
              modelId: modelId.trim(),
            }
          : {}),
      })

      toast.success("Provider credentials applied to your active sessions.")
      closeEditor()
      closeAddPicker()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update provider"
      )
    }
  }

  const handleRemove = async (provider: ChatProviderInfo) => {
    if (!onRemoveProvider) return

    try {
      await onRemoveProvider({ providerId: provider.id })
      if (editingProvider === provider.id) {
        closeEditor()
      }
      toast.success(`${provider.name} removed from your configured providers.`)
      setConfirmRemoveProvider(null)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove provider"
      )
    }
  }

  const canSave =
    apiKey.trim().length > 0 &&
    (!editingProvider ||
      !isOpenAiChatCompletionsProvider(editingProvider) ||
      (baseUrl.trim().length > 0 && modelId.trim().length > 0))

  return (
    <SettingsPane
      title="Providers"
      description="Locally, API keys are stored in `.env.local`. When deployed, they are stored encrypted in your account."
    >
      {addPickerOpen ? (
        <AddProviderPickerPanel
          addPickerQuery={addPickerQuery}
          credentialProvidersLength={credentialProviders.length}
          filteredPickerAvailable={filteredPickerAvailable}
          filteredPickerConfigured={filteredPickerConfigured}
          pickerHasResults={pickerHasResults}
          onClose={closeAddPicker}
          onQueryChange={setAddPickerQuery}
          onSelect={selectProviderFromPicker}
        />
      ) : editingUnconfiguredProvider ? (
        <AddProviderEditorPanel
          provider={editingUnconfiguredProvider}
          apiKey={apiKey}
          baseUrl={baseUrl}
          modelId={modelId}
          showPassword={showPassword}
          attemptedSave={attemptedSave}
          isPending={isPending}
          canSave={canSave}
          onApiKeyChange={setApiKey}
          onBaseUrlChange={setBaseUrl}
          onModelIdChange={setModelId}
          onTogglePassword={() => setShowPassword((current) => !current)}
          onBack={openAddPicker}
          onCancel={closeEditor}
          onSave={() => {
            if (editingProvider) void handleSave(editingProvider)
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <InputGroup className="flex-1">
              <InputGroupAddon align="inline-start">
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                placeholder="Search credentials…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Search credentials"
                disabled={isLoading || activeProviders.length === 0}
              />
            </InputGroup>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading || credentialProviders.length === 0}
              onClick={openAddPicker}
            >
              <Plus data-icon="inline-start" />
              Add provider
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Spinner className="size-3" />
              <span>Loading...</span>
            </div>
          ) : activeProviders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-center text-xs text-pretty text-muted-foreground">
                No providers configured
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={credentialProviders.length === 0}
                onClick={openAddPicker}
              >
                <Plus data-icon="inline-start" />
                Add provider
              </Button>
            </div>
          ) : filteredActiveProviders.length === 0 ? (
            <p className="py-6 text-center text-xs text-pretty text-muted-foreground">
              No matching providers found.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredActiveProviders.map((provider) => {
                const isEditing = editingProvider === provider.id
                const meta = PROVIDER_METADATA[provider.id] ?? {
                  placeholder: "Enter credentials…",
                  help: "Stored securely in your local environment overrides.",
                }
                const openAiChat = isOpenAiChatCompletionsProvider(provider.id)

                return (
                  <div key={provider.id} className="flex flex-col">
                    <ItemRow
                      interactive={false}
                      icon={
                        <ProviderBrandIcon
                          provider={provider.id}
                          className="text-foreground/80"
                        />
                      }
                      title={provider.name}
                      subtitle={
                        openAiChat
                          ? "API key + base URL + model name"
                          : provider.envVarName
                      }
                      trailing={
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              HIT_AREA_EXPAND_DENSE_CLASS,
                              "h-7 px-2 text-xs text-muted-foreground transition-[background-color,color,transform] duration-150 hover:text-destructive active:scale-[0.96]"
                            )}
                            disabled={isPending || !onRemoveProvider}
                            aria-label={`Remove ${provider.name}`}
                            onClick={() => setConfirmRemoveProvider(provider)}
                          >
                            <Trash2 data-icon="inline-start" />
                            Remove
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              HIT_AREA_EXPAND_DENSE_CLASS,
                              "h-7 px-2 text-xs transition-[background-color,transform] duration-150 active:scale-[0.96]"
                            )}
                            disabled={isPending}
                            onClick={() => {
                              if (isEditing) {
                                closeEditor()
                                return
                              }
                              openEditor(provider.id)
                            }}
                          >
                            {isEditing ? "Cancel" : "Update"}
                          </Button>
                        </div>
                      }
                    />

                    {isEditing ? (
                      <RowSurface
                        tone="inset"
                        padding="md"
                        className="flex flex-col gap-2 border-t border-border/30"
                      >
                        <ProviderCredentialFields
                          attemptedSave={attemptedSave}
                          apiKey={apiKey}
                          baseUrl={baseUrl}
                          modelId={modelId}
                          openAiChat={openAiChat}
                          placeholder={meta.placeholder}
                          showPassword={showPassword}
                          onApiKeyChange={setApiKey}
                          onBaseUrlChange={setBaseUrl}
                          onModelIdChange={setModelId}
                          onTogglePassword={() =>
                            setShowPassword((current) => !current)
                          }
                        />

                        <Alert className="px-3 py-2">
                          <Info />
                          <AlertDescription className="text-xs text-pretty">
                            {meta.help}
                          </AlertDescription>
                        </Alert>

                        <div className="flex items-center justify-end">
                          <Button
                            type="button"
                            size="sm"
                            disabled={isPending || !canSave}
                            onClick={() => void handleSave(provider.id)}
                          >
                            {isPending ? (
                              <Spinner data-icon="inline-start" />
                            ) : null}
                            Save
                          </Button>
                        </div>
                      </RowSurface>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <RemoveProviderConfirmDialog
        confirmRemoveProvider={confirmRemoveProvider}
        isPending={isPending}
        onClose={() => setConfirmRemoveProvider(null)}
        onConfirm={(provider) => {
          void handleRemove(provider)
        }}
      />
    </SettingsPane>
  )
}

function AddProviderPickerPanel({
  addPickerQuery,
  credentialProvidersLength,
  filteredPickerAvailable,
  filteredPickerConfigured,
  pickerHasResults,
  onClose,
  onQueryChange,
  onSelect,
}: {
  addPickerQuery: string
  credentialProvidersLength: number
  filteredPickerAvailable: Array<ChatProviderInfo>
  filteredPickerConfigured: Array<ChatProviderInfo>
  pickerHasResults: boolean
  onClose: () => void
  onQueryChange: (value: string) => void
  onSelect: (providerId: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Back to providers"
          onClick={onClose}
        >
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Add provider</p>
          <p className="text-xs text-pretty text-muted-foreground">
            Choose a provider to store encrypted credentials for this account.
          </p>
        </div>
      </div>

      <InputGroup>
        <InputGroupAddon align="inline-start">
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          type="text"
          placeholder="Search providers…"
          value={addPickerQuery}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="Search providers to add"
        />
      </InputGroup>

      <div className="max-h-[min(24rem,50vh)] overflow-y-auto">
        {!pickerHasResults ? (
          <p className="py-6 text-center text-xs text-pretty text-muted-foreground">
            {credentialProvidersLength === 0
              ? "No providers available."
              : "No matching providers found."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredPickerAvailable.length > 0 ? (
              <div className="flex flex-col gap-1">
                {filteredPickerAvailable.map((provider) => (
                  <ProviderPickerRow
                    key={provider.id}
                    provider={provider}
                    configured={false}
                    onSelect={() => onSelect(provider.id)}
                  />
                ))}
              </div>
            ) : null}

            {filteredPickerConfigured.length > 0 ? (
              <div className="flex flex-col gap-1">
                {filteredPickerAvailable.length > 0 ? (
                  <p className="px-2 pt-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Already configured
                  </p>
                ) : null}
                {filteredPickerConfigured.map((provider) => (
                  <ProviderPickerRow
                    key={provider.id}
                    provider={provider}
                    configured
                    onSelect={() => onSelect(provider.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

function AddProviderEditorPanel({
  provider,
  apiKey,
  baseUrl,
  modelId,
  showPassword,
  attemptedSave,
  isPending,
  canSave,
  onApiKeyChange,
  onBaseUrlChange,
  onModelIdChange,
  onTogglePassword,
  onBack,
  onCancel,
  onSave,
}: {
  provider: ChatProviderInfo
  apiKey: string
  baseUrl: string
  modelId: string
  showPassword: boolean
  attemptedSave: boolean
  isPending: boolean
  canSave: boolean
  onApiKeyChange: (value: string) => void
  onBaseUrlChange: (value: string) => void
  onModelIdChange: (value: string) => void
  onTogglePassword: () => void
  onBack: () => void
  onCancel: () => void
  onSave: () => void
}) {
  const meta = PROVIDER_METADATA[provider.id] ?? {
    placeholder: "Enter credentials…",
    help: "Stored securely in your local environment overrides.",
  }
  const openAiChat = isOpenAiChatCompletionsProvider(provider.id)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Back to provider list"
          onClick={onBack}
        >
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Configure {provider.name}</p>
          <p className="text-xs text-pretty text-muted-foreground">
            {openAiChat
              ? "Enter your API key, base URL, and model name."
              : `Stored as ${provider.envVarName} for this account.`}
          </p>
        </div>
      </div>

      <ProviderCredentialFields
        attemptedSave={attemptedSave}
        apiKey={apiKey}
        baseUrl={baseUrl}
        modelId={modelId}
        openAiChat={openAiChat}
        placeholder={meta.placeholder}
        showPassword={showPassword}
        onApiKeyChange={onApiKeyChange}
        onBaseUrlChange={onBaseUrlChange}
        onModelIdChange={onModelIdChange}
        onTogglePassword={onTogglePassword}
      />

      <Alert className="px-3 py-2">
        <Info />
        <AlertDescription className="text-xs text-pretty">
          {meta.help}
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending || !canSave}
          onClick={onSave}
        >
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          Save
        </Button>
      </div>
    </div>
  )
}

function RemoveProviderConfirmDialog({
  confirmRemoveProvider,
  isPending,
  onClose,
  onConfirm,
}: {
  confirmRemoveProvider: ChatProviderInfo | null
  isPending: boolean
  onClose: () => void
  onConfirm: (provider: ChatProviderInfo) => void
}) {
  return (
    <AlertDialog
      open={confirmRemoveProvider !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <div className="flex flex-col gap-2">
          <AlertDialogTitle>
            Remove {confirmRemoveProvider?.name ?? "provider"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This clears stored credentials for this provider from your workspace
            settings. Active sessions will stop using it immediately.
          </AlertDialogDescription>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending || !confirmRemoveProvider}
            onClick={() => {
              if (confirmRemoveProvider) onConfirm(confirmRemoveProvider)
            }}
          >
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            Remove provider
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ProviderPickerRow({
  configured,
  onSelect,
  provider,
}: {
  configured: boolean
  onSelect: () => void
  provider: ChatProviderInfo
}) {
  const openAiChat = isOpenAiChatCompletionsProvider(provider.id)

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-[background-color,transform] duration-150",
        "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.96]"
      )}
      onClick={onSelect}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-[4px] border border-border/40 bg-background/60">
        <ProviderBrandIcon
          provider={provider.id}
          className="text-foreground/70"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{provider.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {openAiChat ? "API key + base URL + model name" : provider.envVarName}
          {configured ? " · Update" : ""}
        </div>
      </div>
    </button>
  )
}
