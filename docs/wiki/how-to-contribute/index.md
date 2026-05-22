# Contributing to Fleet Pi

Fleet Pi is an open-source project and contributions are welcome. This guide covers the full contribution lifecycle from finding work to getting your code merged.

## Before You Start

Read [`CODE_OF_CONDUCT.md`](../../../CODE_OF_CONDUCT.md) before participating. All contributors are expected to follow it. For security-sensitive issues, consult [`SECURITY.md`](../../../SECURITY.md) before opening a public report.

## Finding Work

- Browse [open issues](https://github.com/Qredence/fleet-pi/issues) on GitHub. Issues labelled `good first issue` are a reasonable starting point.
- Comment on an issue to signal you're working on it so effort isn't duplicated.
- For larger changes (new features, architectural changes), open an issue or a draft PR first to align on direction before investing significant time.

## Fork and Branch

1. Fork the repository on GitHub.
2. Clone your fork locally.
3. Create a descriptive branch from `main`:

   ```bash
   git checkout -b fix-session-hydration-on-reload
   ```

   No enforced naming convention exists, but short, descriptive names help reviewers. Avoid names like `patch-1` or `fix`.

4. Keep your branch rebased against `main` while in progress.

## Making Changes

- Follow the existing code style (Prettier + ESLint configurations enforce most of it automatically).
- Colocate tests with the code they cover; see the [testing guide](./testing.md).
- Keep commits atomic and logically grouped — one concern per commit is easier to review.

## Definition of Done

A pull request is ready to merge when **all** of the following are true:

| Check                                     | How to verify                              |
| ----------------------------------------- | ------------------------------------------ |
| No TypeScript errors                      | `pnpm typecheck` passes                    |
| No lint errors                            | `pnpm lint` passes                         |
| All unit tests pass                       | `pnpm test` passes                         |
| Pre-commit hooks clean                    | `pnpm exec lint-staged` runs without error |
| No unused exports or dead code introduced | `pnpm knip` passes                         |
| No new duplicate code blocks              | `pnpm jscpd` passes                        |
| Dependency versions consistent            | `pnpm syncpack` passes                     |

CI enforces all of the above on every pull request. A failing check blocks merge.

## Opening a Pull Request

1. Push your branch to your fork.
2. Open a PR against `main` on the upstream repository.
3. Fill in the PR description: what changed and why.
4. Link any related issues (`Closes #123`).
5. Respond to review comments; mark threads resolved once addressed.

A maintainer will review and either approve, request changes, or close with an explanation.

## Issue Templates

The repository ships GitHub issue templates for bug reports and feature requests. Use them — the structure helps maintainers triage quickly and helps you include the information most likely to get a fast response.

## Code of Conduct

All interactions in the Fleet Pi project (issues, PRs, discussions, code review) are governed by the [Contributor Covenant Code of Conduct](../../../CODE_OF_CONDUCT.md). Maintainers will enforce it.
