---
kind: dependency_management
name: pnpm Monorepo Dependency Management with Turborepo and Dependabot
category: dependency_management
scope:
  - "**"
source_files:
  - package.json
  - pnpm-workspace.yaml
  - pnpm-lock.yaml
  - turbo.json
  - .github/dependabot.yml
  - .syncpackrc
  - knip.json
  - apps/web/package.json
  - packages/hax-design/package.json
  - packages/pi-protocol/package.json
---

This repository uses a **pnpm workspace monorepo** managed through **Turborepo**, with automated dependency updates via **GitHub Dependabot**. The system is built around three core layers: package declaration, version pinning/overrides, and update automation.

### Package Manager and Workspace Structure

- **pnpm** is the sole package manager, pinned to `pnpm@11.1.3` via the root `package.json` `packageManager` field.
- The workspace is declared in `pnpm-workspace.yaml`, registering three packages: `apps/web`, `packages/hax-design`, and `packages/pi-protocol`.
- Internal workspace packages reference each other using the `workspace:*` protocol (e.g., `"@workspace/hax-design": "workspace:*"`, `"@workspace/pi-protocol": "workspace:*"`), enforced by **syncpack** which pins all `$LOCAL` dependencies to `workspace:*`.
- A single `pnpm-lock.yaml` at the repository root provides deterministic installs across all workspaces.

### Version Resolution and Overrides

- The root `pnpm-workspace.yaml` contains an extensive `overrides` section that forces specific versions of transitive dependencies across the entire graph — covering security patches (e.g., `handlebars >=4.7.9`, `ws >=8.21.0`, `dompurify >=3.4.11`) and compatibility fixes (e.g., `tslib >=2.8.1` to resolve ESM decorator issues between `@daytona/sdk` and Neon Auth).
- `allowBuilds` explicitly permits native build scripts for specific packages (`@google/genai`, `better-sqlite3`, `esbuild`, `koffi`, `msw`, `protobufjs`, `unrs-resolver`) while blocking others (`core-js`).
- `minimumReleaseAgeExclude` exempts internal `@earendil-works/pi-*` packages from minimum release age checks, allowing rapid iteration on shared agent packages.

### Automated Updates and Auditing

- **Dependabot** (`github/dependabot.yml`) runs weekly on Monday at 09:00 America/New_York against the npm ecosystem at the repo root, opening up to 10 PRs grouped under a `dev-dependencies` group for minor/patch updates only.
- **syncpack** (`syncpack lint --dependency-types prod,dev,peer`) enforces consistent dependency types and formats across the monorepo, with a fix command available.
- **knip** (`knip.json`) scans for unused dependencies and exports across all workspaces, with per-project entry points and ignore lists configured.
- **Turborepo** (`turbo.json`) orchestrates build, lint, typecheck, test, and e2e tasks with task-level caching and dependency ordering (`dependsOn: ["^build"]`).

### Per-Workspace Dependencies

- `apps/web` declares runtime dependencies including TanStack Start/Router, React 19, Zod v4, Better-Auth, Neon Serverless, AWS S3 SDK, Daytona SDK, Pino logging, PostHog analytics, and Vercel tooling.
- `packages/hax-design` depends on React UI primitives (Base UI, shadcn, Tailwind CSS, Motion, Lucide icons) and reuses `@workspace/pi-protocol`.
- `packages/pi-protocol` is minimal, depending only on `@openuidev/lang-core` and `zod` for schema definitions.
- The root `package.json` holds shared dev tooling (TypeScript 6, Prettier, ESLint config, Husky, JSCPD) and top-level scripts that delegate to `turbo` and `pnpm --filter`.

### Constraints and Conventions

- All Node.js code targets Node `>=22` as declared in the root `engines` field.
- Internal packages must use `workspace:*` for cross-package references — enforced by syncpack's `versionGroups` rule.
- Transitive dependency conflicts are resolved centrally via pnpm overrides rather than per-package hoisting or patch files.
- No vendoring strategy is used; all third-party packages are fetched from the public npm registry.
