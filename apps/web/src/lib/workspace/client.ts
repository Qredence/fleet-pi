import { fetchValidatedJson } from "@/lib/pi/chat-fetch"
import { WorkspaceFileResponseSchema } from "@workspace/pi-protocol/chat-protocol.zod"

import type { WorkspaceFileResponse } from "@workspace/pi-protocol/chat-protocol"

export async function loadWorkspaceFile(
  path: string
): Promise<WorkspaceFileResponse> {
  return fetchValidatedJson(
    `/api/workspace/file?path=${encodeURIComponent(path)}`,
    WorkspaceFileResponseSchema
  )
}
