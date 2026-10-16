import { getChatAuthSurface } from "@/lib/auth/chat-auth-surface"
import { isHostedDeployment } from "@/lib/deployment/environment"

/** Cloudflare web app or Neon Function chat runtime (not local anonymous dev). */
export function isDeployedChatRuntimeSurface() {
  return isHostedDeployment() || getChatAuthSurface() === "neon-function"
}

/**
 * Tenancy: Neon is canonical for each user's settings, provider keys, and
 * chat history. The git `agent-workspace` tree is the shared harness template.
 * A private file tree exists only as that user's Daytona volume.
 *
 * Per-user `pi_user_settings` overrides apply on every deployed chat surface,
 * including the Neon Function that serves production chat.
 */
export function usesDatabaseBackedProjectSettings() {
  return isDeployedChatRuntimeSurface()
}
