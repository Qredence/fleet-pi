import type { WorkspaceFileResponse } from "@workspace/hax-design/lib/pi/chat-protocol"

export async function loadWorkspaceFile(
  path: string
): Promise<WorkspaceFileResponse> {
  const response = await fetch(
    `/api/workspace/file?path=${encodeURIComponent(path)}`
  )
  const body: unknown = await response.json()
  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : "Unable to load workspace file."
    throw new Error(message)
  }
  return body as WorkspaceFileResponse
}
