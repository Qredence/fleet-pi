import { getChatAuthSurface } from "@/lib/auth/chat-auth-surface"
import { isVercelDeployment } from "@/lib/deployment/environment"

/** Vercel web app or Neon Function chat runtime (not local anonymous dev). */
export function isDeployedChatRuntimeSurface() {
  return isVercelDeployment() || getChatAuthSurface() === "neon-function"
}

/** Per-user `pi_user_settings` overrides — Vercel web only today. */
export function usesDatabaseBackedProjectSettings() {
  return isVercelDeployment()
}
