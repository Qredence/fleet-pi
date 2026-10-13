/** Daytona volume mount. Kept here so the CLI extension does not import the web app. */
export const USER_VOLUME_ROOT = "/home/daytona/agent-workspace"

export function isProtectedWorkspacePath(cwd: string) {
  const normalized = cwd.replace(/\\/g, "/")
  return hasSegment(normalized, "system") || hasSegment(normalized, "evals")
}

export function isInsideUserVolume(cwd: string) {
  const normalized = cwd.replace(/\\/g, "/").replace(/\/+$/, "")
  return (
    normalized === USER_VOLUME_ROOT ||
    normalized.startsWith(`${USER_VOLUME_ROOT}/`)
  )
}

/** print, json, and rpc have no trust prompt. The user volume is trusted; anything else is not. */
export function decideHeadlessProjectTrust(cwd: string): "yes" | "no" {
  if (isProtectedWorkspacePath(cwd)) return "no"
  if (isInsideUserVolume(cwd)) return "yes"
  return "no"
}

function hasSegment(cwd: string, segment: "system" | "evals") {
  return (
    cwd.includes(`/agent-workspace/${segment}/`) ||
    cwd.endsWith(`/agent-workspace/${segment}`)
  )
}
