import { ArrowLeft, Search } from "lucide-react"
import { Button } from "../../../../button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../../../input-group"
import { cn } from "../../../../../lib/utils"
import {
  isCustomProviderId,
  isOccProviderId,
} from "../shared/provider-metadata"
import { ProviderBrandIcon } from "../shared/provider-brand-icon"
import { CUSTOM_PROVIDER_PICKER_ID } from "./use-provider-credentials-controller"
import type { ChatProviderInfo } from "@workspace/pi-protocol/chat-protocol"

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
