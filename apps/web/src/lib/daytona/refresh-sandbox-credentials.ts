import {
  clearSandboxAuthFingerprint,
  ensureUserCredentials,
} from "./sandbox-prepare"
import { loadSandboxProviderSecrets } from "./sandbox-provider-secrets"
import { getCachedUserSandbox } from "./user-sandbox"

/**
 * Push the latest provider secrets into an already-running cached sandbox.
 * Does not provision a sandbox — if none is cached, this is a no-op.
 */
export async function refreshSandboxProviderCredentials(userId: string) {
  const handle = getCachedUserSandbox(userId)
  if (!handle) return

  const secrets = await loadSandboxProviderSecrets(userId)
  clearSandboxAuthFingerprint(userId)
  await ensureUserCredentials(handle.sandbox, secrets, userId)
}
