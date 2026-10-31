# PR 0 — Oxc Vite+ migration audit (read-only)

Captured before any config was committed, on branch `oxc-vite-plus-migration`
off `main` at `72c1752`. `vite-plus@1.4.0` was installed at the workspace root
only. No source files were edited.

## Baseline timings (main, Prettier + ESLint)

| Gate                        | Wall clock                           | Command                               |
| --------------------------- | ------------------------------------ | ------------------------------------- |
| `pnpm lint`                 | 20.3 s (cold, 22.2 s with post-step) | `turbo lint && eslint .pi/extensions` |
| `pnpm typecheck` (uncached) | 16.8 s                               | `turbo run typecheck --force`         |
| `pnpm build --filter web`   | 35.5 s                               | `turbo build --filter web`            |

## Baseline bundle sizes (`pnpm build --filter web`)

| Scope                             | Bytes      |
| --------------------------------- | ---------- |
| `dist/client/**/*.js` (406 files) | 14,178,654 |
| `dist/client/**/*.css`            | 140,888    |
| `dist/client` total (all files)   | 14,648,845 |
| `dist/server` total               | 18,882,128 |
| `dist` total                      | 33,530,973 |

## `vp check` findings (root, throwaway config)

Config mirrored the current Prettier options plus `correctness: error`,
`suspicious: warn`, plugins `typescript, import, unicorn, react, oxc`, and
`react/react-in-jsx-scope` off (automatic JSX runtime; the rule fired 1,217
times as noise).

**235 diagnostics across 100 files — 68 errors, 167 warnings. 28 auto-fixable
via `vp lint --fix`, 207 requiring hand edits.**

| Rule                                     | Severity | Count | Auto-fixable |
| ---------------------------------------- | -------- | ----: | -----------: |
| `unicorn/no-array-sort`                  | warn     |    48 |            0 |
| `unicorn/consistent-function-scoping`    | warn     |    41 |            0 |
| `react/set-state-in-effect`              | error    |    21 |            0 |
| `eslint/preserve-caught-error`           | warn     |    16 |           16 |
| `react/exhaustive-effect-dependencies`   | warn     |    16 |            0 |
| `react/no-unstable-nested-components`    | warn     |    15 |            0 |
| `react-hooks/exhaustive-deps`            | error    |    13 |            0 |
| `react/refs`                             | error    |    11 |            0 |
| `eslint/no-underscore-dangle`            | warn     |     8 |            0 |
| `eslint/no-useless-escape`               | error    |     7 |            5 |
| `unicorn/no-array-reverse`               | warn     |     7 |            0 |
| `eslint/no-unused-vars`                  | error    |     6 |            0 |
| `eslint/no-unneeded-ternary`             | warn     |     5 |            0 |
| `unicorn/prefer-string-starts-ends-with` | error    |     4 |            4 |
| `eslint/no-shadow`                       | warn     |     2 |            0 |
| `eslint/no-useless-concat`               | warn     |     2 |            0 |
| `react/memo-dependencies`                | warn     |     2 |            0 |
| `typescript/no-extraneous-class`         | warn     |     2 |            0 |
| `unicorn/no-useless-fallback-in-spread`  | error    |     2 |            2 |
| `unicorn/no-useless-spread`              | error    |     2 |            1 |
| `eslint/no-control-regex`                | error    |     1 |            0 |
| `import/no-named-as-default`             | warn     |     1 |            0 |
| `import/no-unassigned-import`            | warn     |     1 |            0 |
| `react/hooks`                            | warn     |     1 |            0 |
| `unicorn/no-new-array`                   | error    |     1 |            0 |

Files added by this migration do not exist yet, so **all 235 findings are
pre-existing** in the sense that no migration commit introduced them. They are
`main`'s code judged by a stricter rule set than ESLint's 77.

Hot spots: `packages/hax-design/src/components/agent-elements/markdown.tsx`
(15), `apps/web/src/lib/daytona/client.ts` (15),
`.pi/extensions/vendor/subagents/index.ts` (10).

## `vp fmt` change surface

| Config                                              | Files `vp fmt` would rewrite |
| --------------------------------------------------- | ---------------------------: |
| Prettier options only                               |                           27 |
| + `sortImports` (7 groups, matching `import/order`) |                          511 |
| + `sortImports` (6 groups incl. `unknown`)          |                          499 |

Prettier itself rewrites 17 files on a clean `main`, 12 of them outside the
Oxc scope (`.remember/`, `agent-workspace/`, `apps/web/agent-workspace/`,
`apps/web/src/lib/analytics/posthog.ts`,
`apps/web/src/lib/workspace/workspace-index-types.ts`,
`packages/hax-design/src/components/openui/openui-utils.ts`). Those 12 are
ignored or currently unformatted drift; `ignorePatterns` covers the workspace
subtrees.

The 704-file figure in the plan corresponds to the repository's TS/TSX source
count (verified: 487 web + 172 hax-design + 23 pi-protocol + 22 `.pi/extensions`
= 704). The import re-sort touches 511 of them.

## Risk verification

1. **`apps/web/vite.config.ts` is not loaded at root.** Appending a `throw` to
   that file and running `vp check` + `vp lint` from the root produced no
   error, so the root config is the only one read. It _is_ linted as a source
   file (root `vp lint --debug=files` lists 712 files including it), which is
   expected.
2. **`ignorePatterns` are correct before the first `vp fmt`.** `agent-workspace/`,
   `docs/`, `.pi/`, `routeTree.gen.ts`, `openui-signatures.ts` and
   `pnpm-lock.yaml` are excluded and untouched.
3. **`minimumReleaseAge`**: `vite-plus@1.4.0` published 2026-10-23, its pinned
   `oxlint@1.89.0` / `oxfmt@0.74.0` / `oxlint-tsgolint@7.0.2004` are all older
   than 24 h. No `minimumReleaseAgeExclude` entry was needed.
4. **`vp check` and `vp lint` are both fast** (1.5 s and 2.6 s warm) because
   they are native binaries.
