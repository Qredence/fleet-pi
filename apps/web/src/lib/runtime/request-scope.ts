import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Per-request resource scope for Cloudflare Workers.
 *
 * Workers forbid sharing I/O objects (sockets, WebSockets, streams) between
 * requests: a module-scope Neon `Pool` created while serving request A hangs
 * or throws when request B reuses it. The Worker entry (src/server.ts) wraps
 * every request in `runInRequestScope`, and `requestScoped` hands out one
 * instance per request there. Outside a scope (Node, Vercel, tests) the
 * caller keeps its module-level singleton.
 */
const requestScope = new AsyncLocalStorage<Map<symbol, unknown>>()

/** True inside the Cloudflare Workers runtime (workerd). */
export function isCloudflareWorkersRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
  )
}

/** Scope only on Workers; Node keeps its resident module-level pools. */
export function runInRequestScope<T>(fn: () => T): T {
  if (!isCloudflareWorkersRuntime()) return fn()
  return requestScope.run(new Map(), fn)
}

export function isInRequestScope(): boolean {
  return requestScope.getStore() !== undefined
}

/** One `create()` result per request when in a request scope, else undefined. */
export function requestScoped<T>(key: symbol, create: () => T): T | undefined {
  const store = requestScope.getStore()
  if (!store) return undefined
  if (!store.has(key)) store.set(key, create())
  return store.get(key) as T
}
