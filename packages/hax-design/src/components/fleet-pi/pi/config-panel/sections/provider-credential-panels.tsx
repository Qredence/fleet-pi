import { ArrowLeft, Info, Search, Trash2 } from "lucide-react"
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
import {
  PROVIDER_METADATA,
  isCustomProviderId,
  isOccProviderId,
} from "../shared/provider-metadata"
import { ProviderBrandIcon } from "../shared/provider-brand-icon"
import { ProviderCredentialFields } from "../shared/provider-credential-fields"
import { CUSTOM_PROVIDER_PICKER_ID } from "./use-provider-credentials-controller"
import type {
  ChatProviderInfo,
  PiCustomProviderApi,
} from "@workspace/pi-protocol/chat-protocol"

export function ActiveProviderList({
  providers,
  editingProvider,
  api,
  apiKey,
  baseUrl,
  modelId,
  models,
  displayName,
  showPassword,
  attemptedSave,
  isPending,
  canSave,
  canRemove,
  onApiKeyChange,
  onApiChange,
  onBaseUrlChange,
  onModelIdChange,
  onModelsChange,
  onDisplayNameChange,
  onTogglePassword,
  onEdit,
  onCancelEdit,
  onSave,
  onRemove,
}: {
  providers: Array<ChatProviderInfo>
  editingProvider: string | null
  api: PiCustomProviderApi
  apiKey: string
  baseUrl: string
  modelId: string
  models: string
  displayName: string
  showPassword: boolean
  attemptedSave: boolean
  isPending: boolean
  canSave: boolean
  canRemove: boolean
  onApiKeyChange: (value: string) => void
  onApiChange: (value: PiCustomProviderApi) => void
  onBaseUrlChange: (value: string) => void
  onModelIdChange: (value: string) => void
  onModelsChange: (value: string) => void
  onDisplayNameChange: (value: string) => void
  onTogglePassword: () => void
  onEdit: (providerId: string) => void
  onCancelEdit: () => void
  onSave: (providerId: string) => void
  onRemove: (provider: ChatProviderInfo) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {providers.map((provider) => {
        const isEditing = editingProvider === provider.id
        const isCustom = isCustomProviderId(provider.id)
        const meta =
          PROVIDER_METADATA[provider.id] ??
          PROVIDER_METADATA[isCustom ? "custom" : "openai-chat-completions"]
        const openAiChat = isOccProviderId(provider.id)

        return (
          <div key={provider.id} className="flex flex-col">
            <ItemRow
              interactive={false}
              icon={
                <ProviderBrandIcon
                  provider={provider.id}
                  api={provider.api}
                  className="text-foreground/80"
                />
              }
              title={provider.name}
              subtitle={
                isCustom
                  ? "Custom provider · API key + base URL"
                  : openAiChat
                    ? "OpenAI-compatible · API key + base URL + model name"
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
                    disabled={isPending || !canRemove}
                    aria-label={`Remove ${provider.name}`}
                    onClick={() => onRemove(provider)}
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
                        onCancelEdit()
                        return
                      }
                      onEdit(provider.id)
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
                  api={api}
                  apiKey={apiKey}
                  baseUrl={baseUrl}
                  modelId={modelId}
                  models={models}
                  displayName={displayName}
                  isCustom={isCustom}
                  openAiChat={openAiChat}
                  placeholder={meta.placeholder}
                  showPassword={showPassword}
                  onApiKeyChange={onApiKeyChange}
                  onApiChange={onApiChange}
                  onBaseUrlChange={onBaseUrlChange}
                  onModelIdChange={onModelIdChange}
                  onModelsChange={onModelsChange}
                  // Name is editable on named OCC instances and custom
                  // providers, not on the reserved default OCC slot
                  // (which carries no providerFamily).
                  onDisplayNameChange={
                    isCustom || provider.providerFamily !== undefined
                      ? onDisplayNameChange
                      : undefined
                  }
                  onTogglePassword={onTogglePassword}
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
                    onClick={() => onSave(provider.id)}
                  >
                    {isPending ? <Spinner data-icon="inline-start" /> : null}
                    Save
                  </Button>
                </div>
              </RowSurface>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function AddProviderPickerPanel({
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

/**
 * Renders the credential editor for a provider, including provider-specific fields, guidance, and save controls.
 *
 * @param provider - The provider whose credentials are being configured.
 * @param displayName - The optional name for an OpenAI-compatible provider instance.
 * @param attemptedSave - Whether the save action has been attempted, enabling validation feedback.
 * @param isPending - Whether saving is in progress.
 * @param canSave - Whether the current form values satisfy save requirements.
 */
export function AddProviderEditorPanel({
  provider,
  api,
  apiKey,
  baseUrl,
  modelId,
  models,
  displayName,
  showPassword,
  attemptedSave,
  isPending,
  canSave,
  onApiKeyChange,
  onApiChange,
  onBaseUrlChange,
  onModelIdChange,
  onModelsChange,
  onDisplayNameChange,
  onTogglePassword,
  onBack,
  onCancel,
  onSave,
}: {
  provider: ChatProviderInfo
  api: PiCustomProviderApi
  apiKey: string
  baseUrl: string
  modelId: string
  models: string
  displayName?: string
  showPassword: boolean
  attemptedSave: boolean
  isPending: boolean
  canSave: boolean
  onApiKeyChange: (value: string) => void
  onApiChange: (value: PiCustomProviderApi) => void
  onBaseUrlChange: (value: string) => void
  onModelIdChange: (value: string) => void
  onModelsChange: (value: string) => void
  onDisplayNameChange?: (value: string) => void
  onTogglePassword: () => void
  onBack: () => void
  onCancel: () => void
  onSave: () => void
}) {
  const isCustomTemplate =
    provider.id === CUSTOM_PROVIDER_PICKER_ID || isCustomProviderId(provider.id)
  const meta =
    PROVIDER_METADATA[provider.id] ??
    (isCustomTemplate
      ? PROVIDER_METADATA["custom"]
      : {
          placeholder: "Enter credentials…",
          help: "Stored securely in your local environment overrides.",
        })
  const openAiChat = isOccProviderId(provider.id) && !isCustomTemplate

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
            {isCustomTemplate
              ? "Name this custom provider, pick its API family, then enter its API key and https base URL. Model ids are optional."
              : openAiChat
                ? "Name this OpenAI-compatible provider, then enter its API key, base URL, and model name."
                : `Stored as ${provider.envVarName} for this account.`}
          </p>
        </div>
      </div>

      <ProviderCredentialFields
        attemptedSave={attemptedSave}
        api={api}
        apiKey={apiKey}
        baseUrl={baseUrl}
        modelId={modelId}
        models={models}
        displayName={displayName}
        isCustom={isCustomTemplate}
        openAiChat={openAiChat}
        placeholder={meta.placeholder}
        showPassword={showPassword}
        onApiKeyChange={onApiKeyChange}
        onApiChange={onApiChange}
        onBaseUrlChange={onBaseUrlChange}
        onModelIdChange={onModelIdChange}
        onModelsChange={onModelsChange}
        onDisplayNameChange={onDisplayNameChange}
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

export function RemoveProviderConfirmDialog({
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

export function ProviderPickerRow({
  configured,
  onSelect,
  provider,
}: {
  configured: boolean
  onSelect: () => void
  provider: ChatProviderInfo
}) {
  const openAiChat = isOccProviderId(provider.id)
  const isCustomTemplate =
    provider.id === CUSTOM_PROVIDER_PICKER_ID || isCustomProviderId(provider.id)

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
          provider={isCustomTemplate ? "custom" : provider.id}
          api={provider.api}
          className="text-foreground/70"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{provider.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {isCustomTemplate
            ? "API family + key + https base URL"
            : openAiChat
              ? "API key + base URL + model name"
              : provider.envVarName}
          {configured ? " · Update" : ""}
        </div>
      </div>
    </button>
  )
}
