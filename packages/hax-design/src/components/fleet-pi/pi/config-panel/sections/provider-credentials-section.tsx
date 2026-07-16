import {
  Box,
  Eye,
  EyeOff,
  Globe,
  Info,
  Loader2,
  Lock,
  Plus,
  Search,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "../../../../alert"
import { Button } from "../../../../button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../../../input-group"
import { cn } from "../../../../../lib/utils"
import { ItemRow } from "../../../primitives/item-row"
import {
  HIT_AREA_EXPAND_CLASS,
  HIT_AREA_EXPAND_DENSE_CLASS,
} from "../../../styles/tokens"
import { RowSurface } from "../../../primitives/surface"
import { SettingsPane } from "../../../primitives/settings-pane"
import {
  CREDENTIAL_UI_PROVIDERS,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
  PROVIDER_METADATA,
} from "../shared/provider-metadata"
import { ProviderBrandIcon } from "../shared/provider-brand-icon"
import type {
  ChatProviderInfo,
  ChatProviderUpdateRequest,
  ChatProviderUpdateResponse,
} from "../../../../../lib/pi/chat-protocol"

const OPENAI_CHAT_BASE_URL_PLACEHOLDER = "https://opencode.ai/zen/v1"
const OPENAI_CHAT_MODEL_PLACEHOLDER = "deepseek-v4-flash-free"

function isOpenAiChatCompletionsProvider(providerId: string) {
  return providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID
}

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
  const [baseUrl, setBaseUrl] = useState("")
  const [modelId, setModelId] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [addPickerOpen, setAddPickerOpen] = useState(false)
  const [addPickerQuery, setAddPickerQuery] = useState("")

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

  const filteredPickerProviders = useMemo(() => {
    const query = addPickerQuery.trim().toLowerCase()
    if (!query) return unconfiguredProviders
    return unconfiguredProviders.filter(
      (provider) =>
        provider.name.toLowerCase().includes(query) ||
        provider.envVarName.toLowerCase().includes(query)
    )
  }, [addPickerQuery, unconfiguredProviders])

  const resetEditor = () => {
    setApiKey("")
    setBaseUrl("")
    setModelId("")
    setShowPassword(false)
  }

  const closeEditor = () => {
    setEditingProvider(null)
    resetEditor()
  }

  const openEditor = (providerId: string) => {
    setEditingProvider(providerId)
    resetEditor()
    setAddPickerOpen(false)
    setAddPickerQuery("")
  }

  const handleSave = async (providerId: string) => {
    if (!onUpdateProvider) return

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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update provider"
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
      description="API keys are stored in `.env.local` for the active workspace."
    >
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
            disabled={isLoading || unconfiguredProviders.length === 0}
            onClick={() => setAddPickerOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Add provider
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
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
              disabled={unconfiguredProviders.length === 0}
              onClick={() => setAddPickerOpen(true)}
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
                        ? "API key + base URL + model ID"
                        : provider.envVarName
                    }
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
                          if (isEditing) {
                            closeEditor()
                            return
                          }
                          openEditor(provider.id)
                        }}
                      >
                        {isEditing ? "Cancel" : "Update"}
                      </Button>
                    }
                  />

                  {isEditing ? (
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
                          placeholder={meta.placeholder}
                          value={apiKey}
                          onChange={(event) => setApiKey(event.target.value)}
                          aria-label={`${provider.name} API key`}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            size="icon-xs"
                            className={cn(
                              HIT_AREA_EXPAND_CLASS,
                              "transition-[background-color,transform] duration-150 active:scale-[0.96]"
                            )}
                            aria-label={
                              showPassword ? "Hide API key" : "Show API key"
                            }
                            onClick={() =>
                              setShowPassword((current) => !current)
                            }
                          >
                            {showPassword ? <EyeOff /> : <Eye />}
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>

                      {openAiChat ? (
                        <>
                          <InputGroup>
                            <InputGroupAddon align="inline-start">
                              <Globe />
                            </InputGroupAddon>
                            <InputGroupInput
                              type="url"
                              placeholder={OPENAI_CHAT_BASE_URL_PLACEHOLDER}
                              value={baseUrl}
                              onChange={(event) =>
                                setBaseUrl(event.target.value)
                              }
                              aria-label={`${provider.name} base URL`}
                            />
                          </InputGroup>
                          <InputGroup>
                            <InputGroupAddon align="inline-start">
                              <Box />
                            </InputGroupAddon>
                            <InputGroupInput
                              type="text"
                              placeholder={OPENAI_CHAT_MODEL_PLACEHOLDER}
                              value={modelId}
                              onChange={(event) =>
                                setModelId(event.target.value)
                              }
                              aria-label={`${provider.name} model ID`}
                            />
                          </InputGroup>
                        </>
                      ) : null}

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
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={addPickerOpen} onOpenChange={setAddPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add provider</DialogTitle>
            <DialogDescription>
              Choose a provider to configure. Only unconfigured providers are
              listed.
            </DialogDescription>
          </DialogHeader>

          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="text"
              placeholder="Search providers…"
              value={addPickerQuery}
              onChange={(event) => setAddPickerQuery(event.target.value)}
              aria-label="Search providers to add"
            />
          </InputGroup>

          <div className="max-h-64 overflow-y-auto">
            {filteredPickerProviders.length === 0 ? (
              <p className="py-6 text-center text-xs text-pretty text-muted-foreground">
                {unconfiguredProviders.length === 0
                  ? "All providers are already configured."
                  : "No matching providers found."}
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredPickerProviders.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-[background-color,transform] duration-150",
                      "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.96]"
                    )}
                    onClick={() => openEditor(provider.id)}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-[4px] border border-border/40 bg-background/60">
                      <ProviderBrandIcon
                        provider={provider.id}
                        className="text-foreground/70"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {provider.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {isOpenAiChatCompletionsProvider(provider.id)
                          ? "API key + base URL + model ID"
                          : provider.envVarName}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {editingProvider &&
      !activeProviders.some((provider) => provider.id === editingProvider) ? (
        <AddProviderEditorOverlay
          provider={credentialProviders.find(
            (entry) => entry.id === editingProvider
          )}
          apiKey={apiKey}
          baseUrl={baseUrl}
          modelId={modelId}
          showPassword={showPassword}
          isPending={isPending}
          canSave={canSave}
          onApiKeyChange={setApiKey}
          onBaseUrlChange={setBaseUrl}
          onModelIdChange={setModelId}
          onTogglePassword={() => setShowPassword((current) => !current)}
          onCancel={closeEditor}
          onSave={() => {
            if (editingProvider) void handleSave(editingProvider)
          }}
        />
      ) : null}
    </SettingsPane>
  )
}

function AddProviderEditorOverlay({
  provider,
  apiKey,
  baseUrl,
  modelId,
  showPassword,
  isPending,
  canSave,
  onApiKeyChange,
  onBaseUrlChange,
  onModelIdChange,
  onTogglePassword,
  onCancel,
  onSave,
}: {
  provider: ChatProviderInfo | undefined
  apiKey: string
  baseUrl: string
  modelId: string
  showPassword: boolean
  isPending: boolean
  canSave: boolean
  onApiKeyChange: (value: string) => void
  onBaseUrlChange: (value: string) => void
  onModelIdChange: (value: string) => void
  onTogglePassword: () => void
  onCancel: () => void
  onSave: () => void
}) {
  if (!provider) return null

  const meta = PROVIDER_METADATA[provider.id] ?? {
    placeholder: "Enter credentials…",
    help: "Stored securely in your local environment overrides.",
  }
  const openAiChat = isOpenAiChatCompletionsProvider(provider.id)

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure {provider.name}</DialogTitle>
          <DialogDescription>
            {openAiChat
              ? "Enter your API key, base URL, and model ID."
              : `Stored as ${provider.envVarName} in .env.local.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              type={showPassword ? "text" : "password"}
              placeholder={meta.placeholder}
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              aria-label={`${provider.name} API key`}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                className={cn(
                  HIT_AREA_EXPAND_CLASS,
                  "transition-[background-color,transform] duration-150 active:scale-[0.96]"
                )}
                aria-label={showPassword ? "Hide API key" : "Show API key"}
                onClick={onTogglePassword}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          {openAiChat ? (
            <>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Globe />
                </InputGroupAddon>
                <InputGroupInput
                  type="url"
                  placeholder={OPENAI_CHAT_BASE_URL_PLACEHOLDER}
                  value={baseUrl}
                  onChange={(event) => onBaseUrlChange(event.target.value)}
                  aria-label={`${provider.name} base URL`}
                />
              </InputGroup>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Box />
                </InputGroupAddon>
                <InputGroupInput
                  type="text"
                  placeholder={OPENAI_CHAT_MODEL_PLACEHOLDER}
                  value={modelId}
                  onChange={(event) => onModelIdChange(event.target.value)}
                  aria-label={`${provider.name} model ID`}
                />
              </InputGroup>
            </>
          ) : null}

          <Alert className="px-3 py-2">
            <Info />
            <AlertDescription className="text-xs text-pretty">
              {meta.help}
            </AlertDescription>
          </Alert>
        </div>

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
            {isPending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : null}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
