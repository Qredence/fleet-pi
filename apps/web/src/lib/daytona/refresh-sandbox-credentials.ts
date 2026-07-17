import { resolveDaytonaRuntimeApiKey } from "../pi/runtime/user-provider-secrets"
import {
  clearSandboxAuthFingerprint,
  ensureUserCredentials,
} from "./sandbox-prepare"
import {
  buildPlaintextSandboxCredentials,
  loadConfiguredProviderSecrets,
} from "./sandbox-provider-secrets"
import {
  getCachedUserSandbox,
  recreateUserSandboxForSecrets,
} from "./user-sandbox"
import { fingerprintDaytonaSecretsConfig } from "./sync-daytona-secrets"

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

  if (fingerprint !== (handle.daytonaSecretsFingerprint ?? "")) {
    await recreateUserSandboxForSecrets({ userId, apiKey })
    return
  }

  const plaintext = buildPlaintextSandboxCredentials(
    configured,
    new Set(handle.daytonaSecretEnvVars)
  )
  clearSandboxAuthFingerprint(userId)
  await ensureUserCredentials(handle.sandbox, plaintext, userId)
}
