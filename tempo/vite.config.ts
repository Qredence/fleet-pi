import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tempoVitePlugin } from "tempo-sdk"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

const tempoRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: tempoRoot,
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  plugins: [
    tailwindcss(),
    tempoVitePlugin(),
    react(),
    tsconfigPaths({
      projectDiscovery: "lazy",
    }),
  ],
  server: {
    fs: {
      allow: [".."],
    },
  },
})
