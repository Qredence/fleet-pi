# PR 2 — Linter (Oxlint)

Adds the `lint` block to the root `vite.config.ts`, ports the repo-specific
ESLint rules, and fixes the `correctness`/`suspicious` findings that were not
already carried by the retired 77-rule ESLint set.

## Config committed

| Concern               | Retired ESLint                    | Oxlint now                                         |
| --------------------- | --------------------------------- | -------------------------------------------------- |
| Categories            | 77 hand-maintained rules          | `correctness: error`, `suspicious: warn`           |
| Plugins               | tseslint + import + n             | `typescript`, `import`, `unicorn`, `react`, `oxc`  |
| `complexity`          | `error, 85`                       | `["error", 85]`                                    |
| `max-lines`           | `error, 1200`                     | `["error", 1200]`                                  |
| `max-lines-per-function` | `error, 460`                   | `["error", 460]`                                   |
| `@/components/*` ban  | `apps/web` only                   | override on `apps/web/**`                          |
| `@workspace/hax-design/*` ban | hax-design only          | override on `packages/hax-design/**`               |
| `node/prefer-node-protocol` | eslint-plugin-n             | `unicorn/prefer-node-protocol`                     |
| `@typescript-eslint/no-unnecessary-condition` | on, off in agent-elements | `typescript/no-unnecessary-condition`, same scoping |
| `.pi/extensions/vendor/**` | ignored by root config       | `lint.ignorePatterns` (parity)                     |
| `packages/pi-protocol` | **no lint config at all**        | covered by root globs + explicit override          |

`typeAware: true` resolves cross-workspace types. Verified by asserting a bogus
cast on `ChatMessage` imported from `@workspace/pi-protocol/chat-types`: the
diagnostic names the real type (`The original expression has type ChatMessage`),
so tsgolint reads the workspace sources rather than `any`.

## Finding counts

Baseline (PR 0, categories only, no ported rules): **235 diagnostics, 68 errors,
167 warnings, 28 auto-fixable**.

After the lint block, ported rules, and `typeAware: true`: **856 diagnostics,
127 errors, 729 warnings**. The 621-diagnostic increase is entirely type-aware
rules that ESLint never ran (`no-unsafe-type-assertion` 505,
`no-floating-promises` 17, `unbound-method` 15, `restrict-template-expressions`
8, `no-base-to-string` 7, plus ten smaller rules).

Final: **739 warnings, 0 errors**. Gate is green.

### What was fixed by hand (67 findings)

`no-floating-promises` 17 (added `void` at the 5 `queue.enqueue` call sites and
12 `recorder.close()` test call sites — the promise is deliberately not awaited,
which is exactly what `void` documents), `no-unused-vars` 3,
`prefer-string-starts-ends-with` 4, `restrict-template-expressions` 8,
`no-base-to-string` 7, `no-redundant-type-constituents` 4,
`no-meaningless-void-operator` 4, `no-useless-spread` 2,
`no-useless-fallback-in-spread` 2, `no-useless-escape` 7, `await-thenable` 2,
`no-misused-spread` 1, `no-new-array` 1, `require-array-sort-compare` 1,
`no-unnecessary-condition` 2, `no-conditional-expect` 1, `no-control-regex` 1.

`vp lint --fix` was **not** used for the commit. Its fixes were reviewed first
and rejected: it rewrote `checked === true` to `checked` (changing `boolean |
"indeterminate"` semantics), deleted `void` operators that satisfy
`no-floating-promises`, and flattened an object literal in `legacy-better-auth`.

### What was scoped as a warning instead

60 findings from `react` rules the retired ESLint config never enabled (it
enabled zero React rules):
`react/set-state-in-effect` 21, `react/refs` 11,
`react-hooks/exhaustive-deps` 13, plus the React plugin's `react-hooks` group.
Every one needs moving state out of an effect or a render-time ref read — a
behavioural refactor, not a lint fix. They are `warn` with the reason in
`vite.config.ts` and `known-issues.md`, so they still surface.

`typescript/unbound-method` (15) is off inside the test override: all 15 hits are
`vi.mocked(fn)` spy references, never detached methods called with the wrong
`this`.

## Suppressions — all 7 resolved

| Site | Before | After |
| ---- | ------ | ----- |
| `use-chat-storage.ts` × 6 | `eslint-disable-next-line @typescript-eslint/no-unnecessary-condition` | same id, now with a `-- why` justification (SSR: `window`/`localStorage` are absent; the DOM lib types do not model that) |
| `packages/hax-design/src/components/chart.tsx` × 1 | same id, no justification | same id with a justification: the payload label type is `string` but the runtime config map can miss |

The comments keep the `eslint-disable` spelling because PR 2 lands before PR 4
deletes ESLint: both linters run at this commit, ESLint needs the directive, and
Oxlint honours the same rule id. Under `--report-unused-disable-directives`
Oxlint calls the `chart.tsx` one unused (the rule is off for `agent-elements`
and that line sits in `components/chart.tsx`), but that flag is not part of any
gate. Both directives are rewritten to `oxlint-disable` in PR 4 and the
`chart.tsx` one is then deleted.

## Deliberate deviations

1. **`.pi/extensions/vendor/**` is excluded from Oxlint.** The retired root
   `eslint.config.js` ignored that tree. Linting it produced 11 errors in
   upstream-vendored code that has its own `UPSTREAM.md` refresh contract;
   fixing them locally would be reverted by the next refresh. Parity carried
   over, documented in `known-issues.md`.
2. **`react` plugin rules are `warn`, not `error`.** Those rules are new to the
   repo; promoting them would block this PR on 60 React refactors.
3. **`eslint.config.js` got one `String(pattern)` wrapper.** It is linted as a
   source file and tripped `restrict-template-expressions`. The file is deleted
   in PR 4.

## Gates at this commit

| Gate | Result |
| ---- | ------ |
| `vp check` | 0 errors, 739 warnings (706 files) |
| `vp fmt --check` | all 737 files formatted |
| `pnpm lint` (turbo ESLint + `.pi/extensions`) | 0 errors, 37 warnings |
| `pnpm typecheck` | 3/3 packages |
| `pnpm test` | 1183/1183 pass; 2 fail in `resource-expectations.test.ts` |
| `pnpm build --filter web` | success |
| `pnpm validate-agents-md` | 24 pass, 1 fail (`pnpm test`, same pre-existing cause) |
| client JS bundle | 14,178,499 B vs 14,178,654 B baseline (−155 B, −0.001 %) |

The `pnpm test` failure is pre-existing and environmental: the test reads the
gitignored `.pi/settings.json`, which on this machine contains
`enabledModels`/`defaultProvider`/`defaultModel` — the exact keys AGENTS.md
forbids committing. Confirmed failing on a clean `main` worktree by stashing.
