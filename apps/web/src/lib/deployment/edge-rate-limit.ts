import { isCloudflareDeployment } from "./environment"

export const FLEET_PI_SIGN_IN_RATE_LIMIT = "FLEET_PI_SIGN_IN"
export const FLEET_PI_CHAT_START_RATE_LIMIT = "FLEET_PI_CHAT_START"

export const EDGE_RATE_LIMIT_RULES = {
  [FLEET_PI_SIGN_IN_RATE_LIMIT]: { limit: 10, periodSeconds: 60 },
  [FLEET_PI_CHAT_START_RATE_LIMIT]: { limit: 30, periodSeconds: 60 },
} as const

type RateLimitRuleName = keyof typeof EDGE_RATE_LIMIT_RULES

type RateLimitBinding = {
  limit: (options: { key: string }) => Promise<{ success: boolean }>
}

type MemoryBucket = { count: number; resetAt: number }

const MAX_MEMORY_BUCKETS = 2048
const memoryBuckets = new Map<string, MemoryBucket>()

function pruneMemoryBuckets(now: number) {
  for (const [key, bucket] of memoryBuckets) {
    if (now >= bucket.resetAt) {
      memoryBuckets.delete(key)
    }
  }
  while (memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
    const oldestKey = memoryBuckets.keys().next().value
    if (oldestKey === undefined) break
    memoryBuckets.delete(oldestKey)
  }
}

export function rateLimitRuleForRequest(
  request: Request
): RateLimitRuleName | undefined {
  if (request.method !== "POST") return undefined
  const { pathname } = new URL(request.url)
  if (
    pathname === "/api/chat" ||
    pathname === "/api/chat/new" ||
    pathname === "/api/chat/resume"
  ) {
    return FLEET_PI_CHAT_START_RATE_LIMIT
  }
  if (
    pathname.startsWith("/api/auth/") &&
    /sign-in|sign-up|callback/.test(pathname)
  ) {
    return FLEET_PI_SIGN_IN_RATE_LIMIT
  }
  return undefined
}

export async function enforceNamedEdgeRateLimit(input: {
  request: Request
  env?: object
  now?: number
  /**
   * Use the in-process bucket when this isolate has no Cloudflare rate-limit
   * binding. Worker requests keep the binding.
   */
  allowMemoryLimit?: boolean
}): Promise<Response | undefined> {
  const ruleName = rateLimitRuleForRequest(input.request)
  if (!ruleName) return undefined

  const key = clientKey(input.request)
  const binding = readBinding(input.env, ruleName)
  if (binding) {
    const result = await binding.limit({ key })
    if (!result.success) return tooManyRequests(ruleName)
    return undefined
  }

  if (
    (input.allowMemoryLimit || isCloudflareDeployment()) &&
    !memoryLimit(ruleName, key, input.now ?? Date.now())
  ) {
    return tooManyRequests(ruleName)
  }
  return undefined
}

function readBinding(
  env: object | undefined,
  ruleName: RateLimitRuleName
): RateLimitBinding | undefined {
  if (!env || !(ruleName in env)) return undefined
  const value = (env as Record<string, unknown>)[ruleName]
  if (
    value &&
    typeof value === "object" &&
    "limit" in value &&
    typeof value.limit === "function"
  ) {
    return value as RateLimitBinding
  }
  return undefined
}

function memoryLimit(ruleName: RateLimitRuleName, key: string, now: number) {
  const rule = EDGE_RATE_LIMIT_RULES[ruleName]
  const bucketKey = `${ruleName}:${key}`
  const current = memoryBuckets.get(bucketKey)
  if (!current || now >= current.resetAt) {
    if (memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
      pruneMemoryBuckets(now)
    }
    memoryBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + rule.periodSeconds * 1000,
    })
    return true
  }
  current.count += 1
  return current.count <= rule.limit
}

function clientKey(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  )
}

function tooManyRequests(ruleName: RateLimitRuleName) {
  return Response.json(
    { error: "rate-limited", rule: ruleName },
    { status: 429 }
  )
}

/** Test helper. */
export function resetEdgeRateLimitMemoryForTests() {
  memoryBuckets.clear()
}
