import {
  KNOWN_PROVIDERS,
  LLM_PROVIDER_ENV_SCRUB_IDS,
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
  INFRA_PROVIDER_IDS as PROTOCOL_INFRA_PROVIDER_IDS,
} from "@workspace/pi-protocol/provider-catalog"
import { loadDecryptedUserProviderSecrets } from "../db/user-providers"
import { isEnvVarConfigured } from "../env-manager"
import { fingerprintProviderSecrets } from "./sandbox-prepare"
import { isDaytonaSecretsEligibleProvider } from "./secret-hosts"
import type { PiAuthFile, SandboxProviderSecrets } from "./sandbox-prepare"

export type { PiAuthFile, SandboxProviderSecrets }

/**
 * Load provider secrets for sandbox inject, omitting Daytona Secrets-backed
 * API keys (those mount via createSandbox `secrets` placeholders).
 */
export async function loadSandboxProviderSecrets(
  userId: string | undefined
): Promise<SandboxProviderSecrets> {
  const configured = await loadConfiguredProviderSecrets(userId)
  return buildPlaintextSandboxCredentials(configured)
}

/**
 * Build auth.json + plain env for providers that cannot use Daytona Secrets.
 */
export function buildPlaintextSandboxCredentials(
  configured: Map<string, string>,
  mountedSecretEnvVars: ReadonlySet<string> = new Set()
): SandboxProviderSecrets {
  const occBaseUrl = configured.get(
    OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
  )
  const envVars: Record<string, string> = {}
  const authJson: PiAuthFile = {}

  for (const provider of KNOWN_PROVIDERS) {
    if (INFRA_PROVIDER_IDS.has(provider.id)) continue

    const secret = configured.get(provider.id)
    if (!secret) continue

    if (provider.authType === "oauth") {
      try {
        const credentials = JSON.parse(secret) as unknown
        authJson[provider.id] = { type: "oauth", credentials }
      } catch {
        authJson[provider.id] = {
          type: "oauth",
          credentials: { token: secret },
        }
      }
      continue
    }

    if (
      isDaytonaSecretsEligibleProvider(provider, { occBaseUrl }) &&
      mountedSecretEnvVars.has(provider.envVarName)
    ) {
      // Mounted via Daytona Secrets placeholders — do not put plaintext in
      // sandbox env or auth.json.
      continue
    }

    envVars[provider.envVarName] = secret
    authJson[provider.id] = { type: "api_key", key: secret }
  }

  const baseUrlSecret = configured.get(
    OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
  )
  if (baseUrlSecret) {
    const baseUrlProvider = KNOWN_PROVIDERS.find(
      (entry) => entry.id === OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
    )
    if (baseUrlProvider) {
      envVars[baseUrlProvider.envVarName] = baseUrlSecret
    }
  }

  const modelSecret = configured.get(OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID)
  if (modelSecret) {
    const modelProvider = KNOWN_PROVIDERS.find(
      (entry) => entry.id === OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID
    )
    if (modelProvider) {
      envVars[modelProvider.envVarName] = modelSecret
    }
  }

  const payload = { envVars, authJson }
  return {
    ...payload,
    fingerprint: fingerprintProviderSecrets(payload),
  }
}

export async function loadConfiguredProviderSecrets(
  userId: string | undefined
): Promise<Map<string, string>> {
  if (process.env.VERCEL === "1") {
    if (!userId) return new Map()
    return loadDecryptedUserProviderSecrets(userId)
  }

  const secrets = new Map<string, string>()
  if (userId) {
    const fromDb = await loadDecryptedUserProviderSecrets(userId).catch(
      () => new Map<string, string>()
    )
    for (const [providerId, value] of fromDb) {
      secrets.set(providerId, value)
    }
  }

  for (const providerId of LLM_PROVIDER_ENV_SCRUB_IDS) {
    if (secrets.has(providerId)) continue
    const provider = KNOWN_PROVIDERS.find((entry) => entry.id === providerId)
    if (!provider) continue
    if (isEnvVarConfigured(provider.envVarName)) {
      secrets.set(providerId, process.env[provider.envVarName]!)
    }
  }

  if (!secrets.has(OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID)) {
    const baseUrlProvider = KNOWN_PROVIDERS.find(
      (entry) => entry.id === OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
    )
    if (baseUrlProvider && isEnvVarConfigured(baseUrlProvider.envVarName)) {
      secrets.set(
        OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
        process.env[baseUrlProvider.envVarName]!
      )
    }
  }

  if (!secrets.has(OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID)) {
    const modelProvider = KNOWN_PROVIDERS.find(
      (entry) => entry.id === OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID
    )
    if (modelProvider && isEnvVarConfigured(modelProvider.envVarName)) {
      secrets.set(
        OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
        process.env[modelProvider.envVarName]!
      )
    }
  }

  return secrets
}

const INFRA_PROVIDER_IDS = new Set<string>(PROTOCOL_INFRA_PROVIDER_IDS)
