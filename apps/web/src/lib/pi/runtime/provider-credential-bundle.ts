import {
  CREDENTIAL_UI_PROVIDERS,
  KNOWN_PROVIDERS,
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
} from "@workspace/pi-protocol/provider-catalog"

export function isRemovableCredentialProvider(providerId: string) {
  return CREDENTIAL_UI_PROVIDERS.some((provider) => provider.id === providerId)
}

export function resolveProviderCredentialBundle(providerId: string) {
  if (providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) {
    const providerIds = [
      OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
      OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
      OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
    ]
    const envVarNames = providerIds
      .map((id) => KNOWN_PROVIDERS.find((entry) => entry.id === id)?.envVarName)
      .filter((value): value is string => typeof value === "string")
    return { providerIds, envVarNames }
  }

  const provider = KNOWN_PROVIDERS.find((entry) => entry.id === providerId)
  if (!provider) {
    return {
      providerIds: [] as Array<string>,
      envVarNames: [] as Array<string>,
    }
  }

  return {
    providerIds: [provider.id],
    envVarNames: [provider.envVarName],
  }
}
