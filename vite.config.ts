// Workspace-root static-analysis host for Vite+ (`vp`). This is not an app
// config: the TanStack Start build lives in `apps/web/vite.config.ts`.
// A `fmt`/`lint` block added to a nested `vite.config.ts` REPLACES this one
// instead of merging, so every static-analysis policy belongs here.
import { defineConfig } from "vite-plus"

export default defineConfig({
  fmt: {
    printWidth: 80,
    semi: false,
    trailingComma: "es5",
    singleQuote: false,
    endOfLine: "lf",
    tabWidth: 2,
    sortTailwindcss: {
      stylesheet: "packages/hax-design/src/styles/globals.css",
      functions: ["cn", "cva"],
    },
    // Prettier never sorted package.json; keep byte-for-byte parity.
    sortPackageJson: false,
    // Replaces the retired import/order rule: the same seven groups in the same
    // order, plus the repo's internal import prefixes.
    sortImports: {
      groups: [
        "builtin",
        "external",
        "internal",
        "parent",
        "sibling",
        "index",
        "type",
      ],
      internalPattern: ["@workspace/", "~/", "@/", "#"],
    },
    ignorePatterns: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.output/**",
      "**/.nitro/**",
      "**/.tanstack/**",
      "**/.vinxi/**",
      "**/coverage/**",
      "**/.pnpm-store/**",
      // Generated: never edited by hand, never reformatted.
      "**/routeTree.gen.ts",
      "packages/pi-protocol/src/openui-signatures.ts",
      "pnpm-lock.yaml",
      // Agent-owned and prose-only trees: formatting churn buys nothing here.
      // `.pi/extensions` is deliberately NOT ignored: it is first-party code
      // with a lint contract, so it must be formatted too.
      "agent-workspace/**",
      "docs/**",
      ".pi/settings.json",
      ".pi/*.md",
      ".pi/skills/**",
      ".pi/prompts/**",
      ".pi/packages/**",
      ".pi/themes/**",
      // Vendored upstream extensions keep their own formatting so an upstream
      // refresh stays a clean diff (same reason they are lint-excluded).
      ".pi/extensions/vendor/**",
    ],
  },
  check: {
    fmt: true,
    // Flipped on in PR 2, when the `lint` block lands.
    lint: false,
  },
})
