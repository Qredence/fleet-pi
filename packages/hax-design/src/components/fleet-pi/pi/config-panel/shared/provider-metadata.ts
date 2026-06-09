import {
  Bot,
  Brain,
  Cpu,
  Server,
  ShieldCheck,
  Sparkles,
  Wind,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export const PROVIDER_METADATA: Record<
  string,
  {
    icon: LucideIcon
    placeholder: string
    help: string
  }
> = {
  "amazon-bedrock": {
    icon: Server,
    placeholder: "Bedrock region (e.g. us-east-1)",
    help: "Amazon Bedrock reads AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION from your local shell or AWS configuration file.",
  },
  openai: {
    icon: Sparkles,
    placeholder: "sk-proj-...",
    help: "Stored securely in your root .env.local file. Overrides the active OPENAI_API_KEY environment variable.",
  },
  anthropic: {
    icon: Bot,
    placeholder: "sk-ant-...",
    help: "Stored securely in your root .env.local file. Overrides the active ANTHROPIC_API_KEY environment variable.",
  },
  "google-vertex": {
    icon: ShieldCheck,
    placeholder: "Path to service account JSON, or credentials text...",
    help: "Stored securely in your root .env.local file. Overrides the active GOOGLE_APPLICATION_CREDENTIALS environment variable.",
  },
  "google-genai": {
    icon: Brain,
    placeholder: "AIzaSy...",
    help: "Stored securely in your root .env.local file. Overrides the active GEMINI_API_KEY environment variable.",
  },
  mistral: {
    icon: Wind,
    placeholder: "Your Mistral API key...",
    help: "Stored securely in your root .env.local file. Overrides the active MISTRAL_API_KEY environment variable.",
  },
  groq: {
    icon: Zap,
    placeholder: "gsk_...",
    help: "Stored securely in your root .env.local file. Overrides the active GROQ_API_KEY environment variable.",
  },
  ollama: {
    icon: Cpu,
    placeholder: "http://localhost:11434 (default)",
    help: "Configure local Ollama execution endpoints. Overrides the active OLLAMA_BASE_URL environment variable.",
  },
}
