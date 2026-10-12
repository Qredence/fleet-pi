import type { Plugin } from "vite"

/**
 * Cloudflare Workers reject random values, timers and I/O during module
 * evaluation ("Disallowed operation called within global scope"). A few
 * browser-oriented dependencies do that at import time even though the value
 * only matters in the browser. Rewrite those exact statements for the Worker
 * (SSR) build only; the client bundle is untouched.
 */
const SHIMS: Array<{ id: RegExp; from: string; to: string }> = [
  {
    // @neondatabase/auth: per-tab id for BroadcastChannel session sync.
    id: /@neondatabase[\\/+]auth.*[\\/]dist[\\/].*\.mjs$/,
    from: "const CURRENT_TAB_CLIENT_ID = crypto.randomUUID();",
    to: 'const CURRENT_TAB_CLIENT_ID = "worker-ssr";',
  },
]

export function workerGlobalScopeShims(): Plugin {
  return {
    name: "fleet-pi:worker-global-scope-shims",
    enforce: "pre",
    applyToEnvironment: (environment) => environment.name === "ssr",
    transform(code, id) {
      let next = code
      for (const shim of SHIMS) {
        if (shim.id.test(id) && next.includes(shim.from)) {
          next = next.replace(shim.from, shim.to)
        }
      }
      return next === code ? null : { code: next, map: null }
    },
  }
}
