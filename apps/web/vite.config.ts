import { resolve } from "node:path"

import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { config as dotenvConfig } from "dotenv"
import { visualizer } from "rollup-plugin-visualizer"

// Load .env from the monorepo root into process.env for server-side routes
dotenvConfig({
  path: resolve(import.meta.dirname, "../../.env"),
  override: false,
})

const config = defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
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
})

export default config
