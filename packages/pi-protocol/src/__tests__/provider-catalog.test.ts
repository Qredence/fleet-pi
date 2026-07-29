import { describe, expect, it } from "vitest"
import {
  KNOWN_PROVIDERS,
  PI_LLM_RUNTIME_PROVIDER_IDS,
  PROVIDER_ENV_SCRUB_VAR_NAMES,
} from "../provider-catalog"

// Provider env-var credentials per `@earendil-works/pi-ai`
// `packages/ai/src/env-api-keys.ts` (`envMap` / `getApiKeyEnvVars`) and
// `packages/coding-agent/docs/providers.md`. Only providers present in
// `PI_LLM_RUNTIME_PROVIDER_IDS` are scrub-relevant; Pi built-ins outside that
// runtime list (e.g. `qwen-token-plan*`) intentionally have no entry here.
// Special cases:
// - `anthropic` also accepts `ANTHROPIC_OAUTH_TOKEN` (plus legacy `..._KEY`).
// - `github-copilot` reads `COPILOT_GITHUB_TOKEN` (Fleet Settings uses the
//   BYOK `GITHUB_COPILOT_TOKEN`).
// - `amazon-bedrock` authenticates via a set of AWS vars.
// - `google-vertex` ADC path uses `GOOGLE_APPLICATION_CREDENTIALS`.
// - `openai-chat-completions` needs key + base URL + model.
// - Cloudflare providers companion-account vars.
// - `google`/`google-vertex` API-key path reads `GEMINI_`/`GOOGLE_CLOUD_` keys.
const PI_LLM_PROVIDER_ENV_VARS: Record<string, Array<string>> = {
  "amazon-bedrock": [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_BEARER_TOKEN_BEDROCK",
    "AWS_PROFILE",
  ],
  anthropic: [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_OAUTH_TOKEN",
    "ANTHROPIC_OAUTH_KEY",
  ],
  "ant-ling": ["ANT_LING_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  "openai-chat-completions": [
    "OPENAI_CHAT_COMPLETIONS_API_KEY",
    "OPENAI_CHAT_COMPLETIONS_BASE_URL",
    "OPENAI_CHAT_COMPLETIONS_MODEL",
  ],
  "azure-openai-responses": ["AZURE_OPENAI_API_KEY"],
  nvidia: ["NVIDIA_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  google: ["GEMINI_API_KEY"],
  "google-vertex": ["GOOGLE_CLOUD_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS"],
  groq: ["GROQ_API_KEY"],
  cerebras: ["CEREBRAS_API_KEY"],
  xai: ["XAI_API_KEY"],
  radius: ["RADIUS_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  "vercel-ai-gateway": ["AI_GATEWAY_API_KEY"],
  zai: ["ZAI_API_KEY"],
  "zai-coding-cn": ["ZAI_CODING_CN_API_KEY"],
  mistral: ["MISTRAL_API_KEY"],
  minimax: ["MINIMAX_API_KEY"],
  "minimax-cn": ["MINIMAX_CN_API_KEY"],
  moonshotai: ["MOONSHOT_API_KEY"],
  "moonshotai-cn": ["MOONSHOT_API_KEY"],
  huggingface: ["HF_TOKEN"],
  fireworks: ["FIREWORKS_API_KEY"],
  together: ["TOGETHER_API_KEY"],
  opencode: ["OPENCODE_API_KEY"],
  "opencode-go": ["OPENCODE_API_KEY"],
  "kimi-coding": ["KIMI_API_KEY"],
  "cloudflare-workers-ai": ["CLOUDFLARE_API_KEY", "CLOUDFLARE_ACCOUNT_ID"],
  "cloudflare-ai-gateway": [
    "CLOUDFLARE_API_KEY",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_GATEWAY_ID",
  ],
  xiaomi: ["XIAOMI_API_KEY"],
  "xiaomi-token-plan-cn": ["XIAOMI_TOKEN_PLAN_CN_API_KEY"],
  "xiaomi-token-plan-ams": ["XIAOMI_TOKEN_PLAN_AMS_API_KEY"],
  "xiaomi-token-plan-sgp": ["XIAOMI_TOKEN_PLAN_SGP_API_KEY"],
  "github-copilot": ["COPILOT_GITHUB_TOKEN", "GITHUB_COPILOT_TOKEN"],
}

describe("PROVIDER_ENV_SCRUB_VAR_NAMES", () => {
  it("includes every KNOWN_PROVIDERS env var (auto-derived core)", () => {
    for (const provider of KNOWN_PROVIDERS) {
      expect(
        PROVIDER_ENV_SCRUB_VAR_NAMES,
        `missing KNOWN_PROVIDERS env var ${provider.envVarName} (${provider.id})`
      ).toContain(provider.envVarName)
    }
  })

  it("covers every runtime Pi LLM provider's env credentials", () => {
    const runtimeIds = new Set<string>(PI_LLM_RUNTIME_PROVIDER_IDS)
    const missing: Array<string> = []

    for (const [providerId, envVars] of Object.entries(
      PI_LLM_PROVIDER_ENV_VARS
    )) {
      if (!runtimeIds.has(providerId)) {
        continue
      }
      for (const envVar of envVars) {
        if (!PROVIDER_ENV_SCRUB_VAR_NAMES.includes(envVar)) {
          missing.push(`${providerId} -> ${envVar}`)
        }
      }
    }

    expect(
      missing,
      `PROVIDER_ENV_SCRUB_VAR_NAMES is missing env vars derived from the Pi pi-ai env map (env-api-keys.ts); update the hardcoded addendum in provider-catalog.ts`
    ).toEqual([])
  })

  it("does not contain duplicate entries", () => {
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    for (const envVar of PROVIDER_ENV_SCRUB_VAR_NAMES) {
      if (seen.has(envVar)) {
        duplicates.add(envVar)
      }
      seen.add(envVar)
    }
    expect([...duplicates]).toEqual([])
  })
})
