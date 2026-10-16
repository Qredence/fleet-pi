import {
  KNOWN_PROVIDERS,
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
} from "@workspace/pi-protocol/provider-catalog"
import { isCloudflareDeployment } from "../deployment/environment"
import { resolveDaytonaRuntimeApiKey } from "../pi/runtime/user-provider-secrets"
import {
  clearSandboxAuthFingerprint,
  ensureUserCredentials,
} from "./sandbox-prepare"
import {
  buildPlaintextSandboxCredentials,
  loadConfiguredProviderSecrets,
} from "./sandbox-provider-secrets"
import { isDaytonaSecretsEligibleProvider } from "./secret-hosts"
import {
  getCachedUserSandbox,
  recreateUserSandboxForSecrets,
} from "./user-sandbox"
import { fingerprintDaytonaSecretsConfig } from "./sync-daytona-secrets"

function hasUnmountedSecretsEligibleKey(
  configured: Map<string, string>,
  mountedSecretEnvVars: ReadonlySet<string>
) {
  const occBaseUrl = configured.get(
    OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
  )
  return KNOWN_PROVIDERS.some(
    (provider) =>
      isDaytonaSecretsEligibleProvider(provider, { occBaseUrl }) &&
      Boolean(configured.get(provider.id)?.trim()) &&
      !mountedSecretEnvVars.has(provider.envVarName)
  )
}

/**
 * Push the latest provider secrets into an already-running cached sandbox.
 * Secrets-backed API keys require sandbox recreate (create-time mount only).
 * Does not provision a sandbox — if none is cached, this is a no-op.
 */
export async function refreshSandboxProviderCredentials(userId: string) {
  const handle = getCachedUserSandbox(userId)
  if (!handle) return

  const apiKey = await resolveDaytonaRuntimeApiKey(userId)
  if (!apiKey) {
    return
  }

  const configured = await loadConfiguredProviderSecrets(userId)
  const fingerprint = fingerprintDaytonaSecretsConfig(configured)

  const mountedSecretEnvVars = new Set(handle.daytonaSecretEnvVars)
  if (
    fingerprint !== (handle.daytonaSecretsFingerprint ?? "") ||
    (isCloudflareDeployment() &&
      hasUnmountedSecretsEligibleKey(configured, mountedSecretEnvVars))
  ) {
    await recreateUserSandboxForSecrets({ userId, apiKey })
    return
  }

  const plaintext = buildPlaintextSandboxCredentials(
    configured,
    mountedSecretEnvVars
  )
  clearSandboxAuthFingerprint(userId)
  await ensureUserCredentials(handle.sandbox, plaintext, userId)
}
