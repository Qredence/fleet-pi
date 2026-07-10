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
import { findLatestSnapshot } from "./snapshot-config"
import type { Daytona, Sandbox } from "@daytona/sdk"

const SANDBOX_NAME_PREFIX = "fleet-pi-user-"
const VOLUME_NAME_PREFIX = "fleet-pi-ws-"
const SESSION_VOLUME_PREFIX = "fleet-pi-sessions-"
const MANAGED_BY_LABEL = "fleet-pi"
const WORKSPACE_MOUNT_PATH = "/home/daytona/fleet-pi/agent-workspace"
const SESSION_MOUNT_PATH = "/home/daytona/fleet-pi/.fleet"
const DEFAULT_REPOSITORY_URL = "https://github.com/Qredence/fleet-pi.git"

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
}

const userSandboxes = new Map<string, UserSandboxHandle>()
const userSandboxRequests = new Map<string, Promise<UserSandboxHandle>>()

export function isDaytonaEnabled(
  userId?: string,
  clientApiKey?: string
): boolean {
  return Boolean(userId) && Boolean(clientApiKey || process.env.DAYTONA_API_KEY)
}

export function getSandboxName(userId: string): string {
  return `${SANDBOX_NAME_PREFIX}${userId}`
}

export function getVolumeName(userId: string): string {
  return `${VOLUME_NAME_PREFIX}${userId}`
}

export function getSessionVolumeName(userId: string): string {
  return `${SESSION_VOLUME_PREFIX}${userId}`
}

export function isSessionPersistenceEnabled(): boolean {
  return process.env.FLEET_PI_PERSIST_SESSIONS === "true"
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
    if (healthy) return cached

    userSandboxes.delete(config.userId)
  }

  const client = createDaytonaClient(config.apiKey)
  const volumeName = getVolumeName(config.userId)
  const volume = await getOrCreateVolume(client, volumeName)

  const sandboxName = getSandboxName(config.userId)

  const existing = await findExistingSandbox(client, sandboxName)
  let sandbox: Sandbox

  if (existing) {
    if (!isManagedSandboxForUser(existing, config.userId)) {
      throw new Error(
        `Refusing to use unmanaged Daytona sandbox named ${sandboxName}`
      )
    }
    sandbox = existing
    if (existing.state === "stopped" || existing.state === "archived") {
      await startSandbox(existing)
    }
  } else {
    const volumes = [
      createVolumeMount({
        volumeId: volume.id,
        mountPath: WORKSPACE_MOUNT_PATH,
      }),
    ]

    if (isSessionPersistenceEnabled()) {
      const sessionVolume = await getOrCreateVolume(
        client,
        getSessionVolumeName(config.userId)
      )
      volumes.push(
        createVolumeMount({
          volumeId: sessionVolume.id,
          mountPath: SESSION_MOUNT_PATH,
        })
      )
    }

    const snapshot = await findLatestSnapshot(client)
    sandbox = await createSandbox(client, {
      name: sandboxName,
      snapshot: snapshot ?? undefined,
      labels: buildLabels(config),
      volumes,
      cpu: config.cpu,
      memory: config.memory,
      disk: config.disk,
      autoStopInterval: 30,
    })
  }
  await ensureRepositoryCheckout(sandbox)

  const handle: UserSandboxHandle = {
    sandbox,
    volumeId: volume.id,
    volumeName,
    sandboxId: sandbox.id,
    userId: config.userId,
  }

  userSandboxes.set(config.userId, handle)
  return handle
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

function buildLabels(config: UserSandboxConfig): Record<string, string> {
  const labels: Record<string, string> = {
    managedBy: MANAGED_BY_LABEL,
    userId: config.userId,
    createdAt: new Date().toISOString(),
  }
  if (config.userEmail) labels.email = config.userEmail
  return labels
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
  const labels = (sandbox as { labels?: Record<string, string> }).labels
  return labels?.managedBy === MANAGED_BY_LABEL && labels.userId === userId
}

async function ensureRepositoryCheckout(sandbox: Sandbox): Promise<void> {
  const repoUrl = resolveRepositoryUrl(process.env.FLEET_PI_REPOSITORY_URL)
  const command = [
    "set -e;",
    `if [ ! -d ${shellEscape(`${WORKSPACE_MOUNT_PATH}/.git`)} ]; then`,
    "if ! command -v git >/dev/null 2>&1; then",
    "apt-get update && apt-get install -y git ca-certificates;",
    "fi;",
    "tmpdir=$(mktemp -d);",
    `git clone --depth 1 ${shellEscape(repoUrl)} "$tmpdir";`,
    `mkdir -p ${shellEscape(WORKSPACE_MOUNT_PATH)};`,
    `cp -a "$tmpdir"/. ${shellEscape(WORKSPACE_MOUNT_PATH)}/;`,
    'rm -rf "$tmpdir";',
    "fi;",
    `mkdir -p ${shellEscape(WORKSPACE_MOUNT_PATH)} ${shellEscape(SESSION_MOUNT_PATH)};`,
  ].join(" ")
  const result = await executeCommand(sandbox, command)
  if (result.exitCode !== 0) {
    throw new Error(`Failed to prepare Daytona repository: ${result.result}`)
  }
}

function resolveRepositoryUrl(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return DEFAULT_REPOSITORY_URL

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error("FLEET_PI_REPOSITORY_URL must be an HTTPS URL")
  }

  if (url.protocol !== "https:") {
    throw new Error("FLEET_PI_REPOSITORY_URL must be an HTTPS URL")
  }

  return url.toString()
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
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
