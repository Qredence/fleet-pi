import {
  KNOWN_PROVIDERS,
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
} from "@workspace/pi-protocol/provider-catalog"
import {
  createDaytonaClient,
  createSandbox,
  createVolumeMount,
  deleteSandbox,
  executeCommand,
  getOrCreateVolume,
  getSandboxStatus,
  startSandbox,
  stopSandbox,
} from "./client"
import {
  LEGACY_SANDBOX_ROOT,
  SANDBOX_WORKSPACE_ROOT,
  prepareSandboxLayout,
  resolveRepositoryUrl,
  syncSandboxProviderCredentials,
} from "./sandbox-prepare"
import {
  buildPlaintextSandboxCredentials,
  loadConfiguredProviderSecrets,
  loadSandboxProviderSecrets,
} from "./sandbox-provider-secrets"
import { findLatestSnapshot } from "./snapshot-config"
import { isDaytonaSecretsEligibleProvider } from "./secret-hosts"
import {
  fingerprintDaytonaSecretsConfig,
  syncDaytonaSecrets,
} from "./sync-daytona-secrets"
import type { DaytonaSecretsSyncResult } from "./sync-daytona-secrets"
import type { SandboxProviderSecrets } from "./sandbox-prepare"
import type { Daytona, Sandbox } from "@daytona/sdk"
import { DaytonaCredentialRequiredError } from "@/lib/app-runtime"
import { isCloudflareDeployment } from "@/lib/deployment/environment"
import { hostedEndUserSandboxRequiresByok } from "@/lib/pi/runtime/user-provider-secrets"

const SANDBOX_NAME_PREFIX = "fleet-pi-user-"
const VOLUME_NAME_PREFIX = "fleet-pi-ws-"
const MANAGED_BY_LABEL = "fleet-pi"
export const WORKSPACE_MOUNT_PATH = SANDBOX_WORKSPACE_ROOT

// Cache sandbox health checks with 30-second TTL to eliminate network round-trips
const sandboxHealthCache = new Map<
  string,
  { healthy: boolean; cachedAt: number }
>()
const SANDBOX_HEALTH_TTL_MS = 30_000

export interface UserSandboxConfig {
  userId: string
  userEmail?: string
  apiKey?: string
  cpu?: number
  memory?: number
  disk?: number
}

export interface UserSandboxHandle {
  sandbox: Sandbox
  volumeId: string
  volumeName: string
  sandboxId: string
  userId: string
  /** Fingerprint of Daytona Secrets-backed values mounted at create time. */
  daytonaSecretsFingerprint?: string
  /** Env var names mounted via Daytona Secrets at sandbox create (if any). */
  daytonaSecretEnvVars: Array<string>
}

const MAX_LOCAL_SANDBOXES = 32
const SANDBOX_IDLE_MS = 15 * 60 * 1000
const userSandboxes = new Map<string, UserSandboxHandle>()
const userSandboxRequests = new Map<string, Promise<UserSandboxHandle>>()
const sandboxTouchedAt = new Map<string, number>()

/**
 * Daytona is enabled when the caller has a userId and a resolved API key.
 * Pass the result of `resolveDaytonaRuntimeApiKey` as `clientApiKey`.
 * On Cloudflare, only user BYOK enables Daytona — never org env keys.
 * Local/dev may use `DAYTONA_API_KEY` when no explicit client key is passed.
 */
export function isDaytonaEnabled(
  userId?: string,
  clientApiKey?: string
): boolean {
  if (!userId) return false
  if (clientApiKey) return true
  if (hostedEndUserSandboxRequiresByok()) return false
  return Boolean(process.env.DAYTONA_API_KEY)
}

export function getSandboxName(userId: string): string {
  return `${SANDBOX_NAME_PREFIX}${userId}`
}

export function getVolumeName(userId: string): string {
  return `${VOLUME_NAME_PREFIX}${userId}`
}

export async function getUserSandbox(
  config: UserSandboxConfig
): Promise<UserSandboxHandle> {
  const inFlight = userSandboxRequests.get(config.userId)
  if (inFlight) return inFlight

  const request = resolveUserSandbox(config).finally(() => {
    userSandboxRequests.delete(config.userId)
  })
  userSandboxRequests.set(config.userId, request)
  return request
}

async function resolveUserSandbox(
  config: UserSandboxConfig
): Promise<UserSandboxHandle> {
  const cached = userSandboxes.get(config.userId)
  if (cached) {
    const healthy = await isSandboxHealthy(cached.sandbox)
    if (healthy) {
      const recreated = await maybeRecreateForSecretsChange(cached, config)
      if (recreated) return recreated
      await syncSandboxCredentialsOnly(cached.sandbox, config.userId, {
        mountedSecretEnvVars: new Set(cached.daytonaSecretEnvVars),
      })
      return cached
    }

    userSandboxes.delete(config.userId)
  }

  return provisionUserSandbox(config)
}

/**
 * Recreate the user's sandbox (keep volume) so Daytona Secrets remount.
 * Used when Secrets-backed credentials change on a live sandbox.
 */
export async function recreateUserSandboxForSecrets(
  config: UserSandboxConfig
): Promise<UserSandboxHandle> {
  const inFlight = userSandboxRequests.get(config.userId)
  if (inFlight) return inFlight

  const request = (async () => {
    userSandboxes.delete(config.userId)
    const client = createDaytonaClient(config.apiKey)
    const sandboxName = getSandboxName(config.userId)
    const existing = await findExistingSandbox(client, sandboxName)
    if (existing && isManagedSandboxForUser(existing, config.userId)) {
      await deleteSandbox(existing)
    }
    return provisionUserSandbox(config)
  })().finally(() => {
    userSandboxRequests.delete(config.userId)
  })

  userSandboxRequests.set(config.userId, request)
  return request
}

async function provisionUserSandbox(
  config: UserSandboxConfig
): Promise<UserSandboxHandle> {
  if (hostedEndUserSandboxRequiresByok() && !config.apiKey?.trim()) {
    throw new DaytonaCredentialRequiredError()
  }

  const client = createDaytonaClient(config.apiKey)
  const volumeName = getVolumeName(config.userId)
  const volume = await getOrCreateVolume(client, volumeName)
  const configured = await loadConfiguredProviderSecrets(config.userId)
  const daytonaSecrets = await syncDaytonaSecrets(client, configured)
  assertCloudflareSecretsMount(configured, daytonaSecrets)
  const mountedSecretEnvVars = new Set(Object.keys(daytonaSecrets.secrets))
  const providerSecrets = buildPlaintextSandboxCredentials(
    configured,
    mountedSecretEnvVars
  )

  const sandboxName = getSandboxName(config.userId)

  const create = () =>
    createUserSandboxInstance(client, {
      sandboxName,
      volumeId: volume.id,
      labels: buildLabels(config, daytonaSecrets.fingerprint),
      envVars: providerSecrets.envVars,
      secrets: daytonaSecrets.secrets,
      cpu: config.cpu,
      memory: config.memory,
      disk: config.disk,
    })

  async function reuseOrRecreate(existing: Sandbox): Promise<Sandbox> {
    if (!isManagedSandboxForUser(existing, config.userId)) {
      throw new Error(
        `Refusing to use unmanaged Daytona sandbox named ${sandboxName}`
      )
    }

    // Volumes and Secrets cannot be remounted in place. Keep the user's
    // volume and recreate sandboxes with stale mounts or an error state.
    const needsRemount =
      !(await hasAgentWorkspaceOnlyMount(existing)) ||
      existing.volumes?.[0]?.volumeId !== volume.id
    const needsSecretsRemount = shouldRecreateForSecretsState(
      existing,
      daytonaSecrets
    )
    const needsErrorRecreate = existing.state === "error"

    if (needsRemount || needsSecretsRemount || needsErrorRecreate) {
      await deleteSandbox(existing)
      return create()
    }

    if (existing.state === "stopped" || existing.state === "archived") {
      await startSandbox(existing)
    }
    return existing
  }

  const existing = await findExistingSandbox(client, sandboxName)
  let sandbox: Sandbox
  if (existing) {
    sandbox = await reuseOrRecreate(existing)
  } else {
    try {
      sandbox = await create()
    } catch (error) {
      const raced = await findExistingSandbox(client, sandboxName)
      if (!raced) throw error
      try {
        sandbox = await reuseOrRecreate(raced)
      } catch {
        throw error
      }
    }
  }

  await prepareSandboxForUser(sandbox, config.userId, providerSecrets)

  const mountedEnvVars = Object.keys(daytonaSecrets.secrets)
  const handle: UserSandboxHandle = {
    sandbox,
    volumeId: volume.id,
    volumeName,
    sandboxId: sandbox.id,
    userId: config.userId,
    daytonaSecretsFingerprint:
      daytonaSecrets.mode === "mounted"
        ? daytonaSecrets.fingerprint
        : undefined,
    daytonaSecretEnvVars: mountedEnvVars,
  }

  rememberUserSandbox(config.userId, handle)
  return handle
}

function rememberUserSandbox(userId: string, handle: UserSandboxHandle) {
  const now = Date.now()
  for (const [cachedId, touchedAt] of sandboxTouchedAt) {
    if (now - touchedAt < SANDBOX_IDLE_MS) continue
    userSandboxes.delete(cachedId)
    sandboxTouchedAt.delete(cachedId)
  }
  while (userSandboxes.size >= MAX_LOCAL_SANDBOXES) {
    const oldest = [...sandboxTouchedAt.entries()]
      .sort((left, right) => left[1] - right[1])
      .at(0)
    if (!oldest) break
    userSandboxes.delete(oldest[0])
    sandboxTouchedAt.delete(oldest[0])
  }
  userSandboxes.set(userId, handle)
  sandboxTouchedAt.set(userId, now)
}

async function maybeRecreateForSecretsChange(
  cached: UserSandboxHandle,
  config: UserSandboxConfig
): Promise<UserSandboxHandle | undefined> {
  const configured = await loadConfiguredProviderSecrets(config.userId)
  const fingerprint = fingerprintDaytonaSecretsConfig(configured)

  if (fingerprint === (cached.daytonaSecretsFingerprint ?? "")) {
    return undefined
  }

  return recreateUserSandboxForSecrets(config)
}

async function syncSandboxCredentialsOnly(
  sandbox: Sandbox,
  userId: string,
  options?: {
    providerSecrets?: SandboxProviderSecrets
    mountedSecretEnvVars?: ReadonlySet<string>
  }
) {
  const secrets =
    options?.providerSecrets ??
    buildPlaintextSandboxCredentials(
      await loadConfiguredProviderSecrets(userId),
      options?.mountedSecretEnvVars ?? new Set()
    )
  await syncSandboxProviderCredentials(sandbox, secrets, userId)
}

async function prepareSandboxForUser(
  sandbox: Sandbox,
  userId: string,
  providerSecrets?: SandboxProviderSecrets
) {
  const secrets = providerSecrets ?? (await loadSandboxProviderSecrets(userId))
  const repoUrl = resolveRepositoryUrl(process.env.FLEET_PI_REPOSITORY_URL)
  await prepareSandboxLayout(sandbox, repoUrl)
  await syncSandboxProviderCredentials(sandbox, secrets, userId)
}

export async function releaseUserSandbox(userId: string): Promise<void> {
  const handle = userSandboxes.get(userId)
  if (!handle) return

  try {
    await stopSandbox(handle.sandbox)
  } finally {
    userSandboxes.delete(userId)
  }
}

export async function destroyUserSandbox(userId: string): Promise<void> {
  const handle = userSandboxes.get(userId)
  if (!handle) return

  try {
    await deleteSandbox(handle.sandbox)
  } finally {
    userSandboxes.delete(userId)
  }
}

export function getCachedUserSandbox(
  userId: string
): UserSandboxHandle | undefined {
  return userSandboxes.get(userId)
}

/** Warm-up already started for this user, without beginning a new one. */
export function getInFlightUserSandbox(
  userId: string
): Promise<UserSandboxHandle> | undefined {
  return userSandboxRequests.get(userId)
}

export function clearSandboxCache(): void {
  userSandboxes.clear()
  userSandboxRequests.clear()
  sandboxTouchedAt.clear()
}

export function clearUserSandboxCache(userId: string): void {
  userSandboxes.delete(userId)
  userSandboxRequests.delete(userId)
  sandboxTouchedAt.delete(userId)
}

function buildLabels(
  config: UserSandboxConfig,
  secretsFingerprint?: string
): Record<string, string> {
  const labels: Record<string, string> = {
    managedBy: MANAGED_BY_LABEL,
    userId: config.userId,
    volumeName: getVolumeName(config.userId),
    createdAt: new Date().toISOString(),
  }
  if (config.userEmail) labels.email = config.userEmail
  if (secretsFingerprint) {
    labels.daytonaSecretsFp = secretsFingerprint.slice(0, 16)
  }
  return labels
}

function getSandboxLabels(
  sandbox: Sandbox
): Record<string, string> | undefined {
  return (sandbox as { labels?: Record<string, string> }).labels
}

function sandboxHadSecretsMount(sandbox: Sandbox): boolean {
  return Boolean(getSandboxLabels(sandbox)?.daytonaSecretsFp)
}

function existingHasMatchingSecretsLabel(
  sandbox: Sandbox,
  fingerprint: string
): boolean {
  const labels = getSandboxLabels(sandbox)
  const short = fingerprint.slice(0, 16)
  if (!short) return true
  return labels?.daytonaSecretsFp === short
}

function assertCloudflareSecretsMount(
  configured: Map<string, string>,
  daytonaSecrets: DaytonaSecretsSyncResult
) {
  if (!isCloudflareDeployment()) return
  const occBaseUrl = configured.get(
    OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
  )
  const missingMount = KNOWN_PROVIDERS.some(
    (provider) =>
      isDaytonaSecretsEligibleProvider(provider, { occBaseUrl }) &&
      configured.get(provider.id)?.trim() &&
      !daytonaSecrets.secrets[provider.envVarName]
  )
  if (!missingMount) return
  throw new Error(
    "Daytona Secrets API is required to mount provider keys on Cloudflare. Refusing to write plaintext credentials."
  )
}

function shouldRecreateForSecretsState(
  existing: Sandbox,
  daytonaSecrets: DaytonaSecretsSyncResult
): boolean {
  const mountedNow = Object.keys(daytonaSecrets.secrets).length > 0
  const hadMount = sandboxHadSecretsMount(existing)
  const fpMatch = existingHasMatchingSecretsLabel(
    existing,
    daytonaSecrets.fingerprint
  )

  if (mountedNow) {
    return !fpMatch
  }

  if (daytonaSecrets.mode === "plaintext-fallback" && hadMount) {
    return true
  }

  if (!fpMatch && hadMount) {
    return true
  }

  return false
}

async function isSandboxHealthy(sandbox: Sandbox): Promise<boolean> {
  const sandboxId = sandbox.id || sandbox.name
  if (!sandboxId) return false

  // Lazy cleanup of stale entries before processing current one
  const now = Date.now()
  for (const [id, cached] of sandboxHealthCache.entries()) {
    if (now - cached.cachedAt >= SANDBOX_HEALTH_TTL_MS * 2) {
      sandboxHealthCache.delete(id)
    }
  }

  // Check cache first
  const cached = sandboxHealthCache.get(sandboxId)
  if (cached && Date.now() - cached.cachedAt < SANDBOX_HEALTH_TTL_MS) {
    return cached.healthy
  }

  try {
    const status = await getSandboxStatus(sandbox)
    const healthy = status.state === "started"
    // Update cache
    sandboxHealthCache.set(sandboxId, { healthy, cachedAt: Date.now() })
    return healthy
  } catch {
    // Cache the failure too
    sandboxHealthCache.set(sandboxId, { healthy: false, cachedAt: Date.now() })
    return false
  }
}

function isManagedSandboxForUser(sandbox: Sandbox, userId: string): boolean {
  const labels = getSandboxLabels(sandbox)
  return labels?.managedBy === MANAGED_BY_LABEL && labels.userId === userId
}

async function findExistingSandbox(
  client: Daytona,
  name: string
): Promise<Sandbox | undefined> {
  try {
    return await client.get(name)
  } catch {
    return undefined
  }
}

async function createUserSandboxInstance(
  client: Daytona,
  input: {
    sandboxName: string
    volumeId: string
    labels: Record<string, string>
    envVars: Record<string, string>
    secrets?: Record<string, string>
    cpu?: number
    memory?: number
    disk?: number
  }
): Promise<Sandbox> {
  const volumes = [
    createVolumeMount({
      volumeId: input.volumeId,
      mountPath: WORKSPACE_MOUNT_PATH,
    }),
  ]

  const snapshot = await findLatestSnapshot(client)
  return createSandbox(client, {
    name: input.sandboxName,
    snapshot: snapshot ?? undefined,
    labels: input.labels,
    volumes,
    envVars: input.envVars,
    secrets: input.secrets,
    cpu: input.cpu,
    memory: input.memory,
    disk: input.disk,
    autoStopInterval: 30,
  })
}

/**
 * True when the sandbox has exactly one volume mount at agent-workspace.
 * Exported for unit tests.
 */
export async function hasAgentWorkspaceOnlyMount(
  sandbox: Sandbox
): Promise<boolean> {
  try {
    if (!sandbox.volumes) {
      await sandbox.refreshData()
    }
  } catch {
    // Fall through to filesystem probe when metadata is unavailable.
  }

  const volumes = sandbox.volumes
  if (volumes && volumes.length > 0) {
    return (
      volumes.length === 1 && volumes[0]?.mountPath === WORKSPACE_MOUNT_PATH
    )
  }

  // Metadata missing: treat presence of the legacy tree as a wrong layout.
  try {
    const result = await executeCommand(
      sandbox,
      [
        "set +e",
        `if [ -e '${LEGACY_SANDBOX_ROOT}' ]; then echo legacy;`,
        `elif [ ! -d '${SANDBOX_WORKSPACE_ROOT}' ]; then echo missing;`,
        `else echo ok; fi`,
      ].join(" ")
    )
    return result.exitCode === 0 && result.result.trim().includes("ok")
  } catch {
    return false
  }
}
