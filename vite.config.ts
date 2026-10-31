// Workspace-root static-analysis host for Vite+ (`vp`). This is not an app
// config: the TanStack Start build lives in `apps/web/vite.config.ts`. Only the
// `fmt` / `check` blocks belong here in PR 1; `lint` follows in PR 2.
import { defineConfig } from "vite-plus"

export default defineConfig({
  fmt: {
    // Locked-in equivalents of the retired .prettierrc.
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
      "agent-workspace/**",
      "docs/**",
      ".pi/**",
    ],
  },
  check: {
    fmt: true,
    // Flipped on in PR 2, when the `lint` block lands.
    lint: false,
  },
})
