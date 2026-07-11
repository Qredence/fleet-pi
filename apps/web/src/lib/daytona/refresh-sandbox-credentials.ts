import {
  clearSandboxAuthFingerprint,
  ensureUserCredentials,
} from "./sandbox-prepare"
import { loadSandboxProviderSecrets } from "./sandbox-provider-secrets"
import { getCachedUserSandbox, getUserSandbox } from "./user-sandbox"

export async function refreshSandboxProviderCredentials(
  userId: string,
  apiKey?: string
) {
  const handle =
    getCachedUserSandbox(userId) ?? (await getUserSandbox({ userId, apiKey }))
  const secrets = await loadSandboxProviderSecrets(userId)
  clearSandboxAuthFingerprint(userId)
  await ensureUserCredentials(handle.sandbox, secrets, userId)
}
