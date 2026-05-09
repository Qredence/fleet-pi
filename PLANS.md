# PLANS

## Public GitHub Readiness

Purpose:
Prepare Fleet Pi for public GitHub release with a cleaner landing page, a
simple standalone quick start, a clear advanced Codex path, and a public-safe
community-health surface.

Progress:

- [x] Audit the current repo surface for public-readiness gaps.
- [x] Add community-health files and replace placeholder security guidance.
- [x] Add a public-safe environment example and simplify setup documentation.
- [x] Rewrite the README around the standalone-first user story.
- [x] Explain `agent-workspace/` as Fleet Pi's durable adaptive layer.
- [x] Make generated reference docs better reflect `.codex/`, `.pi/`, and
      `agent-workspace/`.
- [x] Run final validation and capture any remaining follow-up gaps.

Decision Log:

- Keep the public story centered on the standalone web app; treat Codex as the
  advanced path rather than the default onboarding flow.
- Keep package manifests `private: true`; public GitHub visibility does not
  imply npm publication.
- Treat `agent-workspace/` as a first-class public concept because it is part
  of Fleet Pi's adaptive system design, not just an internal implementation
  detail.
- Keep org-specific QA automation opt-in/manual and make core CI/release paths
  more portable for public forks.

Outcome:

- The repo now has explicit public-facing docs, community-health files, and a
  clearer setup story.
- The README is shorter and more user-focused.
- Advanced setup and operator-facing details are preserved, but moved behind
  deeper docs instead of crowding the landing page.
- Validation passed for `pnpm install --frozen-lockfile`, `pnpm generate:docs`,
  `pnpm typecheck`, `pnpm --filter web test`, `pnpm build`, `pnpm knip`,
  `pnpm syncpack`, and a local `/api/health` smoke test.
- `pnpm lint` is still red in pre-existing app files outside this change
  (`apps/web/e2e/chat-flows.e2e.ts` and
  `apps/web/src/components/pi/workspace-panel.tsx`), so
  `pnpm validate-agents-md` remains blocked on that unrelated lint failure.
