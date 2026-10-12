/**
 * Client-safe deployment helpers. Do not import Node-only modules
 * (`node:async_hooks`, chat-auth-surface) here — `auth-mode.ts` depends on this.
 */

/**
 * True on a hosted serverless deployment: Vercel, or Cloudflare Workers
 * (`FLEET_PI_DEPLOYMENT=cloudflare`, set in wrangler.jsonc `vars`). Both have
 * an ephemeral, mostly read-only filesystem, so they share the same
 * fail-closed, Postgres-backed code paths. The name predates Workers support.
 */
export function isVercelDeployment() {
  return process.env.VERCEL === "1" || isCloudflareDeployment()
}

export function isCloudflareDeployment() {
  return process.env.FLEET_PI_DEPLOYMENT === "cloudflare"
}
