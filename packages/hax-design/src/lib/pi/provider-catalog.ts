import {
  Bot,
  Brain,
  Cpu,
  GitBranch,
  Globe,
  Server,
  ShieldCheck,
  Sparkles,
  Wind,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type PiProviderAuthType = "apiKey" | "oauth"

export type PiProviderCredentialEntry = {
  id: string
  name: string
  envVarName: string
  authType?: PiProviderAuthType
}

export type PiProviderUiMetadata = {
  icon: LucideIcon
  placeholder: string
  help: string
}

export type PiProviderCatalogEntry = PiProviderCredentialEntry & {
  ui?: PiProviderUiMetadata
}

export const PI_PROVIDER_CATALOG = [
  {
    id: "amazon-bedrock",
    name: "Amazon Bedrock",
    envVarName: "AWS_ACCESS_KEY_ID",
    ui: {
      icon: Server,
      placeholder: "Bedrock region (e.g. us-east-1)",
      help: "Amazon Bedrock reads AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION from your local shell or AWS configuration file.",
    },
  },
  {
    id: "openai",
    name: "OpenAI",
    envVarName: "OPENAI_API_KEY",
    ui: {
      icon: Sparkles,
      placeholder: "sk-proj-...",
      help: "Stored securely in your root .env.local file. Overrides the active OPENAI_API_KEY environment variable.",
    },
  },
  {
    id: "anthropic",
    name: "Anthropic",
    envVarName: "ANTHROPIC_API_KEY",
    ui: {
      icon: Bot,
      placeholder: "sk-ant-...",
      help: "Stored securely in your root .env.local file. Overrides the active ANTHROPIC_API_KEY environment variable.",
    },
  },
  {
    id: "google-vertex",
    name: "Google Vertex",
    envVarName: "GOOGLE_APPLICATION_CREDENTIALS",
    ui: {
      icon: ShieldCheck,
      placeholder: "Path to service account JSON, or credentials text...",
      help: "Stored securely in your root .env.local file. Overrides the active GOOGLE_APPLICATION_CREDENTIALS environment variable.",
    },
  },
  {
    id: "google",
    name: "Google Gemini",
    envVarName: "GEMINI_API_KEY",
    ui: {
      icon: Brain,
      placeholder: "AIzaSy...",
      help: "Stored securely in your root .env.local file. Overrides the active GEMINI_API_KEY environment variable.",
    },
  },
  {
    id: "mistral",
    name: "Mistral",
    envVarName: "MISTRAL_API_KEY",
    ui: {
      icon: Wind,
      placeholder: "Your Mistral API key...",
      help: "Stored securely in your root .env.local file. Overrides the active MISTRAL_API_KEY environment variable.",
    },
  },
  {
    id: "groq",
    name: "Groq",
    envVarName: "GROQ_API_KEY",
    ui: {
      icon: Zap,
      placeholder: "gsk_...",
      help: "Stored securely in your root .env.local file. Overrides the active GROQ_API_KEY environment variable.",
    },
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    envVarName: "OPENROUTER_API_KEY",
    ui: {
      icon: Globe,
      placeholder: "sk-or-...",
      help: "Stored securely in your root .env.local file. Overrides the active OPENROUTER_API_KEY environment variable.",
    },
  },
  {
    id: "vercel-ai-gateway",
    name: "Vercel AI Gateway",
    envVarName: "AI_GATEWAY_API_KEY",
    ui: {
      icon: GitBranch,
      placeholder: "Your AI Gateway API key...",
      help: "Stored securely in your root .env.local file. Overrides the active AI_GATEWAY_API_KEY environment variable.",
    },
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    envVarName: "GITHUB_COPILOT_TOKEN",
    authType: "oauth",
    ui: {
      icon: Bot,
      placeholder: "OAuth subscription",
      help: "GitHub Copilot uses subscription OAuth rather than a static API key in Fleet Pi settings.",
    },
  },
  {
    id: "ollama",
    name: "Ollama",
    envVarName: "OLLAMA_BASE_URL",
    ui: {
      icon: Cpu,
      placeholder: "http://localhost:11434 (default)",
      help: "Configure local Ollama execution endpoints. Overrides the active OLLAMA_BASE_URL environment variable.",
    },
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
] satisfies Array<PiProviderCatalogEntry>

function hasProviderUi(
  entry: PiProviderCatalogEntry
): entry is PiProviderCatalogEntry & { ui: PiProviderUiMetadata } {
  return entry.ui !== undefined
}

export const INFRA_PROVIDER_IDS = ["daytona", "daytona-target"] as const

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

export const PROVIDER_METADATA = Object.fromEntries(
  PI_PROVIDER_CATALOG.filter(hasProviderUi).map((entry) => [entry.id, entry.ui])
) as Record<string, PiProviderUiMetadata>
