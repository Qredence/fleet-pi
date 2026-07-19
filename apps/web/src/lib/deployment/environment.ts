/**
 * Client-safe deployment helpers. Do not import Node-only modules
 * (`node:async_hooks`, chat-auth-surface) here — `auth-mode.ts` depends on this.
 */
export function isVercelDeployment() {
  return process.env.VERCEL === "1"
}
