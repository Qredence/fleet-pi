import { ArrowLeft, Info } from "lucide-react"
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
import { Spinner } from "../../../../spinner"
import {
  PROVIDER_METADATA,
  isCustomProviderId,
  isOccProviderId,
} from "../shared/provider-metadata"
import { ProviderCredentialFields } from "../shared/provider-credential-fields"
import { CUSTOM_PROVIDER_PICKER_ID } from "./use-provider-credentials-controller"
import type {
  ChatProviderInfo,
  PiCustomProviderApi,
} from "@workspace/pi-protocol/chat-protocol"

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
