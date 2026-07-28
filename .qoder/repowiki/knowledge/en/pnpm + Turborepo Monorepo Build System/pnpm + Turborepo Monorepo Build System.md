---
kind: build_system
name: pnpm + Turborepo Monorepo Build System
category: build_system
scope:
  - "**"
source_files:
  - package.json
  - turbo.json
  - pnpm-workspace.yaml
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - apps/web/package.json
  - packages/hax-design/package.json
  - packages/pi-protocol/package.json
---

The Fleet Pi monorepo uses a modern Node.js build system centered on **pnpm workspaces** and **Turborepo** for task orchestration, with Vite as the per-package bundler and Vitest for testing. CI is driven by GitHub Actions workflows, while CircleCI exists only as a placeholder.
