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

/**
 * Full Pi provider ids that can pick up org env / auth.json credentials.
 * On Vercel, `applyRuntimeAuth` clears these unless the user has BYOK.
 * Kept in sync with `@earendil-works/pi-ai` `getApiKeyEnvVars` / providers.md.
 */
export const PI_LLM_RUNTIME_PROVIDER_IDS = [
  "amazon-bedrock",
  "anthropic",
  "ant-ling",
  "openai",
  "azure-openai-responses",
  "nvidia",
  "deepseek",
  "google",
  "google-vertex",
  "groq",
  "cerebras",
  "xai",
  "radius",
  "openrouter",
  "vercel-ai-gateway",
  "zai",
  "zai-coding-cn",
  "mistral",
  "minimax",
  "minimax-cn",
  "moonshotai",
  "moonshotai-cn",
  "huggingface",
  "fireworks",
  "together",
  "opencode",
  "opencode-go",
  "kimi-coding",
  "cloudflare-workers-ai",
  "cloudflare-ai-gateway",
  "xiaomi",
  "xiaomi-token-plan-cn",
  "xiaomi-token-plan-ams",
  "xiaomi-token-plan-sgp",
  "github-copilot",
  "openai-chat-completions",
] as const

export const CREDENTIAL_UI_PROVIDERS = KNOWN_PROVIDERS.filter(
  (provider) =>
    !INFRA_PROVIDER_IDS.includes(
      provider.id as (typeof INFRA_PROVIDER_IDS)[number]
    ) && provider.authType !== "oauth"
)

/**
 * Env vars scrubbed on Vercel so org keys never back chat or bash/tools.
 * Includes Fleet catalog vars plus the rest of Pi's provider env map
 * (e.g. `HF_TOKEN` for Hugging Face — not in CREDENTIAL_UI_PROVIDERS).
 */
export const PROVIDER_ENV_SCRUB_VAR_NAMES = Array.from(
  new Set([
    ...KNOWN_PROVIDERS.filter(
      (provider) =>
        LLM_PROVIDER_ENV_SCRUB_IDS.includes(provider.id) ||
        provider.id === OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID ||
        provider.id === OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID
    ).map((provider) => provider.envVarName),
    // Pi built-ins beyond Fleet's Settings catalog
    "HF_TOKEN",
    "ANT_LING_API_KEY",
    "AZURE_OPENAI_API_KEY",
    "NVIDIA_API_KEY",
    "DEEPSEEK_API_KEY",
    "GOOGLE_CLOUD_API_KEY",
    "CEREBRAS_API_KEY",
    "XAI_API_KEY",
    "RADIUS_API_KEY",
    "ZAI_API_KEY",
    "ZAI_CODING_CN_API_KEY",
    "MINIMAX_API_KEY",
    "MINIMAX_CN_API_KEY",
    "MOONSHOT_API_KEY",
    "FIREWORKS_API_KEY",
    "TOGETHER_API_KEY",
    "OPENCODE_API_KEY",
    "KIMI_API_KEY",
    "CLOUDFLARE_API_KEY",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_GATEWAY_ID",
    "XIAOMI_API_KEY",
    "XIAOMI_TOKEN_PLAN_CN_API_KEY",
    "XIAOMI_TOKEN_PLAN_AMS_API_KEY",
    "XIAOMI_TOKEN_PLAN_SGP_API_KEY",
    "ANTHROPIC_OAUTH_TOKEN",
    "ANTHROPIC_OAUTH_KEY",
    "COPILOT_GITHUB_TOKEN",
    "GITHUB_COPILOT_TOKEN",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_BEARER_TOKEN_BEDROCK",
    "AWS_PROFILE",
    "AWS_ACCESS_KEY_ID",
    // Org Daytona must not be readable by chat tools or Pi on Vercel
    "DAYTONA_API_KEY",
    "ORG_DAYTONA_API_KEY",
  ])
)
