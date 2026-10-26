import handler from "@tanstack/react-start/server-entry"
import { enforceNamedEdgeRateLimit } from "@/lib/deployment/edge-rate-limit"
import { bindWorkerEnv, runInRequestScope } from "@/lib/runtime/request-scope"

export { UserPiDurable } from "@/lib/pi/durable/user-pi-durable"

/**
 * Cloudflare Workers entry (wrangler.jsonc `main`). Wraps TanStack Start's
 * handler so database pools are created per request (see request-scope.ts).
 * Named rate limits run before chat or auth handlers.
 */
export default {
  async fetch(request: Request, ...rest: Array<unknown>) {
    const limited = await enforceNamedEdgeRateLimit({
      request,
      env: rest[0] instanceof Object ? rest[0] : undefined,
    })
    if (limited) return limited

    return runInRequestScope(() => {
      bindWorkerEnv(rest[0])
      return (
        handler.fetch as (
          req: Request,
          ...args: Array<unknown>
        ) => Promise<Response>
      )(request, ...rest)
    })
  },
}
