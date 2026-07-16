import type { WorkspaceFileResponse } from "@workspace/pi-protocol/chat-protocol"

export async function loadWorkspaceFile(
  path: string
): Promise<WorkspaceFileResponse> {
  const response = await fetch(
    `/api/workspace/file?path=${encodeURIComponent(path)}`
  )
  const text = await response.text()

  if (!response.ok) {
    let message = "Unable to load workspace file."
    try {
      const body: unknown = JSON.parse(text)
      if (
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
      ) {
        message = body.message
      }
    } catch {
      // Non-JSON error bodies fall back to the default message.
    }
    throw new Error(message)
  }

  return JSON.parse(text) as WorkspaceFileResponse
}
