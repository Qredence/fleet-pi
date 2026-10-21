/**
 * Shared guards for the encrypted provider stores. Both `user-providers` and
 * `occ-instances` need the same "is the chat DB configured on this host" and
 * "is the encryption secret available" checks, so they live here.
 */
import { isChatDatabaseConfigured } from "./chat-db-config"
import { isHostedDeployment } from "@/lib/deployment/environment"

export class ChatPostgresUnavailableError extends Error {
  constructor(
    message = "FLEET_PI_CHAT_DATABASE_URL is required for encrypted provider storage on Cloudflare."
  ) {
    super(message)
    this.name = "ChatPostgresUnavailableError"
  }
}

/**
 * Ensures the chat database is configured when running on Cloudflare.
 *
 * @throws `ChatPostgresUnavailableError` if running on Cloudflare without chat database configuration
 */
export function requireChatDatabaseOnHost() {
  if (isHostedDeployment() && !isChatDatabaseConfigured()) {
    throw new ChatPostgresUnavailableError()
  }
}

/**
 * Retrieves the secret used to encrypt user provider credentials.
 *
 * @returns The configured encryption secret
 * @throws Error if `BETTER_AUTH_SECRET` is not configured
 */
export function requireEncryptionSecret() {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is missing, cannot encrypt user provider secrets"
    )
  }
  return process.env.BETTER_AUTH_SECRET
}
