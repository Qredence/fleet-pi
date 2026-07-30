import { getChatAuthSurface } from "@/lib/auth/chat-auth-surface"

/** Vercel web app or Neon Function chat runtime (not local anonymous dev). */
export function isDeployedChatRuntimeSurface() {
  return process.env.VERCEL === "1" || getChatAuthSurface() === "neon-function"
}

/** Per-user `pi_user_settings` overrides — Vercel web only today. */
export function usesDatabaseBackedProjectSettings() {
  return process.env.VERCEL === "1"
}
