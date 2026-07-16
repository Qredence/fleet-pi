export type PiProviderAuthType = "apiKey" | "oauth"

export type PiProviderCredentialEntry = {
  id: string
  name: string
  envVarName: string
  authType?: PiProviderAuthType
}

export const PI_PROVIDER_CATALOG = [
  {
    id: "amazon-bedrock",
    name: "Amazon Bedrock",
    envVarName: "AWS_ACCESS_KEY_ID",
  },
  {
    id: "openai",
    name: "OpenAI",
    envVarName: "OPENAI_API_KEY",
  },
  {
    id: "openai-chat-completions",
    name: "OpenAI Chat Completions",
    envVarName: "OPENAI_CHAT_COMPLETIONS_API_KEY",
  },
  {
    id: "openai-chat-completions-base-url",
    name: "OpenAI Chat Completions Base URL",
    envVarName: "OPENAI_CHAT_COMPLETIONS_BASE_URL",
  },
  {
    id: "openai-chat-completions-model",
    name: "OpenAI Chat Completions Model",
    envVarName: "OPENAI_CHAT_COMPLETIONS_MODEL",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    envVarName: "ANTHROPIC_API_KEY",
  },
  {
    id: "google-vertex",
    name: "Google Vertex",
    envVarName: "GOOGLE_APPLICATION_CREDENTIALS",
  },
  {
    id: "google",
    name: "Google Gemini",
    envVarName: "GEMINI_API_KEY",
  },
  {
    id: "mistral",
    name: "Mistral",
    envVarName: "MISTRAL_API_KEY",
  },
  {
    id: "groq",
    name: "Groq",
    envVarName: "GROQ_API_KEY",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    envVarName: "OPENROUTER_API_KEY",
  },
  {
    id: "vercel-ai-gateway",
    name: "Vercel AI Gateway",
    envVarName: "AI_GATEWAY_API_KEY",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    envVarName: "GITHUB_COPILOT_TOKEN",
    authType: "oauth",
  },
  {
    id: "ollama",
    name: "Ollama",
    envVarName: "OLLAMA_BASE_URL",
  },
  {
    id: "daytona",
    name: "Daytona",
    envVarName: "DAYTONA_API_KEY",
  },
  {
    id: "daytona-target",
    name: "Daytona Target",
    envVarName: "DAYTONA_TARGET",
  },
] satisfies Array<PiProviderCredentialEntry>

export const INFRA_PROVIDER_IDS = [
  "daytona",
  "daytona-target",
  "openai-chat-completions-base-url",
  "openai-chat-completions-model",
] as const

export const OPENAI_CHAT_COMPLETIONS_PROVIDER_ID = "openai-chat-completions"
export const OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID =
  "openai-chat-completions-base-url"
export const OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID =
  "openai-chat-completions-model"

export const KNOWN_PROVIDERS: Array<PiProviderCredentialEntry> =
  PI_PROVIDER_CATALOG.map(({ id, name, envVarName, authType }) => ({
    id,
    name,
    envVarName,
    authType,
  }))

/** Pi LLM providers whose env vars are scrubbed on Vercel (excludes infra). */
export const LLM_PROVIDER_ENV_SCRUB_IDS = KNOWN_PROVIDERS.filter(
  (provider) =>
    !INFRA_PROVIDER_IDS.includes(
      provider.id as (typeof INFRA_PROVIDER_IDS)[number]
    )
).map((provider) => provider.id)

export const CREDENTIAL_UI_PROVIDERS = KNOWN_PROVIDERS.filter(
  (provider) =>
    !INFRA_PROVIDER_IDS.includes(
      provider.id as (typeof INFRA_PROVIDER_IDS)[number]
    ) && provider.authType !== "oauth"
)

/** Env vars scrubbed on Vercel alongside LLM provider keys (includes infra companions). */
export const PROVIDER_ENV_SCRUB_VAR_NAMES = [
  ...KNOWN_PROVIDERS.filter(
    (provider) =>
      LLM_PROVIDER_ENV_SCRUB_IDS.includes(provider.id) ||
      provider.id === OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID ||
      provider.id === OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID
  ).map((provider) => provider.envVarName),
] as const
