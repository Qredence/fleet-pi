import { Box, Globe, Tag } from "lucide-react"
import { FieldGroup } from "../../../../field"
import { SecretCredentialField, TextCredentialField } from "./credential-fields"

const OPENAI_CHAT_BASE_URL_PLACEHOLDER = "https://opencode.ai/zen/v1"
const OPENAI_CHAT_MODEL_PLACEHOLDER = "qwen35-122b-a10b"
const OPENAI_CHAT_NAME_PLACEHOLDER = "e.g. OpenCode Zen, Nebius, Groq…"

/**
 * Renders credential fields for a provider, including OpenAI Chat-specific settings when enabled.
 *
 * @param attemptedSave - Whether the form has been submitted for validation
 * @param openAiChat - Whether to include OpenAI Chat provider fields
 * @param displayName - The optional provider display name
 * @param onDisplayNameChange - Handles changes to the provider display name
 */
export function ProviderCredentialFields({
  attemptedSave,
  apiKey,
  baseUrl,
  modelId,
  displayName,
  onApiKeyChange,
  onBaseUrlChange,
  onModelIdChange,
  onDisplayNameChange,
  onTogglePassword,
  openAiChat,
  placeholder,
  showPassword,
}: {
  attemptedSave: boolean
  apiKey: string
  baseUrl: string
  modelId: string
  displayName?: string
  onApiKeyChange: (value: string) => void
  onBaseUrlChange: (value: string) => void
  onModelIdChange: (value: string) => void
  onDisplayNameChange?: (value: string) => void
  onTogglePassword: () => void
  openAiChat: boolean
  placeholder: string
  showPassword: boolean
}) {
  return (
    <FieldGroup className="gap-2">
      {openAiChat && onDisplayNameChange ? (
        <TextCredentialField
          attemptedSave={attemptedSave}
          icon={Tag}
          label="Provider name"
          placeholder={OPENAI_CHAT_NAME_PLACEHOLDER}
          value={displayName ?? ""}
          onChange={onDisplayNameChange}
        />
      ) : null}
      <SecretCredentialField
        attemptedSave={attemptedSave}
        label="API key"
        placeholder={placeholder}
        value={apiKey}
        showPassword={showPassword}
        onChange={onApiKeyChange}
        onToggleVisibility={onTogglePassword}
      />
      {openAiChat ? (
        <>
          <TextCredentialField
            attemptedSave={attemptedSave}
            icon={Globe}
            inputType="url"
            label="Base URL"
            placeholder={OPENAI_CHAT_BASE_URL_PLACEHOLDER}
            value={baseUrl}
            onChange={onBaseUrlChange}
          />
          <TextCredentialField
            attemptedSave={attemptedSave}
            icon={Box}
            label="Model name"
            placeholder={OPENAI_CHAT_MODEL_PLACEHOLDER}
            value={modelId}
            onChange={onModelIdChange}
          />
        </>
      ) : null}
    </FieldGroup>
  )
}

export { OPENAI_CHAT_BASE_URL_PLACEHOLDER, OPENAI_CHAT_MODEL_PLACEHOLDER }
