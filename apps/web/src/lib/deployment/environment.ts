/**
 * Client-safe deployment helpers. Do not import Node-only modules
 * (`node:async_hooks`, chat-auth-surface) here — `auth-mode.ts` depends on this.
 */

/**
 * True on the hosted Cloudflare Workers runtime
 * (`FLEET_PI_DEPLOYMENT=cloudflare`, set in wrangler.jsonc `vars`).
 * The filesystem is ephemeral, so chat, auth, and settings stay on the
 * fail-closed Postgres-backed paths.
 */
export function isHostedDeployment() {
  return isCloudflareDeployment()
}

export function isCloudflareDeployment() {
  return process.env.FLEET_PI_DEPLOYMENT === "cloudflare"
}
