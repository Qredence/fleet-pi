import { WorkspaceFileResponseSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import type { WorkspaceFileResponse } from "@workspace/pi-protocol/chat-protocol"
import { fetchValidatedJson } from "@/lib/pi/chat-fetch"

export async function loadWorkspaceFile(
  path: string
): Promise<WorkspaceFileResponse> {
  return fetchValidatedJson(
    `/api/workspace/file?path=${encodeURIComponent(path)}`,
    WorkspaceFileResponseSchema
  )
}
