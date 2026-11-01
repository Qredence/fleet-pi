# PR 4 — delete ESLint and Prettier

## Packages removed (all four manifests)

| Package | Root | `apps/web` | `hax-design` | `pi-protocol` |
| --- | --- | --- | --- | --- |
| `eslint` | removed | removed | removed | removed (in PR 3) |
| `prettier` | removed | — | — | — |
| `prettier-plugin-tailwindcss` | removed | — | — | — |
| `typescript-eslint` | removed | removed | — | — |
| `@tanstack/eslint-config` | — | removed | removed | — |

`@tanstack/eslint-config` was never a root dependency, so it was removed from
the two workspaces that declared it. `eslint` in `pi-protocol` went away in PR 3
because its `lint` script moved to `vp lint`.

## Files deleted (5)

```
eslint.config.js
apps/web/eslint.config.js
packages/hax-design/eslint.config.ts
.prettierrc
.prettierignore
```

`apps/web/tsconfig.json` had `eslint.config.js` in its `include` list; that entry
was dropped so `tsc` does not fail on a missing file.

## `generate-openapi.ts` now uses Oxfmt

The script imported `format` and `resolveConfig` from Prettier to make
`apps/web/openapi.json` diff-stable. It now calls `format()` from `oxfmt` with
the same six options as the root `fmt` block.

Verified byte-identical: regenerating produced **no diff** in `openapi.json`
(4700 lines), and `--check` reports "openapi.json is up to date". `oxfmt` is now
a devDependency of `apps/web` (it is already a transitive of `vite-plus`; the
direct entry exists so `tsc` can resolve its type declarations).

## Scripts repointed

| Location | Before | After |
| --- | --- | --- |
| root `lint` | `turbo lint && eslint .pi/extensions` | `turbo lint && vp lint .pi/extensions` |
| `apps/web` `lint` | `eslint` | `vp lint` |
| `hax-design` `lint` | `eslint` | `vp lint` |
| `pi-protocol` `lint` | `eslint` | `vp lint` |
| all three `format` | `prettier --write "**/*.{ts,tsx}"` | `vp fmt` |
| `lint-staged` | `vp fmt` + three `eslint --fix` | `vp fmt` + three `vp lint --fix` + `vp lint --fix .pi/extensions` |

Turbo's `lint` / `format` tasks are untouched; only the commands swapped.

## CI (`.github/workflows/ci.yml`, `lint` job)

```
pnpm exec vp check --no-fmt      # was: pnpm lint
pnpm exec vp fmt --check         # new format gate
pnpm guard:no-eslint-prettier    # new regression guard
```

`pnpm generate:openui-signatures -- --check` and `pnpm generate:openapi -- --check`
are unchanged. The `typecheck` job still runs `pnpm typecheck`, and `test` still
depends on both.

## Absence guard

`scripts/guard-no-eslint-prettier.mjs`, wired as `pnpm guard:no-eslint-prettier`.

Two checks: any of the five retired packages declared in a workspace manifest
(`dependencies` / `devDependencies` / `peerDependencies`), and any of ten config
filenames present anywhere outside `node_modules`, build output and `.git`.
Verified it fails on a planted `.prettierrc` and passes on the current tree.

## Docs updated (5)

- `AGENTS.md` — format commands added to the Commands list; the pre-commit rule
  now names `vp fmt` / `vp lint --fix`; new rule that the only config location is
  the root `vite.config.ts`; naming convention recorded as review policy
  (replacing the dropped `naming-convention` rule).
- `WORKSPACE.md` — `rootConfigs` lists `vite.config.ts` instead of `eslint.config.js`.
- `docs/wiki/how-to-contribute/tooling.md` — the Prettier and ESLint sections are
  replaced by one Vite+ section; the lint-staged block documents the new commands.
- `docs/wiki/how-to-contribute/patterns-and-conventions.md` — code-style bullets
  rewritten for Oxfmt and Oxlint, naming bullet added.
- `docs/wiki/reference/dependencies.md` — `eslint`, `prettier`,
  `prettier-plugin-tailwindcss` and `tsx` rows dropped; `vite-plus` added;
  TypeScript version corrected to v7.

Also updated `.devcontainer/devcontainer.json`: the ESLint and Prettier VS Code
extensions are replaced by the Vite+ extension pack, and `defaultFormatter` moves
to `oxc.oxc-vscode`.

## Gates

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | 3/3, 4.4s |
| `pnpm lint` | 0 errors, 739 warnings / 706 files |
| `pnpm format:check` | clean, 734 files |
| `pnpm guard:no-eslint-prettier` | pass |
| `pnpm knip` | pass |
| `pnpm syncpack` | pass |
| `pnpm test` | 1186 passed, 2 pre-existing failures |
| `pnpm build --filter web` | pass, 34.6s clean |
| `pnpm validate-agents-md` | 27 passed, 3 skipped, 1 failed (the `pnpm test` failure) |

Bundle size after a clean `--force` rebuild, versus the PR 0 baseline:

| Scope | Baseline | PR 4 | Delta |
| --- | --- | --- | --- |
| `dist/client/**/*.js` (406 files) | 14,178,654 | 14,178,499 | −155 B (−0.001%) |
| `dist/client` total | 14,648,845 | 14,648,690 | −155 B |
| `dist/server` total | 18,882,128 | 18,882,338 | +210 B |
| `dist` total | 33,530,973 | 33,531,028 | +55 B (+0.0002%) |
