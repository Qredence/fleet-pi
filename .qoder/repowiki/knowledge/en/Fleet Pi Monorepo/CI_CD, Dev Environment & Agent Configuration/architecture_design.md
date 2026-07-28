This module is a flat collection of configuration files across five top-level dot-directories, each governing a distinct layer of the developer and CI experience:

- `.github/workflows/` contains the primary CI orchestration: `ci.yml` runs lint, typecheck, syncpack, knip, jscpd, tech-debt scanning, unit tests, Playwright smoke tests, Vercel build verification, and deployment-readiness checks; `release.yml` triggers on `v*` tags to generate changelogs and publish GitHub Releases; `e2e.yml`, `qa.yml`, and `neon_workflow.yml` cover extended test and database workflows.
- `.circleci/config.yml` provides a minimal placeholder CircleCI pipeline (a single `say-hello` job).
- `.devcontainer/devcontainer.json` defines a VS Code Remote Container based on `mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm` with pnpm, ESLint, Prettier, Tailwind CSS, and TypeScript extensions, mounting SSH keys and forwarding port 3000.
- `.husky/pre-commit` delegates staged-file linting to `lint-staged` via `pnpm exec`.
- `.pi/settings.json` configures the PI agent with default provider `google`, skill/package/extension paths pointing into `../agent-workspace/pi/`, and four npm packages (`pi-autoresearch`, `pi-skill-palette`, `pi-autocontext`, `pi-web-access`).
- `.pi/extensions/` and `.pi/skills/` hold custom TS extensions and SKILL.md definitions consumed by the PI runtime.
  Dependency direction is one-way: these configs drive tooling but are not imported by application code.
