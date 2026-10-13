import { resolveDaytonaRuntimeApiKey } from "../pi/runtime/user-provider-secrets"
import { resolveUserSandboxContext } from "./resolve-user-sandbox-context"
import { getCachedUserSandbox, getInFlightUserSandbox } from "./user-sandbox"
import type { UserSandboxHandle } from "./user-sandbox"

export const SANDBOX_WARMUP_TIMEOUT_MS = 15_000

export const SANDBOX_WARMING_MESSAGE =
  "Your Daytona sandbox is still warming up. Retry in a moment."

export type ReadySandbox =
  | { status: "ready"; handle: UserSandboxHandle }
  | { status: "warming" }
  | { status: "missing" }

export type ResolveReadySandboxDeps = {
  timeoutMs?: number
  resolveApiKey?: (userId: string) => Promise<string | undefined>
  startWarmUp?: (input: {
    userId: string
    apiKey: string
  }) => Promise<UserSandboxHandle>
}

export async function resolveReadySandbox(
  userId: string,
  deps: ResolveReadySandboxDeps = {}
): Promise<ReadySandbox> {
  const cached = getCachedUserSandbox(userId)
  if (cached) return { status: "ready", handle: cached }

  const timeoutMs = deps.timeoutMs ?? SANDBOX_WARMUP_TIMEOUT_MS
  const inFlight = getInFlightUserSandbox(userId)
  if (inFlight) return settleHandle(inFlight, timeoutMs)

  const resolveApiKey = deps.resolveApiKey ?? resolveDaytonaRuntimeApiKey
  const apiKey = await resolveApiKey(userId)
  if (!apiKey) return { status: "missing" }

  const startWarmUp = deps.startWarmUp ?? startUserSandboxWarmUp
  const started = startWarmUp({ userId, apiKey })
  void started.catch(() => {
    // The caller only waits until the timeout. A later rejection must not
    // surface as an unhandled rejection.
  })
  return settleHandle(started, timeoutMs)
}

async function startUserSandboxWarmUp(input: {
  userId: string
  apiKey: string
}) {
  const context = await resolveUserSandboxContext({
    userId: input.userId,
    apiKey: input.apiKey,
    surface: "chat",
  })
  return context.handle
}

async function settleHandle(
  pending: Promise<UserSandboxHandle>,
  timeoutMs: number
): Promise<ReadySandbox> {
  try {
    const handle = await withTimeout(pending, timeoutMs)
    if (handle === "timeout") return { status: "warming" }
    return { status: "ready", handle }
  } catch {
    return { status: "missing" }
  }
}

function withTimeout<T>(pending: Promise<T>, timeoutMs: number) {
  return new Promise<T | "timeout">((resolve, reject) => {
    const timer = setTimeout(() => resolve("timeout"), timeoutMs)
    pending.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}
