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
import {
  fingerprintDaytonaSecretsConfig,
  syncDaytonaSecrets,
} from "./sync-daytona-secrets"
import type { DaytonaSecretsSyncResult } from "./sync-daytona-secrets"
import type { SandboxProviderSecrets } from "./sandbox-prepare"
import type { Daytona, Sandbox } from "@daytona/sdk"

const SANDBOX_NAME_PREFIX = "fleet-pi-user-"
const VOLUME_NAME_PREFIX = "fleet-pi-ws-"
const MANAGED_BY_LABEL = "fleet-pi"
export const WORKSPACE_MOUNT_PATH = SANDBOX_WORKSPACE_ROOT

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

const userSandboxes = new Map<string, UserSandboxHandle>()
const userSandboxRequests = new Map<string, Promise<UserSandboxHandle>>()

/**
 * Daytona is enabled when the caller has a userId and a resolved API key.
 * Pass the result of `resolveDaytonaRuntimeApiKey` as `clientApiKey`.
 * On Vercel, env `DAYTONA_API_KEY` alone must not enable Daytona (BYOK required).
 */
export function isDaytonaEnabled(
  userId?: string,
  clientApiKey?: string
): boolean {
  if (!userId) return false
  if (clientApiKey) return true
  if (process.env.VERCEL === "1") return false
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
  const client = createDaytonaClient(config.apiKey)
  const volumeName = getVolumeName(config.userId)
  const volume = await getOrCreateVolume(client, volumeName)
  const configured = await loadConfiguredProviderSecrets(config.userId)
  const daytonaSecrets = await syncDaytonaSecrets(client, configured)
  const mountedSecretEnvVars = new Set(Object.keys(daytonaSecrets.secrets))
  const providerSecrets = buildPlaintextSandboxCredentials(
    configured,
    mountedSecretEnvVars
  )

  const sandboxName = getSandboxName(config.userId)

  const existing = await findExistingSandbox(client, sandboxName)
  let sandbox: Sandbox

  if (existing) {
    if (!isManagedSandboxForUser(existing, config.userId)) {
      throw new Error(
        `Refusing to use unmanaged Daytona sandbox named ${sandboxName}`
      )
    }

    // Old sandboxes may still mount the full repo at /home/daytona/fleet-pi.
    // Volumes cannot be remounted in place — recreate the sandbox (keep volume).
    // Also recreate when Secrets map is non-empty so placeholders remount
    // (Daytona secrets attach only at create time).
    const needsRemount = !(await hasAgentWorkspaceOnlyMount(existing))
    const needsSecretsRemount = shouldRecreateForSecretsState(
      existing,
      daytonaSecrets
    )

    if (needsRemount || needsSecretsRemount) {
      await deleteSandbox(existing)
      sandbox = await createUserSandboxInstance(client, {
        sandboxName,
        volumeId: volume.id,
        labels: buildLabels(config, daytonaSecrets.fingerprint),
        envVars: providerSecrets.envVars,
        secrets: daytonaSecrets.secrets,
        cpu: config.cpu,
        memory: config.memory,
        disk: config.disk,
      })
    } else {
      sandbox = existing
      if (existing.state === "stopped" || existing.state === "archived") {
        await startSandbox(existing)
      }
    }
  } else {
    sandbox = await createUserSandboxInstance(client, {
      sandboxName,
      volumeId: volume.id,
      labels: buildLabels(config, daytonaSecrets.fingerprint),
      envVars: providerSecrets.envVars,
      secrets: daytonaSecrets.secrets,
      cpu: config.cpu,
      memory: config.memory,
      disk: config.disk,
    })
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

  userSandboxes.set(config.userId, handle)
  return handle
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

export function clearSandboxCache(): void {
  userSandboxes.clear()
  userSandboxRequests.clear()
}

export function clearUserSandboxCache(userId: string): void {
  userSandboxes.delete(userId)
  userSandboxRequests.delete(userId)
}

function buildLabels(
  config: UserSandboxConfig,
  secretsFingerprint?: string
): Record<string, string> {
  const labels: Record<string, string> = {
    managedBy: MANAGED_BY_LABEL,
    userId: config.userId,
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
  try {
    const status = await getSandboxStatus(sandbox)
    return status.state === "started"
  } catch {
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
