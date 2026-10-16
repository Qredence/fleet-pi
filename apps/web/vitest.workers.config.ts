import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    cloudflareTest({
      remoteBindings: false,
      verbose: false,
      wrangler: { configPath: "./wrangler.jsonc" },
      main: "./src/lib/pi/durable/user-pi-durable.worker.ts",
    }),
  ],
  test: {
    include: ["src/**/*.workers.test.ts"],
    retry: 0,
  },
})
