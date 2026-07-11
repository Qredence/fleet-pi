import { join } from "node:path"

export const VERCEL_EPHEMERAL_SESSION_BASE = "/tmp/.fleet/sessions"

export function resolveVercelUserSessionDir(userId: string) {
  return join(VERCEL_EPHEMERAL_SESSION_BASE, userId)
}
