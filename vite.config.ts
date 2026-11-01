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
  lint: {
    // Mirrors the retired ESLint posture: correctness blocks, suspicious
    // advises. `--deny-warnings` is not used, so warnings stay advisory.
    categories: {
      correctness: "error",
      suspicious: "warn",
    },
    plugins: ["typescript", "import", "unicorn", "react", "oxc"],
    options: {
      // tsgolint reads each file's own tsconfig. `tsc --noEmit` stays the
      // authoritative gate; this only feeds the type-aware nursery rules.
      typeAware: true,
      typeCheck: false,
    },
    rules: {
      // The app uses the automatic JSX runtime; React need not be in scope.
      "react/react-in-jsx-scope": "off",
      // Ported from the retired ESLint configs (apps/web, hax-design).
      complexity: ["error", 85],
      "max-lines": ["error", 1200],
      "max-lines-per-function": ["error", 460],
      // Replaces `node/prefer-node-protocol` from eslint-plugin-n.
      "unicorn/prefer-node-protocol": "error",
      // Ported from @typescript-eslint/no-unnecessary-condition. Nursery in
      // Oxc, so it needs `typeAware`; scoped by the overrides below exactly as
      // the retired ESLint config scoped it.
      "typescript/no-unnecessary-condition": "error",
      // The React plugin is new to this repo (the retired ESLint config enabled
      // zero React rules). These three are React-Compiler-era purity rules with
      // 60 pre-existing hits, every one of which needs a behavioural refactor
      // rather than a mechanical edit. They stay advisory until that refactor
      // lands; see agent-workspace/memory/project/known-issues.md.
      "react/set-state-in-effect": "warn",
      "react/refs": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
    ignorePatterns: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "apps/web/dist/**",
      "agent-workspace/**",
      "docs/**",
      "**/routeTree.gen.ts",
      "packages/pi-protocol/src/openui-signatures.ts",
      // Vendored upstream Pi extensions (see each UPSTREAM.md): refreshing
      // upstream must not fight a local lint backlog.
      ".pi/extensions/vendor/**",
    ],
    overrides: [
      {
        // Ported policy: UI components live in @workspace/hax-design.
        files: ["apps/web/**/*.{ts,tsx}"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                {
                  group: ["@/components/*"],
                  message:
                    "UI components belong in @workspace/hax-design. Add to packages/hax-design/src/components/fleet-pi/ or components/openui/ instead.",
                },
              ],
            },
          ],
        },
      },
      {
        // Ported policy: relative imports inside the design system only.
        files: ["packages/hax-design/**/*.{ts,tsx}"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                {
                  group: ["@workspace/hax-design/*"],
                  message:
                    "Use relative imports inside packages/hax-design instead of @workspace/hax-design. Prefer components/fleet-pi/ for Fleet Pi surfaces (not components/pi/).",
                },
              ],
            },
          ],
        },
      },
      {
        files: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
        plugins: ["typescript", "import", "unicorn", "react", "oxc", "vitest"],
        rules: {
          // `vi.mocked(fn).mockResolvedValue(...)` is the repo's mocking idiom;
          // the flagged references are always spy assertions, never detached
          // methods called with the wrong receiver.
          "typescript/unbound-method": "off",
          // Test doubles narrow `unknown` payloads into the shape under test by
          // design; most repo-wide hits live here. Source files keep the rule
          // so real unsoundness stays visible.
          "typescript/no-unsafe-type-assertion": "off",
        },
      },
      {
        // agent-elements deliberately narrows loose wire types at render time.
        files: ["packages/hax-design/src/components/agent-elements/**"],
        rules: {
          "typescript/no-unnecessary-condition": "off",
        },
      },
      {
        // These extensions run in Pi's non-typechecked runtime, so type-aware
        // rules never applied here. Console logging is intentional CLI output.
        files: [".pi/extensions/**"],
        rules: {
          "typescript/no-unnecessary-condition": "off",
          "no-console": "off",
        },
      },
    ],
  },
  check: {
    fmt: true,
    lint: true,
  },
})
