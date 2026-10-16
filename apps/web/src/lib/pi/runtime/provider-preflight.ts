import { isGatewayHost } from "./openai-chat-completions-url"
import type { AgentSession } from "@earendil-works/pi-coding-agent"

const NEON_AI_GATEWAY_TOKEN_PREFIX = "nt_live_"

/**
 * Returns a user-facing reason when `apiKey` is a Neon AI Gateway token but
 * `model` targets a non-Neon endpoint. Such a request always fails with 401
 * and sends the platform token to a third party.
 */
export function describeMisroutedGatewayToken(
  model: { provider: string; baseUrl: string },
  apiKey: string | undefined
): string | undefined {
  if (!apiKey?.trim().startsWith(NEON_AI_GATEWAY_TOKEN_PREFIX)) return undefined
  if (isGatewayHost(model.baseUrl)) return undefined

  return (
    `The "${model.provider}" provider uses a Neon AI Gateway token as its API key. ` +
    `Fleet Pi did not send the request, because ${safeHost(model.baseUrl)} does not accept this token. ` +
    `Use the Neon AI Gateway through the "openai-chat-completions" provider, ` +
    `or set a "${model.provider}" API key in Settings > Providers.`
  )
}

/**
 * Checks the credential that the next turn will use. Throws when the request
 * cannot succeed, so the turn fails before Fleet Pi calls the provider.
 */
export async function assertProviderCredentialsUsable(
  session: Pick<AgentSession, "model" | "modelRuntime">
) {
  const model = session.model
  if (!model) return

  // Auth resolution failures stay with Pi, which reports them on the turn.
  const resolution = await session.modelRuntime
    .getAuth(model)
    .catch(() => undefined)
  const reason = describeMisroutedGatewayToken(
    {
      provider: model.provider,
      baseUrl: resolution?.auth.baseUrl ?? model.baseUrl,
    },
    resolution?.auth.apiKey
  )
  if (reason) throw new Error(reason)
}

function safeHost(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname
  } catch {
    return "this provider"
  }
}
