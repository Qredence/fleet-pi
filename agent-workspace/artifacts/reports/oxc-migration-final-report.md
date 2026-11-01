# Oxc Vite+ migration — final report

Branch `oxc-vite-plus-migration`, off `main` at `72c1752`. Nothing pushed.

## Commits per phase

| Phase | SHA | Subject |
| --- | --- | --- |
| PR 0 | `4e86861` | `chore(tooling): install vite-plus and capture the Oxc audit baseline (PR 0)` |
| PR 1a | `f89df1b` | `chore(tooling): add the root Vite+ fmt config and hand import/order to oxfmt (PR 1)` |
| PR 1b | `2bd4ae0` | `style: re-sort imports with oxfmt (PR 1, import-only)` |
| PR 1c | `2a9a9b4` | `style: apply oxfmt formatting drift (PR 1)` |
| PR 1d | `e5262fb` | `style(pi-extensions): format first-party extensions, keep vendored trees excluded` |
| PR 2 | `e8f5616` | `chore(tooling): add the oxlint block and clear its findings` |
| PR 3 | `b2fb6ed` | `chore(tooling): move to typescript 7 and replace tsx with vpx (PR 3)` |
| PR 4 | `7542768` | `chore(tooling): delete eslint and prettier` |
| PR 5a | `b029cad` | `chore(tooling): re-express the type-aware suppressions for oxlint (PR 5)` |
| PR 5b | `158d44a` | `chore(tooling): drop the dead chart suppression` |

`.git-blame-ignore-revs` lists `e6d6c47` and `48a9552`.

## PR 0 — violation counts (read-only baseline)

**235 diagnostics across 100 files: 68 errors, 167 warnings. 28 auto-fixable,
207 requiring hand edits.** All 235 are genuinely pre-existing: the audit ran
against `main`'s code with no migration commit applied, judged by a stricter
rule set than ESLint's 77.

| Rule | Severity | Count | Auto-fixable |
| --- | --- | ---: | ---: |
| `unicorn/no-array-sort` | warn | 48 | 0 |
| `unicorn/consistent-function-scoping` | warn | 41 | 0 |
| `react/set-state-in-effect` | error | 21 | 0 |
| `eslint/preserve-caught-error` | warn | 16 | 16 |
| `react/exhaustive-effect-dependencies` | warn | 16 | 0 |
| `react/no-unstable-nested-components` | warn | 15 | 0 |
| `react-hooks/exhaustive-deps` | error | 13 | 0 |
| `react/refs` | error | 11 | 0 |
| `eslint/no-underscore-dangle` | warn | 8 | 0 |
| `eslint/no-useless-escape` | error | 7 | 5 |
| `unicorn/no-array-reverse` | warn | 7 | 0 |
| `eslint/no-unused-vars` | error | 6 | 0 |
| `eslint/no-unneeded-ternary` | warn | 5 | 0 |
| `unicorn/prefer-string-starts-ends-with` | error | 4 | 4 |
| `eslint/no-shadow` | warn | 2 | 0 |
| `eslint/no-useless-concat` | warn | 2 | 0 |
| `react/memo-dependencies` | warn | 2 | 0 |
| `typescript/no-extraneous-class` | warn | 2 | 0 |
| `unicorn/no-useless-fallback-in-spread` | error | 2 | 2 |
| `unicorn/no-useless-spread` | error | 2 | 1 |
| `eslint/no-control-regex` | error | 1 | 0 |
| `import/no-named-as-default` | warn | 1 | 0 |
| `import/no-unassigned-import` | warn | 1 | 0 |
| `react/hooks` | warn | 1 | 0 |
| `unicorn/no-new-array` | error | 1 | 0 |

`vp lint --fix` was deliberately **not** used: its edits rewrote
`checked === true` to `checked` (changing `boolean | "indeterminate"`
semantics), dropped `void` operators that satisfy `no-floating-promises`, and
flattened an object literal. All 67 surviving correctness/suspicious findings
were fixed by hand.

## Bundle size

Clean `--force` rebuild, PR 0 baseline vs final:

| Scope | Baseline | Final | Delta |
| --- | ---: | ---: | ---: |
| `dist/client/**/*.js` (406 files) | 14,178,654 | 14,178,499 | −155 B (−0.001%) |
| `dist/client` total | 14,648,845 | 14,648,690 | −155 B (−0.001%) |
| `dist/server` total | 18,882,128 | 18,882,338 | +210 B (+0.001%) |
| `dist` total | 33,530,973 | 33,531,028 | +55 B (+0.0002%) |

Well inside the 2% ceiling. No post-alias re-baseline exists because PR 5 was
dropped.

## Lint and typecheck wall-clock

| Gate | Before (ESLint + Prettier) | After (Oxlint + Oxfmt) | Change |
| --- | ---: | ---: | --- |
| Lint, uncached | 20.3 s | 7.9 s (`turbo lint --force` 6.8 s + `vp lint .pi/extensions` 1.1 s) | **−61%** |
| Lint, turbo-cached | 22.2 s with post-step | 1.2 s | −95% |
| Typecheck, uncached | 16.8 s | 3.4 s | **−80%** |
| `vp check` (fmt + lint) | n/a | 3.1 s | new |
| `vp fmt --check` | n/a | 0.7 s, 734 files | new |
| `pnpm build --filter web` | 35.5 s | 33.3 s | −6% |

## Files deleted

```
eslint.config.js
apps/web/eslint.config.js
packages/hax-design/eslint.config.ts
.prettierrc
.prettierignore
```

Packages removed: `eslint` (root, `apps/web`, `hax-design`, `pi-protocol`),
`prettier`, `prettier-plugin-tailwindcss`, `typescript-eslint`, `@tanstack/eslint-config`,
`tsx` (`apps/web`, `hax-design`).

## The 7 `no-unnecessary-condition` suppressions

| # | Site | Status |
| --- | --- | --- |
| 1–6 | `apps/web/src/lib/pi/use-chat-storage.ts:83,105,127,135,156,177` | Kept, rewritten to `// oxlint-disable-next-line typescript/no-unnecessary-condition -- <SSR justification>`. All 6 verified load-bearing: deleting them yields exactly 6 errors. |
| 7 | `packages/hax-design/src/components/chart.tsx:170` | **Deleted.** It was dead — the rule does not fire there because the file is outside the `agent-elements` override but Oxc does not flag that expression. Verified by removing the directive and re-linting: 0 diagnostics. |

## `typeAware`

**Ended `true`.** `oxlint-tsgolint@7.0.2004` resolves cross-workspace types
directly from `packages/*/src` even though neither package has a build step —
verified by planting a bogus cast on `ChatMessage` imported from
`@workspace/pi-protocol/chat-types`; the diagnostic names the real type rather
than `any`. `tsc --noEmit` remains the authoritative gate (`typeCheck: false`
so TypeScript runs exactly once).

## PR 5 — bundler alias verdict: **DROPPED**

Override attempted on `spike/vite-plus-core-alias`:
`vite: npm:@voidzero-dev/vite-plus-core@1.4.0`.

| Gate | Result |
| --- | --- |
| `pnpm build --filter web` | **FAIL** — `vite: command not found` |
| `pnpm build:cloudflare` | **FAIL** — `spawn ENOENT` |
| `pnpm --filter web test` (incl. workers) | pass, 14/14 |

`@voidzero-dev/vite-plus-core@1.4.0` declares **no `bin` field**, so aliasing
removes the `vite` executable from `node_modules/.bin` while leaving the JS API
intact — which is why the workers tests passed and both builds died at shell
resolution. Dropped permanently, not worked around. Reverting
`pnpm-workspace.yaml` and `pnpm-lock.yaml` restored `vite build`.

## Deviations from the plan

1. **`lint` repointed in PR 3, not PR 4.** `typescript-eslint@8.72.0` throws at
   import on `versionMajor >= 7` (peer range `typescript >=4.8.4 <6.1.0`), so
   installing TS 7 made every `pnpm lint` crash — and `pnpm test` and
   `pnpm validate-agents-md` inherit that. A `pnpm.overrides` bridge pinning
   `typescript-eslint`'s own `typescript` to `6.0.3` was tried and reverted: pnpm
   resolved the nested copy but workspace links still picked up 7.0.2.
2. **Three extra `tsx` sites.** The plan listed eight. `knip` flagged `tsx` as an
   unlisted binary in `.github/workflows/cloudflare.yml`; five steps there and
   two in `scripts/auth-migrate.sh` also shelled out to it. All repointed to
   `vpx`, otherwise the `pnpm knip` gate could not pass.
3. **`generate-openapi.ts` moved from Prettier to Oxfmt.** The plan did not
   mention it, but it imported `prettier`'s `format`/`resolveConfig`, so PR 4
   could not delete Prettier without it. `oxfmt` is now a direct `apps/web`
   devDependency. Output verified byte-identical: regenerating produced no diff
   in `openapi.json` (4,700 lines) and `--check` reports up to date.
4. **`eslint` removed from `pi-protocol` in PR 3** (not PR 4) because `knip`
   reported it unused the moment its `lint` script moved to `vp lint`.
5. **`.nvmrc` → `24.16.0`** and the devcontainer image → `1-24-bookworm`, plus
   the ESLint/Prettier VS Code extensions replaced by the Vite+ pack.
6. **`react` rules scoped to `warn`.** The retired ESLint config enabled zero
   React rules; these three carry 60 pre-existing hits that each need a
   behavioural refactor. Recorded in `known-issues.md`.

## Not completed / open

- `packages/hax-design/tsconfig.lint.json` fails on `token-hygiene.test.ts`
  (`node:fs`, `node:path`, `__dirname` absent from its `types`). Unreferenced
  by any script or CI job — left alone per "no modernization pass".
- The alias path is closed until `@voidzero-dev/vite-plus-core` ships a `bin`.
