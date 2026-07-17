/**
 * HTTPS hosts for Daytona Secrets egress substitution.
 * Secrets-backed API keys are injected as placeholders; Daytona substitutes
 * the real value only on outbound requests to these hosts.
 */

import { OPENAI_CHAT_COMPLETIONS_PROVIDER_ID } from "@workspace/pi-protocol/provider-catalog"
import type { PiProviderCredentialEntry } from "@workspace/pi-protocol/provider-catalog"

/** Static host allowlists for Secrets-eligible API-key providers. */
export const DAYTONA_SECRET_HOSTS: Record<string, ReadonlyArray<string>> = {
  openai: ["api.openai.com"],
  anthropic: ["api.anthropic.com"],
  google: ["generativelanguage.googleapis.com"],
  mistral: ["api.mistral.ai"],
  groq: ["api.groq.com"],
  openrouter: ["openrouter.ai"],
  "vercel-ai-gateway": ["ai-gateway.vercel.sh"],
}

/**
 * Providers that must not use Daytona Secrets (oauth, ADC, signing, config-only).
 * OCC API key is handled dynamically via base URL host derivation.
 */
export const DAYTONA_SECRETS_EXCLUDED_PROVIDER_IDS = new Set<string>([
  "amazon-bedrock",
  "google-vertex",
  "github-copilot",
  "ollama",
  "daytona",
  "daytona-target",
  "openai-chat-completions-base-url",
  "openai-chat-completions-model",
])

export function daytonaSecretName(providerId: string): string {
  const sanitized = providerId.replace(/[^a-zA-Z0-9_-]/g, "_")
  return `fleet_pi_${sanitized}`
}

/**
 * Resolve allowlisted hosts for a provider. Returns undefined when the
 * provider is not Secrets-eligible (caller should keep Phase 1 inject).
 */
export function resolveDaytonaSecretHosts(
  providerId: string,
  options?: { occBaseUrl?: string }
): Array<string> | undefined {
  if (DAYTONA_SECRETS_EXCLUDED_PROVIDER_IDS.has(providerId)) {
    return undefined
  }

  if (providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) {
    return resolveOccSecretHosts(options?.occBaseUrl)
  }

  if (!(providerId in DAYTONA_SECRET_HOSTS)) {
    return undefined
  }
  return [...DAYTONA_SECRET_HOSTS[providerId]]
}

export function isDaytonaSecretsEligibleProvider(
  provider: Pick<PiProviderCredentialEntry, "id" | "authType">,
  options?: { occBaseUrl?: string }
): boolean {
  if (provider.authType === "oauth") return false
  return resolveDaytonaSecretHosts(provider.id, options) !== undefined
}

function resolveOccSecretHosts(
  baseUrl: string | undefined
): Array<string> | undefined {
  if (!baseUrl?.trim()) return undefined

  let url: URL
  try {
    url = new URL(baseUrl.trim())
  } catch {
    return undefined
  }

  if (url.protocol !== "https:") return undefined
  if (!url.hostname) return undefined

  return [url.hostname]
}
