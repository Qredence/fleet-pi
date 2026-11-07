import type { SandboxRuntimeStatus } from "@workspace/hax-design/components/fleet-pi/layout/right-panel-context"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export async function loadSandboxRuntimeStatus(): Promise<SandboxRuntimeStatus | null> {
  const response = await fetch("/api/sandbox/settings")
  if (!response.ok) return null
  const body: unknown = await response.json()
  if (!isRecord(body)) return null
  const volumeName = body.volumeName
  if (typeof volumeName !== "string" || volumeName.length === 0) return null
  return {
    keyPresent: Boolean(body.daytonaApiKeyConfigured),
    sandboxReady: Boolean(body.sandboxReady),
    volumeName,
  }
}
