import { resolve } from "node:path"

import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { tempoVitePlugin } from "tempo-sdk"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { config as dotenvConfig } from "dotenv"
import { visualizer } from "rollup-plugin-visualizer"

const repoRoot = resolve(import.meta.dirname, "../..")

// Load repo-root env files for server-side routes (.env.local overrides .env)
dotenvConfig({ path: resolve(repoRoot, ".env"), override: false })
dotenvConfig({ path: resolve(repoRoot, ".env.local"), override: true })

// Ensure server-side code resolves projectRoot to the monorepo root, not apps/web/
if (!process.env.FLEET_PI_REPO_ROOT) {
  process.env.FLEET_PI_REPO_ROOT = repoRoot
}

const config = defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
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
  ssr: {
    external: [
      "@daytonaio/sdk",
      "@daytona/api-client",
      "@daytona/toolbox-api-client",
    ],
  },
})

export default config
