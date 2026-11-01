# PR 5 — bundler alias: DROPPED

## Attempt

Spike branch `spike/vite-plus-core-alias`, one override added to the root
`pnpm-workspace.yaml`:

```yaml
overrides:
  vite: npm:@voidzero-dev/vite-plus-core@1.4.0
```

`pnpm install` succeeded (no `minimumReleaseAge` rejection — the package was
already in the store as a `vite-plus@1.4.0` dependency) and `vite` resolved to
`@voidzero-dev/vite-plus-core@1.4.0` for every consumer.

## Gate results

| # | Command | Result |
| --- | --- | --- |
| 1 | `pnpm build --filter web` | **FAIL** |
| 2 | `pnpm build:cloudflare` | **FAIL** |
| 3 | `pnpm --filter web test` (incl. `vitest.workers.config.ts`) | pass (14/14) |

## Specific failing command and error

```
$ pnpm build --filter web
web:build: $ vite build
web:build: sh: vite: command not found
web#build: ERROR command … /bin/pnpm run build exited (1)
```

```
$ pnpm build:cloudflare
web@0.0.1 build:cloudflare: `FLEET_PI_TARGET=cloudflare vite build`
spawn ENOENT
```

Root cause: `@voidzero-dev/vite-plus-core@1.4.0` declares **no `bin` field**
(`main: ./dist/vite/node/index.js`, `bin: undefined`). Aliasing `vite` to it
removes the `vite` executable from `node_modules/.bin`, so every `vite build`
invocation in `apps/web/package.json` (`build`, `build:cloudflare`, `preview`)
dies at shell resolution before Vite is even loaded. `apps/web/node_modules/.bin`
contained `cf-vite`, `vitest`, `vp`, `vpr`, `vpx` — and no `vite`.

The JS API is intact (`import("vite")` resolves, and the workers test config
loads it fine), which is why gate 3 passed. The CLI is not, and the plan's gate
is "any of the three fails".

## Verdict

**Dropped permanently**, per the plan's instruction not to work around it or
apply it partially. Reverting `pnpm-workspace.yaml` and `pnpm-lock.yaml` restored
the `vite` binary and `pnpm build --filter web` passes again.

The bundle-size baseline therefore stays frozen at the PR 0 numbers; there is no
post-alias re-baseline to report.

The spike branch held no commits and was deleted.
