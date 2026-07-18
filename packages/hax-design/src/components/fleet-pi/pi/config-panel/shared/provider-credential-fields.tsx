import { Box, Globe } from "lucide-react"
import { FieldGroup } from "../../../../field"
import { SecretCredentialField, TextCredentialField } from "./credential-fields"

const OPENAI_CHAT_BASE_URL_PLACEHOLDER = "https://opencode.ai/zen/v1"
const OPENAI_CHAT_MODEL_PLACEHOLDER = "deepseek-v4-flash-free"

export function ProviderCredentialFields({
  attemptedSave,
  apiKey,
  baseUrl,
  modelId,
  onApiKeyChange,
  onBaseUrlChange,
  onModelIdChange,
  onTogglePassword,
  openAiChat,
  placeholder,
  showPassword,
}: {
  attemptedSave: boolean
  apiKey: string
  baseUrl: string
  modelId: string
  onApiKeyChange: (value: string) => void
  onBaseUrlChange: (value: string) => void
  onModelIdChange: (value: string) => void
  onTogglePassword: () => void
  openAiChat: boolean
  placeholder: string
  showPassword: boolean
}) {
  return (
    <FieldGroup className="gap-2">
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
