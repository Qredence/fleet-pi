# Tooling

This page describes the development tools configured in Fleet Pi, what they do, and how to run them.

## Turborepo

Fleet Pi uses [Turborepo](https://turbo.build/) to coordinate tasks across the `apps/web` and `packages/hax-design` workspaces.

**Key commands (all run from repo root):**

```bash
pnpm build        # builds all workspaces in dependency order
pnpm dev          # starts dev servers (apps/web only today)
pnpm lint         # lints all workspaces
pnpm typecheck    # type-checks all workspaces
pnpm test         # runs all unit tests
pnpm e2e          # runs Playwright tests
```

Turborepo caches task outputs in `.turbo/`. If results look stale after a code change, append `-- --force` to bypass the cache, or delete `.turbo/` manually.

The pipeline is defined in `turbo.json` at the repo root. Build outputs and cache inputs are declared there; changing them incorrectly can cause cache hits on dirty code, so edit with care.

## Prettier

Prettier formats all TypeScript, TSX, JavaScript, JSON, CSS, and Markdown files. Configuration lives in `.prettierrc` at the repo root. Key settings: 80-character line width, 2-space indent, no semicolons.

Tailwind CSS class ordering is handled automatically by `prettier-plugin-tailwindcss`.

Run manually:

```bash
pnpm format           # formats all workspaces
pnpm --filter web format  # formats apps/web only
```

## ESLint

ESLint enforces code style and catches common mistakes. The root `eslint.config.js` delegates to workspace-specific configs so lint-staged can invoke ESLint from the repo root without `--filter`.

Run:

```bash
pnpm lint
```

## lint-staged + Husky

Pre-commit hooks are managed by [Husky](https://typicode.github.io/husky/). The hook at `.husky/pre-commit` runs `pnpm exec lint-staged` before every commit.

`lint-staged` configuration (in `package.json`):

- **`*.{ts,tsx,js,jsx,json,css,md}`** → `prettier --write`
- **`{apps,packages}/**/\*.{ts,tsx,js,jsx}`** → `eslint --fix`

A commit is blocked if ESLint reports errors that cannot be auto-fixed. Husky registers itself via the `prepare` script that runs after `pnpm install`, so hooks are active automatically in any fresh clone.

## knip — Dead Code Detection

[knip](https://knip.dev/) finds unused exports, dead dependencies, and orphaned files.

```bash
pnpm knip
```

CI runs knip on every PR (the `knip` job in `.github/workflows/ci.yml`). The configuration is in `knip.json` at the repo root; workspace `entry` patterns tell knip which files are the public surface of each package.

Fix `Unused exports` violations by removing the export, using it, or (for test-only exports) moving them to a new file. See [`fix-knip-unused-exports` skill](https://app.factory.ai/) for a guided workflow.

## jscpd — Duplicate Code Detection

[jscpd](https://github.com/kucherenko/jscpd) detects copy-pasted code blocks across `apps/web/src` and `packages/hax-design/src`.

```bash
pnpm jscpd
```

CI runs this on every PR and uploads a report artifact. A high duplication rate is a signal to extract a shared utility rather than accumulating parallel implementations.

## syncpack — Dependency Version Drift

[syncpack](https://jamiemason.github.io/syncpack/) verifies that the same package is not declared at different versions across workspaces.

```bash
pnpm syncpack         # check for drift
pnpm syncpack:fix     # auto-fix drift
```

CI runs `pnpm syncpack` in the `syncpack` job. If it fails after adding a dependency, run `pnpm syncpack:fix` and commit the lockfile changes.

## Tech Debt Scanner

A shell script at `scripts/scan-tech-debt.sh` scans for `TODO`, `FIXME`, `HACK`, and `XXX` markers using ripgrep. It produces `tech-debt-report.json`.

```bash
pnpm tech-debt
```

CI uploads the report as an artifact. The job uses `continue-on-error: true` so tech debt markers don't block merges, but they are visible in CI history.

## Bundle Analyzer

The web app's Vite build produces a visual bundle report using `rollup-plugin-visualizer`:

```bash
pnpm build --filter web
# then open in a browser:
open apps/web/bundle-report/stats.html
```

CI uploads this artifact (`bundle-report-<run_id>`) for every successful build so you can compare bundle sizes across commits.

## generate:docs

The `pnpm generate:docs` script (at `scripts/generate-docs.js`) regenerates doc files derived from code or configuration. Run it after changing the sources it reads from.

```bash
pnpm generate:docs
```

## validate-agents-md

`pnpm validate-agents-md` runs `scripts/validate-agents-md.js` to verify that all commands listed in `AGENTS.md` are valid and that the instructions remain consistent with the actual scripts in `package.json`. CI runs this as the `agents-md-validation` job.

```bash
pnpm validate-agents-md
```
