import { getResponseStatus } from "./desktop/server"
import { getErrorMessage } from "./pi/server"
import type { Logger } from "pino"

export function wrapApiHandler(
  handler: () => Promise<Response>,
  options: { log?: Logger } = {}
): Promise<Response> {
  return handler().catch((error) => {
    options.log?.error({ error: getErrorMessage(error) }, "api handler failed")
    return Response.json(
      { message: getErrorMessage(error) },
      { status: getResponseStatus(error) }
    )
  })
}
