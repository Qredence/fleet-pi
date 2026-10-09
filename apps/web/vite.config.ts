import { resolve } from "node:path"

import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { cloudflare } from "@cloudflare/vite-plugin"
import { tempoVitePlugin } from "tempo-sdk"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { config as dotenvConfig } from "dotenv"
import { visualizer } from "rollup-plugin-visualizer"
import { workerGlobalScopeShims } from "./scripts/cloudflare/worker-global-scope-shims"

const repoRoot = resolve(import.meta.dirname, "../..")

// Load repo-root env files for server-side routes (.env.local overrides .env)
dotenvConfig({ path: resolve(repoRoot, ".env"), override: false })
// Validation launches pin auth/mirror env vars to empty via process env; the
// flag keeps .env.local from re-injecting them (default behavior unchanged).
const preserveProcessEnv = process.env.FLEET_PI_VALIDATION_PRESERVE_ENV === "1"
dotenvConfig({
  path: resolve(repoRoot, ".env.local"),
  override: !preserveProcessEnv,
})

// Ensure server-side code resolves projectRoot to the monorepo root, not apps/web/
if (!process.env.FLEET_PI_REPO_ROOT) {
  process.env.FLEET_PI_REPO_ROOT = repoRoot
}

const config = defineConfig({
  // Env files live at the monorepo root, so load VITE_-prefixed client vars
  // (e.g. VITE_PUBLIC_POSTHOG_KEY) from there instead of apps/web.
  envDir: repoRoot,
  server: {
    watch: {
      // Settings → Providers writes .env.local at runtime. Restarting mid-POST
      // aborts the browser fetch ("Failed to fetch") even when credentials saved.
      // process.env is updated in-memory by updateEnvVars; a restart is unnecessary.
      ignored: [
        resolve(repoRoot, ".env"),
        resolve(repoRoot, ".env.local"),
        "**/.env",
        "**/.env.local",
      ],
    },
  },
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    ...(process.env.FLEET_PI_TARGET === "cloudflare"
      ? [
          cloudflare({ viteEnvironment: { name: "ssr" } }),
          workerGlobalScopeShims(),
        ]
      : []),
    tempoVitePlugin(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    visualizer({
      filename: "bundle-report/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  ...(process.env.FLEET_PI_TARGET === "cloudflare"
    ? {
        environments: {
          ssr: {
            // workerd leaves import.meta.url undefined in bundled modules;
            // Node-oriented deps (pi-coding-agent config) derive paths from it
            // at module load.
            define: {
              "import.meta.url": JSON.stringify("file:///bundle/worker.js"),
            },
          },
        },
      }
    : {}),
  ssr:
    process.env.FLEET_PI_TARGET === "cloudflare"
      ? undefined
      : {
          external: [
            "@daytona/sdk",
            "@daytona/api-client",
            "@daytona/toolbox-api-client",
          ],
        },
})

export default config
