import type { ChatSessionMetadata } from "@workspace/pi-protocol/chat-protocol"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { hydrateChatSession } from "@/lib/pi/server"
import { isCloudflareDeployment } from "@/lib/deployment/environment"
import { isDurableSessionId } from "@/lib/pi/durable/durable-session"
import { readHostedDurableSession } from "@/lib/pi/durable/hosted-agent-turn"

/**
 * Reads a hosted durable session when the metadata points at one, otherwise
 * hydrates the local Pi session. The 404 body is identical on both routes.
 */
export async function readOrHydrateSession(
  userId: string | undefined,
  metadata: ChatSessionMetadata
) {
  if (
    isCloudflareDeployment() &&
    userId &&
    isDurableSessionId(metadata.sessionId) &&
    !metadata.sessionFile
  ) {
    const durable = await readHostedDurableSession(userId, metadata.sessionId)
    if (!durable) {
      return Response.json({ message: "Session not found" }, { status: 404 })
    }
    return Response.json(durable)
  }

  return Response.json(
    await hydrateChatSession(resolveAppRuntimeContext(), metadata, { userId })
  )
}
