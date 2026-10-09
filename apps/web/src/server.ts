import handler from "@tanstack/react-start/server-entry"
import { runInRequestScope } from "@/lib/runtime/request-scope"

/**
 * Cloudflare Workers entry (wrangler.jsonc `main`). Wraps TanStack Start's
 * handler so database pools are created per request (see request-scope.ts).
 */
export default {
  fetch(request: Request, ...rest: Array<unknown>) {
    return runInRequestScope(() =>
      (
        handler.fetch as (
          req: Request,
          ...args: Array<unknown>
        ) => Promise<Response>
      )(request, ...rest)
    )
  },
}
