import { join } from "node:path"

export const HOSTED_EPHEMERAL_SESSION_BASE = "/tmp/.fleet/sessions"

export function resolveHostedUserSessionDir(userId: string) {
  return join(HOSTED_EPHEMERAL_SESSION_BASE, userId)
}
