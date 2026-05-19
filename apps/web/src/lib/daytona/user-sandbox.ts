import {
  createDaytonaClient,
  createSandbox,
  createVolumeMount,
  deleteSandbox,
  getOrCreateVolume,
  getSandboxStatus,
  startSandbox,
  stopSandbox,
} from "./client"
import { findLatestSnapshot } from "./snapshot-config"
import type { Daytona, Sandbox } from "@daytonaio/sdk"

const SANDBOX_NAME_PREFIX = "fleet-pi-user-"
const VOLUME_NAME_PREFIX = "fleet-pi-ws-"
const SESSION_VOLUME_PREFIX = "fleet-pi-sessions-"
const MANAGED_BY_LABEL = "fleet-pi"
const WORKSPACE_MOUNT_PATH = "/home/daytona/fleet-pi/agent-workspace"
const SESSION_MOUNT_PATH = "/home/daytona/fleet-pi/.fleet"

export interface UserSandboxConfig {
  userId: string
  userEmail?: string
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

export function isDaytonaEnabled(userId?: string): boolean {
  return Boolean(userId) && Boolean(process.env.DAYTONA_API_KEY)
}

export function getSandboxName(userId: string): string {
  return `${SANDBOX_NAME_PREFIX}${userId}`
}

export function getVolumeName(userId: string): string {
  return `${VOLUME_NAME_PREFIX}${userId}`
}

function getSessionVolumeName(userId: string): string {
  return `${SESSION_VOLUME_PREFIX}${userId}`
}

export function isSessionPersistenceEnabled(): boolean {
  return process.env.FLEET_PI_PERSIST_SESSIONS === "true"
}

export async function getUserSandbox(
  config: UserSandboxConfig
): Promise<UserSandboxHandle> {
  const cached = userSandboxes.get(config.userId)
  if (cached) {
    const healthy = await isSandboxHealthy(cached.sandbox)
    if (healthy) return cached

    userSandboxes.delete(config.userId)
  }

  const client = createDaytonaClient()
  const volumeName = getVolumeName(config.userId)
  const volume = await getOrCreateVolume(client, volumeName)

  const sandboxName = getSandboxName(config.userId)

  const existing = await findExistingSandbox(client, sandboxName)
  let sandbox: Sandbox

  if (existing) {
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
