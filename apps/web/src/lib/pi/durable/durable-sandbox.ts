import { createDaytonaClient, getSandboxStatus } from "../../daytona/client"
import {
  getCachedUserSandbox,
  getSandboxName,
  getVolumeName,
} from "../../daytona/user-sandbox"
import { resolveDaytonaRuntimeApiKey } from "../runtime/user-provider-secrets"
import type { Sandbox } from "@daytona/sdk"

const LOOKUP_TIMEOUT_MS = 4000

export type HostedSandboxStatus = {
  keyPresent: boolean
  sandboxReady: boolean
  volumeName: string
  sandboxId?: string
  apiKey?: string
  apiUrl?: string
  target?: string
}

export async function readHostedSandboxStatus(
  userId: string
): Promise<HostedSandboxStatus> {
  const volumeName = getVolumeName(userId)
  const apiKey = await resolveDaytonaRuntimeApiKey(userId)
  const apiUrl = process.env.DAYTONA_API_URL?.trim() || undefined
  const target = process.env.DAYTONA_TARGET?.trim() || undefined
  if (!apiKey) {
    return { keyPresent: false, sandboxReady: false, volumeName }
  }

  const base = {
    keyPresent: true,
    volumeName,
    apiKey,
    apiUrl,
    target,
  }

  const cached = getCachedUserSandbox(userId)
  if (cached?.sandboxId) {
    const started = await withTimeout(
      isSandboxStarted(cached.sandbox),
      LOOKUP_TIMEOUT_MS
    )
    if (started) {
      return {
        ...base,
        sandboxReady: true,
        sandboxId: cached.sandboxId,
      }
    }
  }

  const sandbox = await withTimeout(
    lookupSandbox(apiKey, userId),
    LOOKUP_TIMEOUT_MS
  )
  if (!sandbox) {
    return { ...base, sandboxReady: false }
  }

  return {
    ...base,
    sandboxReady: true,
    sandboxId: sandbox,
  }
}

async function isSandboxStarted(sandbox: Sandbox): Promise<boolean> {
  try {
    const status = await getSandboxStatus(sandbox)
    return status.state === "started"
  } catch {
    return false
  }
}

async function lookupSandbox(
  apiKey: string,
  userId: string
): Promise<string | undefined> {
  try {
    const client = createDaytonaClient(apiKey)
    const sandbox = await client.get(getSandboxName(userId))
    const status = await getSandboxStatus(sandbox)
    if (status.state !== "started") return undefined
    return sandbox.id || sandbox.name || undefined
  } catch {
    return undefined
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(undefined)
      }
    )
  })
}
