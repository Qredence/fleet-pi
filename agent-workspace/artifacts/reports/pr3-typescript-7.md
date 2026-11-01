# PR 3 — TypeScript 7.0.2 and `vpx`

## Result

- `typescript@^7.0.2` in all four manifests. `pnpm syncpack` clean.
- `pnpm typecheck` green: 3/3 packages, **4.5s** wall-clock (turbo, cold cache).
- `pnpm build --filter web` green.
- `pnpm lint` green (0 errors, 739 advisory warnings in 706 files).
- `pnpm test`: 1186 passed / 2 failed — the same two `resource-expectations`
  failures already documented in PR 2, reproduced on a clean `main` worktree.
- `pnpm knip` green, `pnpm syncpack` green, `pnpm validate-agents-md` 24 passed /
  3 skipped / 1 failed (the same `pnpm test` failure).

## Deviation 1 — `lint` repointed in PR 3, not PR 4

`typescript-eslint@8.72.0` (current latest) hard-throws at import time:

```
typescript-eslint does not support TS 7.0.
```

The guard is `if (versionMajor >= 7) throw` in `typescript-eslint/dist/index.js`,
and its declared peer range is `typescript >=4.8.4 <6.1.0`. Because
`apps/web`, `packages/hax-design` and the root `.pi/extensions` ESLint run all
load `typescript-eslint`, installing TS 7 turns every `pnpm lint` invocation
into an immediate crash — `pnpm test` and `pnpm validate-agents-md` inherit the
failure.

The phase boundary therefore moved: `lint` scripts and the `lint-staged` block
were repointed to `vp lint` / `vp lint --fix` **in PR 3**, not PR 4. PR 4 keeps
its own job (delete the ESLint/Prettier packages and their config files). This
keeps every phase's gate green instead of leaving one commit with a red `lint`.

Attempted and reverted: pinning `typescript-eslint`'s own peer to `typescript@6.0.3`
via `pnpm.overrides` (`"typescript-eslint>typescript": "6.0.3"`), which is the
side-by-side arrangement Microsoft documents for the 6 → 7 transition. pnpm
resolved the nested copy correctly (`typescript-eslint@…__typescript@6.0.3/`
exists in the store) but the workspace links still resolve `typescript` to
7.0.2, so the guard still fires. No override was kept.

## Deviation 2 — three extra `tsx` call sites

The plan listed eight. Grepping for `tsx ` across CI and shell scripts found
three more invocation sites, all repointed to `vpx`:

| File | Sites |
| --- | --- |
| `.github/workflows/cloudflare.yml` | 5 (`assert-preview-worker-secrets.ts`) |
| `scripts/auth-migrate.sh` | 2 (`auth-migrate.ts`, `auth-post-migrate.ts`) |

`knip` had flagged `tsx` as an unlisted binary in `cloudflare.yml`, so leaving
these would have failed the definition-of-done `pnpm knip` gate.

## `tsconfig` fixes: none needed

TS 7 accepted all four tsconfigs unchanged. `apps/web`, `packages/hax-design`
and `packages/pi-protocol` all typecheck clean on 7.0.2 with no edits.

**Known, pre-existing:** `packages/hax-design/tsconfig.lint.json` fails on
`src/components/fleet-pi/__tests__/token-hygiene.test.ts` (`node:fs`,
`node:path`, `__dirname` are not in that config's `types`). Confirmed identical
on `typescript@6.0.3` by running the old `tsc` binary directly, and nothing in
the repo or CI references that config — it is dead. Left untouched per "no
modernization pass".

## `.nvmrc` → Node 24

`22.23.3` → `24.16.0`. Required by `vite-plus`'s engine range
(`^22.18.0 || ^24.11.0 || >=26.0.0`; 22.23.3 satisfies it, but the plan targets
v24 and the two `vpx`-based script runners are only exercised on 24 here).
`.devcontainer/devcontainer.json` image moved from `typescript-node:1-22-bookworm`
to `1-24-bookworm` to match.

## `tsx` removal

`tsx` removed from `apps/web` and `packages/hax-design`. It remains in the store
transitively via `@voidzero-dev/vite-plus-core`, which is expected and not a
direct dependency. No `allowBuilds` entry referenced `tsx`, so none was removed.

`eslint` was also removed from `packages/pi-protocol` — `knip` reported it as an
unused devDependency once its `lint` script moved to `vp lint`.
