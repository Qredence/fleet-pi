import { isHostedDeployment } from "../../deployment/environment"

/** Hosted Cloudflare web app (not local anonymous dev). */
export function isDeployedChatRuntimeSurface() {
  return isHostedDeployment()
}

/**
 * Tenancy: Neon is canonical for each user's settings, provider keys, and
 * chat history. The git `agent-workspace` tree is the shared harness template.
 * A private file tree exists only as that user's Daytona volume.
 *
 * Per-user `pi_user_settings` overrides apply on every deployed chat surface.
 */
export function usesDatabaseBackedProjectSettings() {
  return isDeployedChatRuntimeSurface()
}
